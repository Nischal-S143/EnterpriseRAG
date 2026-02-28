"""
Pagani Zonda R – Vector Store with FAISS + Gemini Embeddings
Handles document storage, embedding, persistence, and role-based search.
"""

import os
import pickle
import logging
import numpy as np
import faiss
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("pagani.vector_store")

# ── Gemini Configuration ──
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
EMBEDDING_MODEL = "models/gemini-embedding-001"

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


class VectorStore:
    """FAISS-based vector store with Gemini embeddings and role-based filtering."""

    def __init__(self):
        self.documents = PAGANI_DOCUMENTS
        self.index: faiss.IndexFlatIP | None = None
        self.embeddings: np.ndarray | None = None
        self.dimension: int | None = None
        self._initialized = False

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
                self._initialized = True
                logger.info(f"Loaded FAISS index: {self.index.ntotal} vectors, dim={self.dimension}")
                return
            except Exception as e:
                logger.warning(f"Failed to load persisted index, rebuilding: {e}")

        self._build_index()
        self._initialized = True

    def _embed_texts(self, texts: list[str]) -> np.ndarray:
        """Embed a list of texts using Gemini text-embedding-004."""
        try:
            result = genai.embed_content(
                model=EMBEDDING_MODEL,
                content=texts,
                task_type="retrieval_document",
            )
            embeddings = np.array(result["embedding"], dtype=np.float32)
            if embeddings.ndim == 1:
                embeddings = embeddings.reshape(1, -1)
            logger.info(f"Embedded {len(texts)} texts, shape: {embeddings.shape}")
            return embeddings
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise RuntimeError(f"Failed to generate embeddings: {e}")

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
        texts = [doc["content"] for doc in self.documents]
        self.embeddings = self._embed_texts(texts)

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
        """Save FAISS index and metadata to disk."""
        try:
            faiss.write_index(self.index, INDEX_PATH)
            with open(META_PATH, "wb") as f:
                pickle.dump({
                    "embeddings": self.embeddings,
                    "dimension": self.dimension,
                    "documents": self.documents,
                }, f)
            logger.info("FAISS index persisted to disk.")
        except Exception as e:
            logger.error(f"Failed to persist FAISS index: {e}")

    def search(self, query: str, top_k: int = 3, user_role: str = "viewer") -> list[dict]:
        """
        Semantic search with role-based document filtering.
        Returns list of {content, source, score}.
        """
        if not self._initialized:
            self.initialize()

        # Embed and normalize query
        query_embedding = self._embed_query(query)
        faiss.normalize_L2(query_embedding)

        # Search more than top_k to allow for filtering
        search_k = min(top_k * 3, self.index.ntotal)
        scores, indices = self.index.search(query_embedding, search_k)

        # Filter by role access
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:
                continue
            doc = self.documents[idx]
            if user_role in doc["role_access"]:
                results.append({
                    "content": doc["content"],
                    "source": doc["source"],
                    "score": float(score),
                })
            if len(results) >= top_k:
                break

        logger.info(
            f"Search query='{query[:50]}...' role={user_role} "
            f"returned {len(results)} results"
        )
        return results


# Singleton instance
vector_store = VectorStore()
