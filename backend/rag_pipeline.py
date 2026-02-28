"""
Pagani Zonda R – RAG Pipeline with Gemini 1.5 Pro
Handles context construction, prompt engineering, and LLM generation.
"""

import os
import time
import logging
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("pagani.rag_pipeline")

# ── Gemini Configuration ──
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

GENERATION_MODEL = "gemini-2.0-flash"

# ── Safety Settings ── Block nothing for enterprise use
SAFETY_SETTINGS = {
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}

# ── System Prompt ──
SYSTEM_PROMPT = """You are the Pagani Zonda R Enterprise Intelligence Assistant.
You are a world-class automotive expert embedded within Pagani Automobili's internal knowledge system.

STRICT RULES:
1. Answer ONLY from the provided context documents below.
2. Do NOT hallucinate, fabricate, or invent any information.
3. If the answer is not found in the provided context, respond EXACTLY with:
   "The requested information is not available in the provided enterprise data."
4. Maintain a professional, precise, and technically authoritative tone.
5. When quoting specifications, be exact — do not approximate.
6. Reference the source document when applicable.
7. Format responses for clarity: use bullet points for lists, bold for key specs.

CONTEXT DOCUMENTS:
{context}

USER ROLE: {user_role}
(Respond appropriately for this access level. Do not reference restricted documents.)
"""


def _build_prompt(context_docs: list[dict], user_role: str) -> str:
    """Build the system prompt with retrieved context."""
    context_text = "\n\n".join(
        f"[Source: {doc['source']}] (Relevance Score: {doc['score']:.3f})\n{doc['content']}"
        for doc in context_docs
    )
    return SYSTEM_PROMPT.format(context=context_text, user_role=user_role)


def _assess_confidence(context_docs: list[dict]) -> str:
    """Assess confidence based on retrieval scores."""
    if not context_docs:
        return "low"
    avg_score = sum(d["score"] for d in context_docs) / len(context_docs)
    if avg_score > 0.75:
        return "high"
    elif avg_score > 0.5:
        return "medium"
    return "low"


def generate_response(
    question: str,
    context_docs: list[dict],
    user_role: str = "viewer",
) -> dict:
    """
    Generate a RAG response using Gemini 1.5 Pro.
    Returns: {answer, sources, confidence}
    """
    start_time = time.time()

    try:
        system_prompt = _build_prompt(context_docs, user_role)
        model = genai.GenerativeModel(
            model_name=GENERATION_MODEL,
            system_instruction=system_prompt,
            safety_settings=SAFETY_SETTINGS,
        )

        response = model.generate_content(question)

        # Extract answer
        answer = response.text if response.text else (
            "The requested information is not available in the provided enterprise data."
        )

        # Build sources list
        sources = [doc["source"] for doc in context_docs]
        confidence = _assess_confidence(context_docs)

        latency = time.time() - start_time
        logger.info(
            f"RAG response generated | question='{question[:60]}...' | "
            f"role={user_role} | sources={len(sources)} | "
            f"confidence={confidence} | latency={latency:.2f}s"
        )

        return {
            "answer": answer,
            "sources": sources,
            "confidence": confidence,
        }

    except Exception as e:
        latency = time.time() - start_time
        logger.error(f"Gemini generation failed after {latency:.2f}s: {e}")
        raise RuntimeError(f"Gemini API generation failed: {e}")


async def generate_response_stream(
    question: str,
    context_docs: list[dict],
    user_role: str = "viewer",
):
    """
    Streaming RAG response using Gemini 1.5 Pro.
    Yields text chunks as they arrive.
    """
    try:
        system_prompt = _build_prompt(context_docs, user_role)
        model = genai.GenerativeModel(
            model_name=GENERATION_MODEL,
            system_instruction=system_prompt,
            safety_settings=SAFETY_SETTINGS,
        )

        response = model.generate_content(question, stream=True)

        for chunk in response:
            if chunk.text:
                yield chunk.text

        logger.info(f"Streaming RAG response completed for: '{question[:60]}...'")

    except Exception as e:
        logger.error(f"Gemini streaming generation failed: {e}")
        yield "Error: The AI service is temporarily unavailable. Please try again."
