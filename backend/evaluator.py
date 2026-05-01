"""
Pagani Zonda R – Evaluator
LLM-as-Judge scoring, IR metrics (Precision/Recall/F1), latency & cost tracking.
"""

import time
import logging
import json
import asyncio
from datetime import datetime, timezone
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

logger = logging.getLogger("pagani.evaluator")

api_key = os.getenv("GROQ_API_KEY", "dummy_key")  # Groq Key
client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=api_key)


class LLMJudge:
    """Uses LLM to score a generated response against a reference or query."""

    def __init__(self, model_name: str = "llama-3.3-70b-versatile"):
        self.model_name = model_name

    def score(self, query: str, response: str, reference: str = None) -> dict:
        """
        Ask the LLM to rate the response on relevance, faithfulness, and completeness.
        Returns {"relevance": 0-10, "faithfulness": 0-10, "completeness": 0-10, "overall": 0-10, "reasoning": str}
        """
        ref_block = f"\nReference Answer:\n{reference}" if reference else ""

        prompt = f"""Rate the following AI response on a scale of 0-10 for each criterion.
Return ONLY valid JSON with keys: relevance, faithfulness, completeness, overall, reasoning.

User Query:
{query}
{ref_block}
AI Response:
{response}

JSON Output:"""

        try:
            response = client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            text = response.choices[0].message.content.strip()
            # Strip markdown fences if present
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            scores = json.loads(text)
            return {
                "relevance": scores.get("relevance", 0),
                "faithfulness": scores.get("faithfulness", 0),
                "completeness": scores.get("completeness", 0),
                "overall": scores.get("overall", 0),
                "reasoning": scores.get("reasoning", ""),
            }
        except Exception as e:
            logger.error(f"LLMJudge scoring failed: {e}")
            return {"relevance": 0, "faithfulness": 0, "completeness": 0,
                    "overall": 0, "reasoning": f"Error: {e}"}


class IRMetrics:
    """Compute Precision, Recall, and F1 for retrieved chunks against ground-truth relevant IDs."""

    @staticmethod
    def compute(retrieved_ids: list[str], relevant_ids: list[str]) -> dict:
        """
        Args:
            retrieved_ids: IDs of chunks returned by the retriever.
            relevant_ids:  IDs of chunks known to be relevant (ground truth).
        Returns:
            {"precision": float, "recall": float, "f1": float}
        """
        retrieved_set = set(retrieved_ids)
        relevant_set = set(relevant_ids)

        true_positives = len(retrieved_set & relevant_set)
        precision = true_positives / len(retrieved_set) if retrieved_set else 0.0
        recall = true_positives / len(relevant_set) if relevant_set else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        return {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "true_positives": true_positives,
            "retrieved_count": len(retrieved_set),
            "relevant_count": len(relevant_set),
        }


class LatencyCostTracker:
    """Track latency and estimated token cost for pipeline operations."""

    # Rough cost estimates per 1K tokens (USD) – adjust as needed
    COST_PER_1K_INPUT = 0.00035
    COST_PER_1K_OUTPUT = 0.00105

    def __init__(self):
        self._start: float = 0.0

    def start(self):
        self._start = time.perf_counter()

    def stop(self, input_tokens: int = 0, output_tokens: int = 0) -> dict:
        elapsed = time.perf_counter() - self._start
        input_cost = (input_tokens / 1000) * self.COST_PER_1K_INPUT
        output_cost = (output_tokens / 1000) * self.COST_PER_1K_OUTPUT
        total_cost = input_cost + output_cost

        return {
            "latency_seconds": round(elapsed, 4),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "estimated_cost_usd": round(total_cost, 6),
        }


class Evaluator:
    """Combines all evaluation components and persists results to the database."""

    def __init__(self):
        self.judge = LLMJudge()
        self.tracker = LatencyCostTracker()

    def evaluate(
        self,
        query: str,
        response: str,
        retrieved_ids: list[str] = None,
        relevant_ids: list[str] = None,
        reference: str = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        latency_seconds: float = 0.0,
    ) -> dict:
        """Run full evaluation and store results."""

        # LLM Judge
        judge_scores = self.judge.score(query, response, reference)

        # IR Metrics
        ir_metrics = {}
        if retrieved_ids and relevant_ids:
            ir_metrics = IRMetrics.compute(retrieved_ids, relevant_ids)

        # Latency & Cost
        cost_data = {
            "latency_seconds": round(latency_seconds, 4),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "estimated_cost_usd": round(
                (input_tokens / 1000) * LatencyCostTracker.COST_PER_1K_INPUT
                + (output_tokens / 1000) * LatencyCostTracker.COST_PER_1K_OUTPUT, 6
            ),
        }

        result = {
            "query": query,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "llm_judge": judge_scores,
            "ir_metrics": ir_metrics,
            "cost_tracking": cost_data,
        }

        # Persist to database
        self._store_result(result)

        return result

    async def evaluate_async(
        self,
        query: str,
        response: str,
        retrieved_ids: list[str] = None,
        relevant_ids: list[str] = None,
        reference: str = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        latency_seconds: float = 0.0,
    ) -> dict:
        """Async version of evaluate - runs LLM judge in thread pool."""

        judge_scores = await asyncio.to_thread(self.judge.score, query, response, reference)

        ir_metrics = {}
        if retrieved_ids and relevant_ids:
            ir_metrics = IRMetrics.compute(retrieved_ids, relevant_ids)

        cost_data = {
            "latency_seconds": round(latency_seconds, 4),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "estimated_cost_usd": round(
                (input_tokens / 1000) * LatencyCostTracker.COST_PER_1K_INPUT
                + (output_tokens / 1000) * LatencyCostTracker.COST_PER_1K_OUTPUT, 6
            ),
        }

        result = {
            "query": query,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "llm_judge": judge_scores,
            "ir_metrics": ir_metrics,
            "cost_tracking": cost_data,
        }

        await asyncio.to_thread(self._store_result, result)
        return result

    @staticmethod
    def _store_result(result: dict):
        """Store evaluation result in the Evaluation table."""
        try:
            from database import get_db_session
            from models import Evaluation

            with get_db_session() as db:
                eval_record = Evaluation(
                    query=result["query"],
                    relevance=result["llm_judge"].get("relevance", 0) / 10.0,
                    faithfulness=result["llm_judge"].get("faithfulness", 0) / 10.0,
                    completeness=result["llm_judge"].get("completeness", 0) / 10.0,
                    overall=result["llm_judge"].get("overall", 0) / 10.0,
                    precision=result["ir_metrics"].get("precision", 0),
                    recall=result["ir_metrics"].get("recall", 0),
                    f1_score=result["ir_metrics"].get("f1", 0),
                    latency_ms=result["cost_tracking"].get("latency_seconds", 0) * 1000.0,
                    estimated_cost_usd=result["cost_tracking"].get("estimated_cost_usd", 0),
                    reasoning=result["llm_judge"].get("reasoning", ""),
                    metadata_=result
                )
                db.add(eval_record)
                db.commit()
            logger.info("Evaluation result stored in database.")
        except Exception as e:
            logger.error(f"Failed to store evaluation result: {e}")
