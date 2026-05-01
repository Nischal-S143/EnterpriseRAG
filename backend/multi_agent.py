import logging
import time
import asyncio
import os
from typing import TypedDict, Any
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

logger = logging.getLogger(__name__)

# API Setup
api_key = os.getenv("GROQ_API_KEY", "dummy_key")  # Groq Key
client = AsyncOpenAI(base_url="https://api.groq.com/openai/v1", api_key=api_key)

GENERATION_MODEL = "llama-3.3-70b-versatile"


class SharedState(TypedDict):
    """Shared state dictionary representing the memory across multi-agent passes."""
    query: str
    retrieved_docs: list[dict]
    analysis_results: list[dict]
    draft_response: str
    final_response: str
    errors: list[str]
    metadata: dict[str, Any]


class RetrieverAgent:
    """
    Agent responsible for gathering information from the vector store or searching indices.
    """

    async def execute(self, state: SharedState, sse_queue: asyncio.Queue = None) -> SharedState:
        t0 = time.time()
        if sse_queue:
            await sse_queue.put({"event": "agent", "data": {"name": "Retriever", "status": "started", "input_chunks": len(state.get("retrieved_docs", []))}})

        logger.info("RetrieverAgent executing.")
        docs = state.get("retrieved_docs", [])

        # Deduplication based on chunk_id or raw text
        seen = set()
        deduped = []
        for doc in docs:
            c_id = doc.get("chunk_id", hash(doc.get("text", "")))
            if c_id not in seen:
                seen.add(c_id)
                deduped.append(doc)

        # Re-rank strictly on final_score or initial dense score
        deduped.sort(key=lambda x: x.get("final_score", x.get("score", 0.0)), reverse=True)

        state["retrieved_docs"] = deduped
        if sse_queue:
            await sse_queue.put({"event": "agent", "data": {"name": "Retriever", "status": "done", "output_chunks": len(deduped), "removed_duplicates": len(docs) - len(deduped), "duration_ms": int((time.time() - t0) * 1000)}})
        return state


async def _gemini_call_with_retry(model_name, messages, stream=False, max_retries=5):
    """Helper with robust exponential back-off for 429 Quota Exceeded errors."""
    for attempt in range(max_retries):
        try:
            return await client.chat.completions.create(
                model=model_name,
                messages=messages,
                stream=stream
            )
        except Exception as e:
            if "429" in str(e) and attempt < max_retries - 1:
                wait_time = (attempt + 1) * 3
                logger.warning(
                    f"429 Quota Exceeded in multi-agent. Retrying in {wait_time}s... (Attempt {attempt + 1}/{max_retries})")
                await asyncio.sleep(wait_time)
                continue
            raise e


class SynthesisAgent:
    """
    Consolidated agent responsible for both technical analysis and final drafting.
    Reduces latency by combining reasoning and synthesis into one Gemini call.
    """

    def __init__(self, model_name: str = GENERATION_MODEL):
        self.model_name = model_name

    async def execute(self, state: SharedState, sse_queue: asyncio.Queue = None) -> SharedState:
        t0 = time.time()
        if sse_queue:
            await sse_queue.put({"event": "agent", "data": {"name": "Synthesis Agent", "status": "started"}})

        logger.info("SynthesisAgent starting direct generation.")
        query = state.get("query", "")
        docs = state.get("retrieved_docs", [])

        if not docs:
            state["final_response"] = "The system found no relevant enterprise documents to answer your query."
            return state

        context_str = "\n\n".join(
            f"Doc: '{doc.get('source', 'unknown')}'"
            f" (Upload: {doc.get('uploaded_by', 'System')}):"
            f"\n{doc.get('content', doc.get('text', ''))}"
            for doc in docs[:15]
        )
        # unused var removed

        prompt = f"""You are a master technical consultant for Pagani Automobili.
        Your task is to analyze the provided context and draft a final response in ONE STEP.

        GOALS:
        1. Factual accuracy (use ONLY the provided context).
        2. Citations (mention sources clearly).
        3. Logic (explain why/how if needed).

        User Query: {query}

        Format Requested: {state.get('metadata', {}).get('format', 'Standard')}

        Context:
        {context_str}

        Your Answer:"""

        try:
            # Combined analysis and writing with streaming
            messages = [{"role": "user", "content": prompt}]
            response_stream = await _gemini_call_with_retry(self.model_name, messages, stream=True)
            draft = []
            async for chunk in response_stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    text = chunk.choices[0].delta.content
                    draft.append(text)
                    if sse_queue:
                        await sse_queue.put({"event": "token", "data": {"text": text}})

            final_text = "".join(draft).strip()
            state["final_response"] = final_text

        except Exception as e:
            logger.error(f"SynthesisAgent failed: {e}")
            err_msg = str(e)[:100]
            state["final_response"] = (
                f"Error generating response: {err_msg}."
                " Please check your API quota."
            )

        if sse_queue:
            await sse_queue.put({"event": "agent", "data": {"name": "Synthesis Agent", "status": "done", "duration_ms": int((time.time() - t0) * 1000)}})
        return state


async def run_multi_agent(
        query: str, retrieved_chunks: list[dict], state: dict, sse_queue: asyncio.Queue):
    """Entry point for the consolidated Synthesis System."""
    shared_state: SharedState = {
        "query": query,
        "retrieved_docs": retrieved_chunks,
        "analysis_results": [],
        "draft_response": "",
        "final_response": "",
        "errors": [],
        "metadata": state
    }

    retriever = RetrieverAgent()
    synthesizer = SynthesisAgent()

    shared_state = await retriever.execute(shared_state, sse_queue)
    shared_state = await synthesizer.execute(shared_state, sse_queue)

    # Calculate final confidence
    conf = 0.0
    if shared_state["retrieved_docs"]:
        top3 = [c.get("score", 0.0) for c in shared_state["retrieved_docs"][:3]]
        conf = sum(top3) / len(top3)

    sources = list({
        f"{doc.get('source', 'Unknown')} (Uploaded by: {doc.get('uploaded_by', 'System')})"
        for doc in shared_state["retrieved_docs"]
    })

    if sse_queue:
        await sse_queue.put({
            "event": "result",
            "data": {
                "answer": shared_state["final_response"],
                "sources": sources,
                "confidence": round(conf, 3)
            }
        })
    return shared_state


async def run_single_agent(
        query: str, retrieved_chunks: list[dict], sse_queue: asyncio.Queue, metadata: dict = None):
    """Optimized Fast Path for direct technical responses."""
    synthesizer = SynthesisAgent()
    shared_state: SharedState = {
        "query": query,
        "retrieved_docs": retrieved_chunks,
        "analysis_results": [],
        "draft_response": "",
        "final_response": "",
        "errors": [],
        "metadata": metadata or {}
    }
    return await synthesizer.execute(shared_state, sse_queue)
