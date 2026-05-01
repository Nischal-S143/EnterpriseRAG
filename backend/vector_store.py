"""
Pagani Zonda R – Vector Store with FAISS + Gemini Embeddings
Handles document storage, embedding, persistence, and role-based search.
"""

import os
import re
import pickle
import logging
import json
import numpy as np
import faiss
import google.generativeai as genai
from openai import OpenAI
import threading
from datetime import datetime, timezone
try:
    from rank_bm25 import BM25Okapi
except ImportError:
    BM25Okapi = None
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
logger = logging.getLogger("pagani.vector_store")

# ── Gemini Embedding Configuration ──
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
EMBEDDING_MODEL = "models/gemini-embedding-001"

# ── Groq Configuration (for LLM reranking) ──
api_key = os.getenv("GROQ_API_KEY", "dummy_key")
client = OpenAI(base_url="https://api.groq.com/openai/v1",
                api_key=api_key, timeout=15.0, max_retries=1)

# ── Persistence Paths ──
INDEX_PATH = os.path.join(os.path.dirname(__file__), "faiss_index.bin")
META_PATH = os.path.join(os.path.dirname(__file__), "faiss_meta.pkl")

# ── Enterprise Knowledge Base ──
# Each document has content and role_access metadata
PAGANI_DOCUMENTS = [
    {
        "content": "The Pagani Zonda R is the ultimate track-focused evolution of the Zonda lineage. It was unveiled in 2007 as a pure racing machine not homologated for road use. The Zonda R represents the pinnacle of Pagani's engineering philosophy: art and science in perfect harmony. It was designed by Horacio Pagani and his team at Pagani Automobili in Modena, Italy.",
        "role_access": ["admin", "engineer", "viewer"],
        "source": "Pagani Heritage Archives"
    },
    {
        "content": "The Pagani Zonda R is powered by a naturally aspirated Mercedes-Benz AMG M120 6.0-liter V12 engine, producing 750 horsepower at 7,500 RPM and 710 Nm of torque at 5,700 RPM. The engine is mated to a sequential 6-speed gearbox developed in collaboration with Xtrac. The V12 delivers a linear power curve with instantaneous throttle response, characteristic of naturally aspirated high-performance engines.",
        "role_access": ["admin", "engineer", "viewer"],
        "source": "Engine Technical Specification Sheet"
    },
    {
        "content": "The Zonda R features a carbon-titanium monocoque chassis, a material technology pioneered by Pagani. The monocoque weighs just 68 kg and provides exceptional torsional rigidity of 32,000 Nm/degree. The entire body is constructed from advanced carbon fiber composites, including the floor, roof, and aerodynamic elements. Total dry weight is 1,070 kg, giving a power-to-weight ratio of 701 hp per tonne.",
        "role_access": ["admin", "engineer", "viewer"],
        "source": "Chassis Engineering Report"
    },
    {
        "content": "Aerodynamics: The Zonda R generates over 1,500 kg of downforce at 300 km/h through its advanced aerodynamic package. The front splitter, rear diffuser, and adjustable rear wing work together to create ground-effect downforce. The underbody is fully flat with Venturi tunnels. The drag coefficient is optimized for circuit use rather than top speed. Wind tunnel testing was conducted at Dallara's facility in Varano de' Melegari.",
        "role_access": ["admin", "engineer"],
        "source": "Aerodynamics R&D Report"
    },
    {
        "content": "Performance data: The Pagani Zonda R accelerates from 0-100 km/h in 2.7 seconds, 0-200 km/h in 6.2 seconds, and has a top speed exceeding 350 km/h. It set a lap record at the Nürburgring Nordschleife with a time of 6:47.50 in 2010, making it one of the fastest cars to ever lap the circuit. Braking from 100 km/h to standstill takes just 29 meters.",
        "role_access": ["admin", "engineer", "viewer"],
        "source": "Performance Test Results"
    },
    {
        "content": "The braking system features Brembo carbon-ceramic disc brakes with 380 mm front and 355 mm rear rotors. The calipers are 6-piston units at the front and 4-piston at the rear, painted in the signature Pagani blue. The brake-by-wire system offers adjustable brake bias. The system withstands temperatures up to 1,000°C during sustained track use without fade.",
        "role_access": ["admin", "engineer"],
        "source": "Brake System Technical Manual"
    },
    {
        "content": "The suspension system uses a double-wishbone configuration on all four corners with pushrod-activated Öhlins TTX 4-way adjustable dampers. Anti-roll bars are adjustable front and rear. Ride height, camber, and toe are fully adjustable for circuit optimization. The suspension geometry is derived from Pagani's motorsport program.",
        "role_access": ["admin", "engineer"],
        "source": "Suspension Engineering Documentation"
    },
    {
        "content": "Production and exclusivity: Only 15 units of the Pagani Zonda R were ever produced. Each car is hand-built at the Pagani Atelier in San Cesario sul Panaro, near Modena, Italy. Production began in 2007 and all units were allocated before public announcement. Current estimated market value exceeds €6 million. Original MSRP was approximately €1.5 million.",
        "role_access": ["admin", "engineer", "viewer"],
        "source": "Production Registry"
    },
    {
        "content": "The Zonda R's interior features a minimalist, race-focused cockpit with exposed carbon fiber throughout. The dashboard houses a digital telemetry display, gear position indicator, and essential gauges only. The steering wheel is a removable unit with integrated shift paddles. Seats are fixed-back carbon fiber racing shells with 6-point harnesses. Interior weight was stripped to an absolute minimum — no air conditioning, no infotainment, no sound insulation.",
        "role_access": ["admin", "engineer", "viewer"],
        "source": "Interior Design Specifications"
    },
    {
        "content": "Financial overview: The Pagani Zonda R retailed at €1.5 million excluding local taxes and duties. Maintenance costs for the engine service alone exceed €25,000. A complete carbon-ceramic brake set replacement costs approximately €35,000. Annual insurance premiums range from €40,000 to €80,000 depending on jurisdiction. The Zonda R has appreciated in value by approximately 300% since its original sale, with recent auction prices exceeding €6 million.",
        "role_access": ["admin"],
        "source": "Financial & Ownership Report"
    },
    {
        "content": "The Zonda R uses Pirelli P Zero slick tires specifically developed for this car: 265/645 R19 front and 335/705 R20 rear. Magnesium APP forged wheels save 12 kg over aluminum equivalents. Tire operational temperature range is 80-110°C for optimal grip. The car features a central locking nut wheel design derived from Formula 1 technology.",
        "role_access": ["admin", "engineer"],
        "source": "Tire & Wheel Technical Sheet"
    },
    {
        "content": "The exhaust system is constructed entirely from Inconel 625 superalloy, the same material used in Formula 1 and aerospace applications. The quad-exit exhaust produces the Zonda R's iconic sound signature, measured at 120 dB at full throttle. The exhaust system weighs only 5.8 kg total. Headers are equal-length for optimal exhaust gas scavenging and power delivery.",
        "role_access": ["admin", "engineer", "viewer"],
        "source": "Exhaust System Engineering Report"
    },
]


# import moved to top

class VectorStore:
    """FAISS-based vector store with Gemini embeddings and role-based filtering."""

    def __init__(self):
        self.documents = PAGANI_DOCUMENTS
        self.index: faiss.IndexFlatIP | None = None
        self.embeddings: np.ndarray | None = None
        self.dimension: int | None = None
        self.bm25_index = None
        self._initialized = False
        self._lock = threading.Lock()  # Thread safety for FAISS read/write

    def initialize(self):
        """Load from persistence or build fresh index."""
        if self._initialized:
            return

        if os.path.exists(INDEX_PATH) and os.path.exists(META_PATH):
            try:
                logger.info("Loading persisted FAISS index from disk...")
                self.index = faiss.read_index(INDEX_PATH)
                with open(META_PATH, "rb") as f:
                    meta = pickle.load(f)
                self.embeddings = meta["embeddings"]
                self.dimension = meta["dimension"]
                self.documents = meta["documents"]

                # Load BM25 if exists
                bm25_path = os.path.join(os.path.dirname(__file__), "bm25_index.pkl")
                if os.path.exists(bm25_path):
                    with open(bm25_path, "rb") as f:
                        self.bm25_index = pickle.load(f)
                else:
                    # Rebuild if missing
                    if BM25Okapi is not None:
                        tokenized_corpus = []
                        for doc in self.documents:
                            text = doc.get("content", "")
                            heading = doc.get("heading_path", "")
                            tokenized_corpus.append(self._tokenize(f"{heading} {text}".strip()))
                        self.bm25_index = BM25Okapi(tokenized_corpus)

                self._initialized = True
                logger.info(
                    f"Loaded FAISS index: {self.index.ntotal}"
                    f" vectors, dim={self.dimension}")
                return
            except Exception as e:
                logger.warning(f"Failed to load persisted index, rebuilding: {e}")

        self._build_index()
        self._initialized = True

    def needs_pdf_ingestion(self) -> bool:
        """Check if PDFs have already been ingested into the documents."""
        if not self._initialized:
            # We can't know for sure without initializing, but if there's no persisted index,
            # we will build a fresh one from hardcoded docs, which means NO pdfs are in it.
            if not (os.path.exists(INDEX_PATH) and os.path.exists(META_PATH)):
                # If the PDF dataset folder isn't even present (e.g., on Render deployment),
                # do not attempt to ingest anything to save Gemini Quota and prevent crashes.
                pdf_dir = os.path.join(
                    os.path.dirname(__file__),
                    "..",
                    "pagani_intelligence_rich_dataset_25_pdfs")
                if not os.path.exists(pdf_dir):
                    return False
                return True
            self.initialize()

        return not any(doc.get("is_pdf") for doc in self.documents)

    def ingest_pdf_chunks(self, chunks: list[dict]):
        """Add new PDF chunks to the vector store and rebuild the index."""
        if not chunks:
            return

        logger.info(f"Ingesting {len(chunks)} PDF chunks into vector store...")
        self.documents.extend(chunks)

        # We need to rebuild the entire index because adding to flat index dynamically
        # with new embeddings is possible, but _build_index() is cleaner and rebuilds embeddings
        # Wait, embedding everything every time is slow. Let's just embed the new
        # chunks and add them.

        if self.embeddings is None or self.index is None:
            self._build_index()
        else:
            # Embed only the new chunks
            # Embed only the new chunks, fusing heading context into the embedding text
            new_texts = []
            for doc in chunks:
                base_text = doc.get("content", doc.get("text", ""))
                heading = doc.get("heading_path", "")
                keywords = " ".join(doc.get("metadata", {}).get("keywords", []))

                context_fused = base_text
                if heading or keywords:
                    context_fused = f"Heading: {heading}\nKeywords: {keywords}\n\n{base_text}"
                new_texts.append(context_fused)

            new_embeddings = self._embed_texts(new_texts)

            # Normalize new embeddings
            faiss.normalize_L2(new_embeddings)

            # Append to embeddings array
            self.embeddings = np.vstack((self.embeddings, new_embeddings))

            # Add to FAISS index
            self.index.add(new_embeddings)

            # Rebuild BM25 for the entire corpus Incorporating Headers
            if BM25Okapi is not None:
                tokenized_corpus = []
                for doc in self.documents:
                    text = doc.get("content", "")
                    heading = doc.get("heading_path", "")
                    tokenized_corpus.append(self._tokenize(f"{heading} {text}".strip()))
                self.bm25_index = BM25Okapi(tokenized_corpus)

            self._persist()
            logger.info(f"FAISS index updated: {self.index.ntotal} vectors total")

    def ingest_document(self, filename: str, content: bytes):
        """Extract text from a file (PDF/Text) and ingest into the vector store."""
        import io
        ext = os.path.splitext(filename)[1].lower()
        text = ""
        try:
            if ext == ".pdf":
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(content))
                for page in reader.pages:
                    text += (page.extract_text() or "") + "\n"
            elif ext in [".docx"]:
                import docx
                doc = docx.Document(io.BytesIO(content))
                text = "\n".join([p.text for p in doc.paragraphs])
            else:
                text = content.decode("utf-8", errors="ignore")
        except Exception as e:
            logger.error(f"Failed to extract text from {filename}: {e}")
            return filename

        if not text.strip():
            logger.warning(f"No text extracted from {filename}")
            return filename

        # Split into chunks of ~2000 chars
        chunks = []
        chunk_size = 2000
        for i in range(0, len(text), chunk_size):
            chunk_text = text[i:i + chunk_size]
            chunks.append({
                "content": chunk_text,
                "role_access": ["admin", "engineer", "viewer"],
                "source": filename,
                "is_pdf": ext == ".pdf",
                "doc_id": filename,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "metadata": {"chunk": i // chunk_size, "filename": filename}
            })

        self.ingest_pdf_chunks(chunks)
        return filename

    def _embed_texts(self, texts: list[str]) -> np.ndarray:
        """Embed a list of texts using Gemini text-embedding-004."""
        logger.info(f"Embedding {len(texts)} texts via Gemini API sequentially...")
        import time
        all_embeddings = []
        for i, text in enumerate(texts):
            for attempt in range(5):
                try:
                    result = genai.embed_content(
                        model=EMBEDDING_MODEL,
                        content=text,
                        task_type="retrieval_document",
                    )
                    batch_emb = np.array(result["embedding"], dtype=np.float32)
                    if batch_emb.ndim == 1:
                        batch_emb = batch_emb.reshape(1, -1)
                    all_embeddings.append(batch_emb)
                    # Tiny sleep to respect free-tier rate limits
                    time.sleep(1)
                    break
                except Exception as e:
                    if "429" in str(e) and attempt < 4:
                        wait = (attempt + 1) * 3
                        logger.warning(f"Rate limited on doc {i + 1}. Retrying in {wait}s...")
                        time.sleep(wait)
                    else:
                        logger.error(f"Embedding generation failed on doc {i + 1}: {e}")
                        raise RuntimeError(f"Failed to generate embeddings: {e}")

        embeddings = np.vstack(all_embeddings) if len(all_embeddings) > 1 else all_embeddings[0]
        logger.info(f"Embedded {len(texts)} total texts, shape: {embeddings.shape}")
        return embeddings

    def _embed_query(self, query: str) -> np.ndarray:
        """Embed a single query using Gemini text-embedding-004."""
        try:
            result = genai.embed_content(
                model=EMBEDDING_MODEL,
                content=query,
                task_type="retrieval_query",
            )
            embedding = np.array(result["embedding"], dtype=np.float32).reshape(1, -1)
            return embedding
        except Exception as e:
            logger.error(f"Query embedding failed: {e}")
            raise RuntimeError(f"Failed to embed query: {e}")

    def _build_index(self):
        """Build FAISS index from documents and persist to disk."""
        logger.info("Building FAISS index from scratch...")

        # Ensure documents are initialized
        if not self.documents:
            self.documents = PAGANI_DOCUMENTS

        texts_to_embed = []
        for doc in self.documents:
            base_text = doc.get("content", doc.get("text", ""))
            heading = doc.get("heading_path", "")
            keywords = " ".join(doc.get("metadata", {}).get("keywords", []))

            context_fused = base_text
            if heading or keywords:
                context_fused = f"Heading: {heading}\nKeywords: {keywords}\n\n{base_text}"
            texts_to_embed.append(context_fused)

        self.embeddings = self._embed_texts(texts_to_embed)

        # Dynamic dimension detection
        self.dimension = self.embeddings.shape[1]
        logger.info(f"Detected embedding dimension: {self.dimension}")

        # Normalize for cosine similarity
        faiss.normalize_L2(self.embeddings)

        # Build index
        self.index = faiss.IndexFlatIP(self.dimension)
        self.index.add(self.embeddings)
        logger.info(f"FAISS index built: {self.index.ntotal} vectors")

        # Persist
        self._persist()

    def _persist(self):
        """Save FAISS and BM25 indexes and metadata to disk."""
        try:
            faiss.write_index(self.index, INDEX_PATH)
            with open(META_PATH, "wb") as f:
                pickle.dump({
                    "embeddings": self.embeddings,
                    "dimension": self.dimension,
                    "documents": self.documents,
                }, f)
            logger.info("FAISS index persisted to disk.")

            # Rebuild and persist BM25 index over the entire synchronized corpus
            if BM25Okapi is not None:
                tokenized_corpus = []
                for doc in self.documents:
                    text = doc.get("content", "")
                    heading = doc.get("heading_path", "")
                    tokenized_corpus.append(self._tokenize(f"{heading} {text}".strip()))
                self.bm25_index = BM25Okapi(tokenized_corpus)
                bm25_path = os.path.join(os.path.dirname(__file__), "bm25_index.pkl")
                with open(bm25_path, "wb") as f:
                    pickle.dump(self.bm25_index, f)
                logger.info(f"BM25 index rebuilt and persisted for {len(self.documents)} chunks.")
            else:
                logger.warning("rank_bm25 is not installed. Skipping BM25 index generation.")

        except Exception as e:
            logger.error(f"Failed to persist indexes: {e}")

    def _tokenize(self, text: str) -> list[str]:
        """Tokenize text for BM25. Includes basic expansion for common terms like price/pricing."""
        tokens = re.findall(r'\w+', text.lower())
        # Basic expansion for pricing/price
        if 'pricing' in tokens and 'price' not in tokens:
            tokens.append('price')
        elif 'price' in tokens and 'pricing' not in tokens:
            tokens.append('pricing')
        return tokens

    def _keyword_search(self, query: str, user_role: str, top_k: int) -> list[dict]:
        """Simple TF keyword search."""
        query_tokens = set(self._tokenize(query))
        if not query_tokens:
            return []

        results = []
        for i, doc in enumerate(self.documents):
            if user_role not in doc.get("role_access", ["viewer", "seller", "admin"]):
                continue

            doc_tokens = self._tokenize(doc["content"])
            # Calculate simple TF score based on token overlap
            score = 0
            for token in query_tokens:
                score += doc_tokens.count(token)

            if score > 0:
                results.append({"idx": i, "score": score, "doc": doc})

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    def _get_semantic_score(self, faiss_distance: float) -> float:
        """Convert FAISS L2 distance to a 0-100 confidence score."""
        # FAISS L2 with normalized vectors ranges from 0.0 to 2.0 (0.0 is perfect).
        # We assume distances > 1.2 are largely irrelevant.
        confidence = max(0.0, 1.0 - (float(faiss_distance) / 1.25))
        return confidence * 100.0

    def _llm_rerank(self, query: str, candidates: list[dict], top_k: int) -> list[dict]:
        try:
            prompt = f"Given the user query: '{query}'\n\n"
            prompt += "Score each document chunk based on its direct relevance to the query. "
            prompt += "Use a scale of 0 to 100 (0=Irrelevant, 50=Partial Match, 100=Perfect Answer).\n"
            prompt += "Return ONLY a JSON array of integers, where the i-th integer is the score for [Chunk i].\n\n"

            for i, cand in enumerate(candidates):
                content = cand['doc']['content'][:600].replace('\n', ' ')
                prompt += f"[Chunk {i}]: {content}...\n\n"

            for attempt in range(2):
                try:
                    response = client.chat.completions.create(
                        model="llama-3.1-8b-instant",
                        messages=[{"role": "user", "content": prompt}],
                    )
                    text = response.choices[0].message.content.strip()
                    logger.debug(f"LLM Rerank Raw Response: {text}")

                    # Robust parsing: Extract digits from the response if it's not a clean JSON
                    import re
                    scores = []

                    if "[" in text and "]" in text:
                        # Try to extract the array part
                        array_str = text[text.find("["):text.rfind("]") + 1]
                        try:
                            scores = json.loads(array_str)
                        except Exception:
                            # Fallback re-parse
                            scores = [int(s) for s in re.findall(r"\d+", array_str)]
                    else:
                        # Fallback try to find any numbers
                        scores = [int(s) for s in re.findall(r"\d+", text)]

                    if len(scores) < len(candidates):
                        logger.warning(
                            f"Reranker returned {len(scores)} scores"
                            f" for {len(candidates)} candidates."
                            " Padding...")
                        scores.extend([0] * (len(candidates) - len(scores)))

                    # Map scores back to candidates
                    for cand, score in zip(candidates, scores):
                        llm_score = float(score)
                        # Safety fallback: if LLM returns < 10 but semantic distance is low, use
                        # semantic boost
                        if llm_score < 10.0 and cand.get('dist', 2.0) < 0.8:
                            semantic_boost = max(0.0, 1.0 - (cand.get('dist', 2.0) / 1.2)) * 100.0
                            cand['score'] = max(llm_score, semantic_boost)
                        else:
                            cand['score'] = llm_score

                    # Sort and log
                    candidates.sort(key=lambda x: x['score'], reverse=True)
                    top_scores = [c['score'] for c in candidates[:5]]
                    logger.info(f"LLM Reranking (Success). Top scores: {top_scores}")
                    return candidates[:top_k]

                except Exception as e:
                    if attempt == 0:
                        logger.warning(f"Reranking attempt 1 failed: {e}. Retrying...")
                        continue
                    raise e

        except Exception as e:
            logger.error(f"LLM Reranking failed completely: {e}")
            # Fallback to Semantic scores scaled to 0-100
            for cand in candidates:
                cand['score'] = self._get_semantic_score(cand['score'])

            candidates.sort(key=lambda x: x['score'], reverse=True)
            top_scores = [round(c['score'], 1) for c in candidates[:5]]
            logger.info(f"Reranking Fallback (Semantic). Top scores: {top_scores}")
            return candidates[:top_k]

    def search(self, query: str, top_k: int = 5, user_role: str = "viewer",
               filters: dict = None) -> list[dict]:
        """
        Semantic search with Gen-2 features: Role filtering, Metadata filters, and LLM Reranking.
        """
        if not self._initialized:
            self.initialize()

        search_k = min(20, self.index.ntotal)

        # --- 1. Semantic Search (FAISS) ---
        query_embedding = self._embed_query(query)
        faiss.normalize_L2(query_embedding)

        # Search more than top_k to allow for filtering
        search_k = min(top_k * 3, self.index.ntotal)
        scores, indices = self.index.search(query_embedding, search_k)

        semantic_results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:
                continue
            doc = self.documents[idx]

            # 1a. Filter by Role
            if user_role not in doc.get("role_access", ["viewer", "seller", "admin"]):
                continue

            # 1b. Filter by Metadata (if any)
            if filters:
                match = True
                for k, v in filters.items():
                    # Check if 'Zonda' is in source file name, for example
                    if k == "model" and v.lower() not in doc["source"].lower():
                        match = False
                if not match:
                    continue

            semantic_results.append({"idx": idx, "score": float(score), "doc": doc})

        # --- 2. Keyword Search ---
        keyword_results = self._keyword_search(query, user_role, search_k)

        # --- 3. Reciprocal Rank Fusion (RRF) ---
        # k = 60 is standard in RRF
        rrf_k = 60
        fused_scores = {}

        # Rank semantic results
        for rank, res in enumerate(semantic_results):
            fused_scores[res["idx"]] = fused_scores.get(res["idx"], 0) + 1.0 / (rrf_k + rank + 1)

        # Rank keyword results
        for rank, res in enumerate(keyword_results):
            fused_scores[res["idx"]] = fused_scores.get(res["idx"], 0) + 1.0 / (rrf_k + rank + 1)

        # Sort by fused score
        fused_results = sorted(list(fused_scores.items()), key=lambda x: x[1], reverse=True)

        # Build candidate list for reranking
        candidates = []
        for idx, _ in fused_results[:search_k]:
            candidates.append({"idx": idx, "doc": self.documents[idx], "score": 0.0})

        # --- 4. LLM Cross-Encoder Reranking ---
        reranked_results = self._llm_rerank(query, candidates, top_k=top_k)

        # Build final returning list
        final_results = []
        for res in reranked_results:
            doc = res["doc"]
            final_results.append({
                "content": doc.get("content", doc.get("text", "")),
                "source": doc.get("source", "Unknown"),
                "uploaded_by": doc.get("uploaded_by", "System"),
                "score": res["score"],  # This is now an LLM confidence score (0-100)
                "doc_id": doc.get("doc_id", doc.get("document_id")),
            })

        logger.info(
            f"Gen-2 Hybrid search query='{query[:50]}...' role={user_role} "
            f"returned {len(final_results)} reranked results"
        )
        return final_results

    def search_with_debug(self, query: str, top_k: int = 5,
                          user_role: str = "viewer", filters: dict = None) -> dict:
        """
        Debug-enhanced search that returns results + full pipeline trace.
        Does NOT modify the core search logic — wraps the same calls with timing.
        """
        import time as _time

        debug_info = {
            "pipeline_steps": [],
            "search_results": [],
            "retrieved_chunks": [],
            "timing": {},
            "router_decision": None,
        }

        t_start = _time.time()

        # Step 1: Embed query
        debug_info["pipeline_steps"].append({
            "step": "query_received", "label": "Query Received",
            "timestamp_ms": 0
        })

        t_embed = _time.time()
        if not self._initialized:
            self.initialize()

        query_embedding = self._embed_query(query)
        faiss.normalize_L2(query_embedding)
        embed_ms = int((_time.time() - t_embed) * 1000)

        debug_info["pipeline_steps"].append({
            "step": "query_embedded", "label": "Query Embedded",
            "timestamp_ms": int((_time.time() - t_start) * 1000)
        })
        debug_info["timing"]["embedding_ms"] = embed_ms

        # Step 2: FAISS + keyword search
        t_search = _time.time()
        search_k = min(top_k * 3, self.index.ntotal)
        scores, indices = self.index.search(query_embedding, search_k)

        semantic_results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:
                continue
            doc = self.documents[idx]
            if user_role not in doc["role_access"]:
                continue
            if filters:
                match = True
                for k, v in filters.items():
                    if k == "model" and v.lower() not in doc["source"].lower():
                        match = False
                if not match:
                    continue
            semantic_results.append({"idx": idx, "score": float(score), "doc": doc})

        keyword_results = self._keyword_search(query, user_role, search_k)
        search_ms = int((_time.time() - t_search) * 1000)

        debug_info["pipeline_steps"].append({
            "step": "vector_search", "label": "Vector Search Performed",
            "timestamp_ms": int((_time.time() - t_start) * 1000)
        })
        debug_info["timing"]["search_ms"] = search_ms

        # Collect raw search results for debug display
        for res in semantic_results[:10]:
            debug_info["search_results"].append({
                "source": res["doc"]["source"],
                "similarity": round(res["score"], 4),
                "chunk_preview": res["doc"]["content"][:150].replace("\n", " ")
            })

        # Step 3: RRF fusion
        rrf_k = 60
        fused_scores = {}
        for rank, res in enumerate(semantic_results):
            fused_scores[res["idx"]] = fused_scores.get(res["idx"], 0) + 1.0 / (rrf_k + rank + 1)
        for rank, res in enumerate(keyword_results):
            fused_scores[res["idx"]] = fused_scores.get(res["idx"], 0) + 1.0 / (rrf_k + rank + 1)

        fused_results = sorted(list(fused_scores.items()), key=lambda x: x[1], reverse=True)
        candidates = []
        for idx, _ in fused_results[:search_k]:
            candidates.append({"idx": idx, "doc": self.documents[idx], "score": 0.0})

        # Step 4: LLM reranking
        t_rerank = _time.time()
        reranked_results = self._llm_rerank(query, candidates, top_k=top_k)
        rerank_ms = int((_time.time() - t_rerank) * 1000)

        debug_info["pipeline_steps"].append({
            "step": "reranking", "label": "LLM Reranking",
            "timestamp_ms": int((_time.time() - t_start) * 1000)
        })
        debug_info["timing"]["reranking_ms"] = rerank_ms

        # Build final results + debug chunks
        final_results = []
        for res in reranked_results:
            doc = res["doc"]
            final_results.append({
                "content": doc["content"],
                "source": doc["source"],
                "score": res["score"],
            })
            debug_info["retrieved_chunks"].append({
                "source": doc["source"],
                "content": doc["content"][:600],
                "relevance_score": res["score"],
            })

        debug_info["pipeline_steps"].append({
            "step": "context_built", "label": "Context Constructed",
            "timestamp_ms": int((_time.time() - t_start) * 1000)
        })

        return {"results": final_results, "debug": debug_info, "_t_start": t_start}

    # ── Source-to-PDF mapping ──
    _SOURCE_PDF_MAP = {
        "Pagani Heritage Archives": "pagani_intelligence_brand_history.pdf",
        "Engine Technical Specification Sheet": "pagani_intelligence_amg_v12_powertrain.pdf",
        "Chassis Engineering Report": "pagani_intelligence_zonda_engineering.pdf",
        "Aerodynamics R&D Report": "pagani_intelligence_aerodynamics.pdf",
        "Performance Test Results": "pagani_intelligence_vehicle_testing.pdf",
        "Brake System Technical Manual": "pagani_intelligence_brake_engineering.pdf",
        "Suspension Engineering Documentation": "pagani_intelligence_suspension_systems.pdf",
        "Production Registry": "pagani_intelligence_manufacturing_process.pdf",
        "Interior Design Specifications": "pagani_intelligence_interior_craftsmanship.pdf",
        "Financial & Ownership Report": "pagani_intelligence_collector_value.pdf",
        "Tire & Wheel Technical Sheet": "pagani_intelligence_transmission_systems.pdf",
        "Exhaust System Engineering Report": "pagani_intelligence_cooling_systems.pdf",
    }

    def _extract_pdf_text(self, pdf_path: str) -> str:
        """Extract full text from a PDF file using pymupdf."""
        try:
            import fitz  # pymupdf
            doc = fitz.open(pdf_path)
            pages = []
            for page in doc:
                pages.append(page.get_text())
            doc.close()
            return "\n\n".join(pages).strip()
        except Exception as e:
            logger.warning(f"pymupdf extraction failed for {pdf_path}: {e}")
            # Fallback to pypdf
            try:
                from pypdf import PdfReader
                reader = PdfReader(pdf_path)
                pages = []
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        pages.append(text)
                return "\n\n".join(pages).strip()
            except Exception as e2:
                logger.error(f"All PDF extraction failed for {pdf_path}: {e2}")
                return ""

    def _find_pdf_path(self, source_name: str) -> str | None:
        """Find the PDF file path for a given document source name."""
        pdf_dir = os.path.join(
            os.path.dirname(__file__),
            "..",
            "pagani_intelligence_rich_dataset_25_pdfs")
        if not os.path.exists(pdf_dir):
            return None

        # 1. Check explicit mapping
        mapped = self._SOURCE_PDF_MAP.get(source_name)
        if mapped:
            path = os.path.join(pdf_dir, mapped)
            if os.path.exists(path):
                return path

        # 2. Fuzzy match by keyword overlap
        source_lower = source_name.lower().replace(" ", "_").replace("&", "and")
        source_words = set(re.findall(r'\w+', source_lower))

        for fname in os.listdir(pdf_dir):
            if not fname.endswith(".pdf"):
                continue
            fname_lower = fname.lower().replace("pagani_intelligence_", "").replace(".pdf", "")
            fname_words = set(fname_lower.split("_"))
            overlap = source_words & fname_words
            if len(overlap) >= 2:
                return os.path.join(pdf_dir, fname)

        return None

    def delete_document(self, doc_id: str) -> bool:
        """Remove a document and its vectors from the store."""
        if not self._initialized:
            self.initialize()

        with self._lock:
            # 1. Find indices of chunks for this doc
            indices_to_remove = []
            new_docs = []
            for i, doc in enumerate(self.documents):
                # Match by explicit doc_id or by source filename
                if doc.get("doc_id") == doc_id or doc.get("source") == doc_id:
                    indices_to_remove.append(i)
                else:
                    new_docs.append(doc)

            if not indices_to_remove:
                logger.warning(f"No chunks found in VectorStore for doc_id: {doc_id}")
                return False

            # 2. Update documents list
            self.documents = new_docs

            # 3. Update FAISS index
            if self.embeddings is not None and len(self.embeddings) > 0:
                # Remove from embeddings array using boolean mask
                mask = np.ones(len(self.embeddings), dtype=bool)
                # Ensure indices are within bounds
                valid_indices = [idx for idx in indices_to_remove if idx < len(mask)]
                mask[valid_indices] = False
                self.embeddings = self.embeddings[mask]

                # Rebuild FAISS index from remaining embeddings
                if len(self.embeddings) > 0:
                    self.index = faiss.IndexFlatIP(self.dimension)
                    # Create a copy to ensure memory alignment for FAISS
                    emb_copy = np.ascontiguousarray(self.embeddings)
                    faiss.normalize_L2(emb_copy)
                    self.index.add(emb_copy)
                    self.embeddings = emb_copy
                else:
                    self.index = None
                    self.embeddings = None

            # 4. Rebuild BM25
            if BM25Okapi is not None and self.documents:
                tokenized_corpus = []
                for doc in self.documents:
                    text = doc.get("content", "")
                    heading = doc.get("heading_path", "")
                    tokenized_corpus.append(self._tokenize(f"{heading} {text}".strip()))
                self.bm25_index = BM25Okapi(tokenized_corpus)
            else:
                self.bm25_index = None

            # 5. Persist the updated state
            self._persist()
            logger.info(
                f"Deleted document {doc_id} from vector store"
                f" ({len(indices_to_remove)} chunks removed)")
            return True

    def get_document(self, doc_id: str) -> dict | None:
        """Retrieve a full document: extracts full text from the original PDF if available."""
        if not self._initialized:
            self.initialize()

        # Step 1: Find the source name for this doc_id
        target_source = None
        for i, doc in enumerate(self.documents):
            if doc.get("doc_id") == doc_id or doc.get("source") == doc_id or str(i) == doc_id:
                target_source = doc.get("source", doc_id)
                break

        if target_source is None:
            return None

        # Step 2: Try to find and extract the original PDF
        pdf_path = self._find_pdf_path(target_source)
        pdf_filename = os.path.basename(pdf_path) if pdf_path else None

        if pdf_path:
            full_content = self._extract_pdf_text(pdf_path)
            file_size = os.path.getsize(pdf_path)
        else:
            # Fallback: aggregate all chunks with this source
            chunk_texts = []
            for doc in self.documents:
                if doc.get("source") == target_source:
                    chunk_texts.append(doc.get("content", ""))
            full_content = "\n\n".join(chunk_texts)
            file_size = len(full_content)

        return {
            "id": doc_id,
            "filename": target_source,
            "type": "PDF" if pdf_path else "SPEC",
            "content": full_content,
            "file_size": file_size,
            "upload_date": "2026-04-01T10:00:00Z",
            "pdf_filename": pdf_filename,
        }


def embed_query(query: str) -> np.ndarray:
    """Standalone query embedding using Gemini (for use by other modules)."""
    try:
        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=query,
            task_type="retrieval_query",
        )
        return np.array(result["embedding"], dtype=np.float32).reshape(1, -1)
    except Exception as e:
        logger.error(f"Query embedding failed: {e}")
        return None


# Singleton instance
vector_store = VectorStore()
