"""
Pagani Zonda R – RAG Pipeline with Gemini 1.5 Pro
Handles context construction, prompt engineering, and LLM generation.
"""

import os
import time
import json
import logging
import asyncio
from openai import AsyncOpenAI
from sentence_transformers import SentenceTransformer
import numpy as np
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
logger = logging.getLogger("pagani.rag_pipeline")

# ── API Setup ──
api_key = os.getenv("GROQ_API_KEY") # Groq Key
client = AsyncOpenAI(base_url="https://api.groq.com/openai/v1", api_key=api_key)

GENERATION_MODEL = "llama-3.3-70b-versatile"
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# ── Session Memory Store ──
# Map of username to a list of dicts: {"role": "user"|"model", "content": str}
chat_sessions: dict[str, list[dict]] = {}
MAX_SESSION_TURNS = 5  # Keep last 5 Q&A pairs (10 messages total)

def _get_history(username: str) -> list[dict]:
    return chat_sessions.get(username, [])
    
def _add_to_history(username: str, question: str, answer: str):
    if username not in chat_sessions:
        chat_sessions[username] = []
    
    chat_sessions[username].append({"role": "user", "content": question})
    chat_sessions[username].append({"role": "model", "content": answer})
    
    # Truncate
    if len(chat_sessions[username]) > MAX_SESSION_TURNS * 2:
        chat_sessions[username] = chat_sessions[username][-MAX_SESSION_TURNS * 2:]

async def _gemini_call_with_retry(model_name, messages, stream=False, max_retries=5, response_format=None):
    """Helper with robust exponential back-off for 429 Quota Exceeded errors."""
    for attempt in range(max_retries):
        try:
            kwargs = {"model": model_name, "messages": messages, "stream": stream}
            if response_format:
                kwargs["response_format"] = {"type": "json_object"}
            return await client.chat.completions.create(**kwargs)
        except Exception as e:
            err_msg = str(e).lower()
            if "429" in err_msg:
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 3
                    logger.warning(f"429 Rate Limit. Retrying in {wait_time}s... (Attempt {attempt+1}/{max_retries})")
                    await asyncio.sleep(wait_time)
                    continue
            raise e


# ═══════════════════════════════════════════
# Prompt Template System
# ═══════════════════════════════════════════

PROMPT_TEMPLATES = {
    "default": """You are an AI assistant specialized in Pagani hypercars and engineering.

Use ONLY the information provided in the context.

If the answer is not found in the context say:
"I do not have enough information in the knowledge base."

Context:
{context}

Conversation History:
{history}

User Question: {question}

Provide a clear technical explanation with source citations.""",

    "structured": """You are an AI assistant specialized in Pagani hypercars and engineering.

Use ONLY the information provided in the context. Always format your response as:
- **Summary**: A brief 1-2 sentence answer
- **Details**: Detailed explanation with bullet points
- **Sources**: List the source documents you referenced
- **Confidence**: Rate your confidence as High/Medium/Low with justification

Context:
{context}

Conversation History:
{history}

User Question: {question}""",

    "bullet_summary": """You are an AI assistant specialized in Pagani hypercars and engineering.

Use ONLY the information provided in the context.
Provide your answer as concise bullet points. Include source citations inline.

Context:
{context}

Conversation History:
{history}

User Question: {question}""",
}

# ── Few-Shot Examples (prepended to system prompt) ──
FEW_SHOT_EXAMPLES = """
--- Example 1 ---
Question: What engine does the Zonda use?
Answer: The Pagani Zonda is powered by a naturally aspirated Mercedes-AMG M120 7.3L V12 engine, producing up to 760 HP in the Zonda R variant. [Source: pagani_zonda_specs]

--- Example 2 ---
Question: How is the Huayra's active aero system different?
Answer: The Huayra features four independently controlled active aerodynamic flaps — two at the front and two at the rear — that adjust based on speed, cornering forces, and driver input to optimize downforce and reduce drag. [Source: pagani_huayra_aero]
---
"""




ROUTER_PROMPT = """You are an intelligent query routing agent for Pagani Automobili.
Your job is to read the user's new question and the recent chat history, then decide TWO things:
1. Does this question require factual data from the enterprise knowledge base?
2. Formulate an optimized search query by resolving pronouns.
3. Extract any specific metadata filters (like 'model': 'Zonda', 'model': 'Huayra', 'model': 'Utopia').

Output exactly a JSON object in this format:
{
  "needs_search": true or false,
  "search_query": "The optimized query here",
  "metadata_filters": {"model": "Zonda"} // only output keys if specifically requested, else omit or {}
}

CHAT HISTORY:
{history}
"""


def _build_history_text(history: list[dict]) -> str:
    """Format history for the prompt."""
    if not history:
        return "No prior conversation."
    return "\n".join(f"{msg['role'].capitalize()}: {msg['content']}" for msg in history)


def _build_prompt(
    context_docs: list[dict],
    user_role: str,
    history: list[dict],
    question: str = "",
    template: str = "default",
) -> str:
    """Build the system prompt with retrieved context, history, and few-shot examples."""
    context_text = "\n\n".join(
        f"[Source: {doc['source']}] (Relevance Score: {doc['score']:.3f})\n{doc['content']}"
        for doc in context_docs
    )
    history_text = _build_history_text(history)
    prompt_template = PROMPT_TEMPLATES.get(template, PROMPT_TEMPLATES["default"])
    return FEW_SHOT_EXAMPLES + prompt_template.format(
        context=context_text,
        user_role=user_role,
        history=history_text,
        question=question,
    )

async def agentic_router(question: str, history: list[dict]) -> dict:
    """
    Decide if a vector search is needed and reformulate the query.
    Returns: {"needs_search": bool, "search_query": str}
    """
    try:
        history_text = _build_history_text(history)
        system_instruction = ROUTER_PROMPT.format(history=history_text)
        
        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": question}
        ]
        response = await _gemini_call_with_retry(GENERATION_MODEL, messages, response_format=True)
        result = json.loads(response.choices[0].message.content)
        
        logger.info(f"Router Decision: {result}")
        return result
    except Exception as e:
        logger.warning(f"Agentic router failed, defaulting to regular search: {e}")
        return {"needs_search": True, "search_query": question}


def _assess_confidence(context_docs: list[dict]) -> dict:
    """Assess confidence based on LLM reranking scores. Returns numeric + label."""
    if not context_docs:
        return {"score": 0, "label": "low"}
    avg_score = sum(d["score"] for d in context_docs) / len(context_docs)
    if avg_score > 80:
        label = "high"
    elif avg_score > 50:
        label = "medium"
    else:
        label = "low"
    return {"score": round(avg_score, 1), "label": label}


async def generate_response(
    question: str,
    context_docs: list[dict],
    user_role: str = "viewer",
    username: str = "guest",
    output_format: str = "default",
) -> dict:
    start_time = time.time()
    try:
        history = _get_history(username)
        system_prompt = _build_prompt(
            context_docs, user_role, history,
            question=question, template=output_format,
        )
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question}
        ]
        response = await _gemini_call_with_retry(GENERATION_MODEL, messages)
        answer = response.choices[0].message.content if response.choices else (
            "The requested information is not available in the provided enterprise data."
        )

        sources = list({doc["source"] for doc in context_docs})
        confidence = _assess_confidence(context_docs) if sources else {"score": 0, "label": "N/A"}

        latency = time.time() - start_time
        logger.info(
            f"RAG response generated | question='{question[:60]}...' | "
            f"role={user_role} | sources={len(sources)} | "
            f"confidence={confidence['label']} ({confidence['score']}) | latency={latency:.2f}s"
        )
        _add_to_history(username, question, answer)

        return {
            "answer": answer,
            "sources": sources,
            "confidence": confidence["label"],
            "confidence_score": confidence["score"],
            "latency_s": round(latency, 2),
        }

    except Exception as e:
        latency = time.time() - start_time
        logger.error(f"OpenAI generation failed after {latency:.2f}s: {e}")
        raise RuntimeError(f"OpenAI API generation failed: {e}")


async def generate_response_stream(
    question: str,
    context_docs: list[dict],
    user_role: str = "viewer",
    username: str = "guest",
):
    try:
        history = _get_history(username)
        system_prompt = _build_prompt(context_docs, user_role, history)
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question}
        ]
        
        response_stream = await _gemini_call_with_retry(GENERATION_MODEL, messages, stream=True)

        full_answer = ""
        async for chunk in response_stream:
            # OpenAI chunk structure
            if chunk.choices and chunk.choices[0].delta.content:
                text = chunk.choices[0].delta.content
                full_answer += text
                yield text

        logger.info(f"Streaming RAG response completed for: '{question[:60]}...'")
        _add_to_history(username, question, full_answer)

    except Exception as e:
        logger.error(f"OpenAI streaming generation failed: {e}")
        yield "Error: The AI service is temporarily unavailable. Please try again."

# ═══════════════════════════════════════════
# Planner System
# ═══════════════════════════════════════════
import asyncio
import numpy as np

PLANNER_PROMPT = """Analyze query, respond JSON only: 
{{"strategy":"simple|multi_hop|comparative",
"sub_queries":["q1","q2"],
"needs_table":true|false,
"needs_code":true|false,
"complexity":"low|medium|high"}}
Query: {question}"""

class Planner:
    def __init__(self, model_name: str = GENERATION_MODEL):
        self.model_name = model_name

    async def plan(self, question: str, sse_queue: asyncio.Queue = None) -> dict:
        start_time = time.time()
        prompt = PLANNER_PROMPT.format(question=question)
        
        try:
            messages = [{"role": "user", "content": prompt}]
            response = await _gemini_call_with_retry(self.model_name, messages, response_format=True)
            result = json.loads(response.choices[0].message.content)
            
            # Defaults
            if "strategy" not in result: result["strategy"] = "simple"
            if "sub_queries" not in result: result["sub_queries"] = [question]
            if "complexity" not in result: result["complexity"] = "low"
            if "needs_table" not in result: result["needs_table"] = False
            if "needs_code" not in result: result["needs_code"] = False
                
        except Exception as e:
            logger.warning(f"Planner failed, defaulting to simple: {e}")
            result = {
                "strategy": "simple",
                "sub_queries": [question],
                "needs_table": False,
                "needs_code": False,
                "complexity": "low"
            }
            
        duration = int((time.time() - start_time) * 1000)
        
        if sse_queue:
            await sse_queue.put({
                "event": "planner",
                "data": {
                    "strategy": result["strategy"],
                    "sub_queries": result["sub_queries"],
                    "complexity": result["complexity"],
                    "duration_ms": duration
                }
            })
            
        return result

class ToolExecution:
    """
    Hybrid Search Tool with RRF, Multi-hop, Comparative and HyDE boosting.
    """
    def __init__(self, vector_store, sse_queue: asyncio.Queue = None):
        self.vector_store = vector_store
        self.sse_queue = sse_queue
        
        # Integration with live VectorStore
        # self.bm25_index and self.chunks will be retrieved from self.vector_store dynamically
        pass

    async def _embed_query(self, query: str) -> np.ndarray:
        try:
            embedding = embedding_model.encode([query], convert_to_numpy=True).astype(np.float32)
            return embedding
        except Exception as e:
            logger.error(f"Failed to embed query: {e}")
            return None

    def _cosine_similarity(self, v1: np.ndarray, v2: np.ndarray) -> float:
        if v1 is None or v2 is None: return 0.0
        dot = np.dot(v1, v2)
        norm = np.linalg.norm(v1) * np.linalg.norm(v2)
        return float(dot / norm) if norm > 0 else 0.0

    async def _hyde_boost(self, query_emb: np.ndarray, chunks: list[dict]) -> tuple[list[dict], int]:
        if query_emb is None: return chunks, 0
        
        boosted_count = 0
        for chunk in chunks:
            max_sim = 0.0
            hq_embs = chunk.get("metadata", {}).get("hq_embeddings", [])
            for hq in hq_embs:
                try:
                    hq_arr = np.array(hq, dtype=np.float32)
                    sim = self._cosine_similarity(query_emb, hq_arr)
                    if sim > max_sim: max_sim = sim
                except: pass
                
            if max_sim > 0.75:
                chunk["score"] = chunk.get("score", 0.0) + 0.15
                chunk["hyde_boosted"] = True
                boosted_count += 1
                
        # Re-sort
        chunks.sort(key=lambda x: x.get("score", 0.0), reverse=True)
        return chunks, boosted_count

    async def _emit_retrieval(self, tool_name: str, sub_query: str, chunks_found: int, top_score: float, duration: int):
        if self.sse_queue:
            await self.sse_queue.put({
                "event": "retrieval",
                "data": {
                    "tool": tool_name,
                    "sub_query": sub_query,
                    "chunks_found": chunks_found,
                    "top_score": round(top_score, 3),
                    "duration_ms": duration
                }
            })

    async def simple_search(self, query: str, top_k: int = 5, needs_table: bool = False, needs_code: bool = False) -> list[dict]:
        """FAISS dense + BM25 sparse -> RRF fusion"""
        start_time = time.time()
        
        # 1. FAISS Dense search
        # Requires vector_store to be active. If not, fallback empty.
        dense_results = []
        if self.vector_store and hasattr(self.vector_store, 'index') and self.vector_store.index:
            query_emb = await self._embed_query(query)
            if query_emb is not None:
                faiss_emb = query_emb.reshape(1, -1)
                import faiss
                faiss.normalize_L2(faiss_emb)
                
                search_k = min(self.vector_store.index.ntotal, 50)
                scores, indices = self.vector_store.index.search(faiss_emb, search_k)
                
                for idx, sc in zip(indices[0], scores[0]):
                    if idx != -1 and idx < len(self.vector_store.documents):
                        dense_results.append((self.vector_store.documents[idx], float(sc)))
                        
        # 2. BM25 Sparse search
        sparse_results = []
        # Use live data from vector_store
        bm25_index = getattr(self.vector_store, 'bm25_index', None)
        chunks = getattr(self.vector_store, 'documents', [])
        
        if bm25_index and chunks:
            import re
            tokens = re.findall(r'\b\w+\b', query.lower())
            bm25_scores = bm25_index.get_scores(tokens)
            
            for idx, sc in enumerate(bm25_scores):
                if sc > 0 and idx < len(chunks):
                    sparse_results.append((chunks[idx], float(sc)))
                    
        # Sort sparse descending before RRF
        sparse_results.sort(key=lambda x: x[1], reverse=True)
        
        # 3. RRF Fusion
        rrf_scores = {}
        for rank, (doc, _) in enumerate(dense_results):
            # Try to uniquely identify chunk
            cid = doc.get("chunk_id", doc.get("content", "")[:50])
            rrf_scores[cid] = {"doc": doc, "score": rrf_scores.get(cid, {}).get("score", 0.0) + (1.0 / (60 + rank + 1))}
            
        for rank, (doc, _) in enumerate(sparse_results):
            cid = doc.get("chunk_id", doc.get("content", "")[:50])
            if cid not in rrf_scores:
                rrf_scores[cid] = {"doc": doc, "score": 0.0}
            rrf_scores[cid]["score"] += (1.0 / (60 + rank + 1))
            
        final_list = []
        for v in rrf_scores.values():
            doc = dict(v["doc"])
            doc["score"] = v["score"]
            
            # Type filtering boosts
            ctype = doc.get("chunk_type", "")
            if needs_table and ctype in ["table", "table_row"]: doc["score"] += 0.20
            if needs_code and ctype == "code": doc["score"] += 0.20
            
            final_list.append(doc)
            
        final_list.sort(key=lambda x: x["score"], reverse=True)
        top_results = final_list[:top_k]
        
        duration = int((time.time() - start_time) * 1000)
        top_sc = top_results[0]["score"] if top_results else 0.0
        
        await self._emit_retrieval("simple_search", query, len(top_results), top_sc, duration)
        return top_results

    async def execute(self, plan: dict, query: str) -> list[dict]:
        strategy = plan.get("strategy", "simple")
        sub_queries = plan.get("sub_queries", [query])
        needs_table = plan.get("needs_table", False)
        needs_code = plan.get("needs_code", False)
        top_k = 5
        
        all_chunks = []
        
        if strategy == "simple":
            all_chunks = await self.simple_search(query, top_k, needs_table, needs_code)
            
        elif strategy == "multi_hop":
            start_time = time.time()
            dedup = {}
            for sq in sub_queries:
                # Top 3 per sub_query
                sq_chunks = await self.simple_search(sq, 3, needs_table, needs_code)
                for c in sq_chunks:
                    cid = c.get("chunk_id", c.get("content", "")[:50])
                    if cid not in dedup or c["score"] > dedup[cid]["score"]:
                        dedup[cid] = c
            
            fused = list(dedup.values())
            fused.sort(key=lambda x: x["score"], reverse=True)
            all_chunks = fused[:top_k]
            
            await self._emit_retrieval("multi_hop_search", "ALL", len(all_chunks), all_chunks[0]["score"] if all_chunks else 0, int((time.time() - start_time) * 1000))
            
        elif strategy == "comparative":
            start_time = time.time()
            dedup = {}
            for sq in sub_queries:
                sq_chunks = await self.simple_search(sq, 3, needs_table, needs_code)
                for c in sq_chunks:
                    cid = c.get("chunk_id", c.get("content", "")[:50])
                    # Ensure document grouping tags are visible
                    src_tag = f"[{c.get('source', c.get('doc_id', 'Unknown Source'))}]"
                    if "source_tag" not in c:
                        c["source_tag"] = src_tag
                        
                    if cid not in dedup or c["score"] > dedup[cid]["score"]:
                        dedup[cid] = c
            
            # Sort by doc_id to group them, then by score
            fused = list(dedup.values())
            fused.sort(key=lambda x: (x.get("doc_id", ""), x.get("score", 0.0)), reverse=True)
            all_chunks = fused[:top_k+2] # Comparative can use slightly more context
            
            await self._emit_retrieval("comparative_search", "ALL", len(all_chunks), all_chunks[0]["score"] if all_chunks else 0, int((time.time() - start_time) * 1000))

        else:
            all_chunks = await self.simple_search(query, top_k, needs_table, needs_code)

        # Apply HyDE Boost based on original query
        query_emb = await self._embed_query(query)
        boosted_chunks, b_count = await self._hyde_boost(query_emb, all_chunks)
        
        if self.sse_queue and b_count > 0:
            await self.sse_queue.put({
                "event": "retrieval",
                "data": {
                    "tool": "hyde_boost",
                    "chunks_boosted": b_count,
                    "boost_applied": 0.15
                }
            })
            
        # Format the final chunks list for frontend payload
        if self.sse_queue and boosted_chunks:
            preview_chunks = []
            for c in boosted_chunks:
                meta = c.get("metadata", {})
                preview_chunks.append({
                    "chunk_id": c.get("chunk_id", "Unknown"),
                    "chunk_type": c.get("chunk_type", "text"),
                    "heading_path": c.get("heading_path", ""),
                    "page": c.get("page_number", 1),
                    "score": round(c.get("score", 0.0), 3),
                    "text_preview": c.get("text", c.get("content", ""))[:120],
                    "keywords": meta.get("keywords", [])[:3]
                })
                
            await self.sse_queue.put({
                "event": "chunks",
                "data": {"chunks": preview_chunks}
            })
            
        return boosted_chunks

class ConditionalRouter:
    """
    Evaluates retrieval confidence and routes to specific agents or human review.
    """
    def __init__(self, sse_queue: asyncio.Queue = None):
        self.sse_queue = sse_queue

    async def route(self, chunks: list[dict]) -> dict:
        if not chunks:
            confidence = 0.0
        else:
            # avg of top-3 chunk scores
            top3 = [c.get("score", 0.0) for c in chunks[:3]]
            confidence = sum(top3) / len(top3)
            
        # Confidence normalization: the LLM reranker returns scores from 0-100.
        # We normalize this to a 0.0-1.0 scale for thresholding.
        norm_conf = float(confidence) / 100.0
        
        if norm_conf >= 0.35:
            decision = "single_agent"
            reason = f"Good confidence ({norm_conf:.2f} >= 0.35) using fast-path responder."
        elif norm_conf > 0.0:
            decision = "multi_agent"
            reason = f"Context found ({norm_conf:.2f}) using synthesis agent."
        else:
            decision = "human_validation"
            reason = f"No relevant context found (confidence {norm_conf:.2f})."
            
        if self.sse_queue:
            await self.sse_queue.put({
                "event": "router",
                "data": {
                    "confidence": round(norm_conf, 3),
                    "routed_to": decision,
                    "reason": reason
                }
            })
            
        return {
            "decision": decision,
            "confidence": round(norm_conf, 3)
        }
