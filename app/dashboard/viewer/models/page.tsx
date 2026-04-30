"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import ViewerTopbar from "@/components/viewer/ViewerTopbar";
import TopicPreferencesModal from "@/components/viewer/TopicPreferencesModal";
import { getUserScopedKey } from "@/lib/auth";

interface ModelCard {
  name: string;
  role: string;
  description: string;
  specs: { label: string; value: string }[];
  accentColor: string;
  icon: React.ReactNode;
}

const models: ModelCard[] = [
  {
    name: "SentenceTransformer",
    role: "Embedding Engine",
    description:
      "The all-MiniLM-L6-v2 model generates dense vector embeddings from text chunks, enabling semantic similarity search across the entire document corpus.",
    specs: [
      { label: "Architecture", value: "BERT (MiniLM)" },
      { label: "Dimensions", value: "384" },
      { label: "Max Tokens", value: "256" },
      { label: "Latency", value: "~15ms/query" },
    ],
    accentColor: "rgba(59, 130, 246, 0.8)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
  },
  {
    name: "Gemini Flash",
    role: "Generative LLM",
    description:
      "Google's Gemini 2.0 Flash powers the conversational AI layer. It receives retrieved context chunks and synthesizes coherent, citation-backed answers in real time via SSE streaming.",
    specs: [
      { label: "Provider", value: "Google AI" },
      { label: "Context Window", value: "1M tokens" },
      { label: "Streaming", value: "SSE" },
      { label: "Temperature", value: "0.3" },
    ],
    accentColor: "rgba(212, 175, 55, 0.8)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    name: "ChromaDB",
    role: "Vector Store",
    description:
      "A persistent vector database that stores and retrieves document embeddings with millisecond latency. All uploaded PDFs are chunked, embedded, and indexed here.",
    specs: [
      { label: "Type", value: "Persistent" },
      { label: "Distance", value: "Cosine" },
      { label: "Top-K", value: "5" },
      { label: "Storage", value: "Local Disk" },
    ],
    accentColor: "rgba(16, 185, 129, 0.8)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
  {
    name: "FastAPI",
    role: "API Framework",
    description:
      "The backend orchestration layer. Handles authentication, document management, RAG pipeline execution, and real-time SSE streaming with async Python.",
    specs: [
      { label: "Runtime", value: "Python 3.13" },
      { label: "Auth", value: "JWT + RBAC" },
      { label: "DB", value: "SQLite + SA" },
      { label: "Workers", value: "Uvicorn" },
    ],
    accentColor: "rgba(139, 92, 246, 0.8)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
];

export default function ModelShowcasePage() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [topicPreferences, setTopicPreferences] = useState<string[]>([]);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const handleSaveTopics = (topics: string[]) => {
    setTopicPreferences(topics);
    if (typeof window !== "undefined") {
      localStorage.setItem(getUserScopedKey("viewer_topic_prefs"), JSON.stringify(topics));
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0a] overflow-hidden text-gray-200">
      <ViewerTopbar onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="flex-1 overflow-y-auto w-full max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-12 border-b border-white/[0.06] pb-6">
          <h1
            className="text-3xl font-bold text-white tracking-wide flex items-center gap-3"
            style={{ fontFamily: "var(--font-orbitron)" }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-pagani-gold" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
            Model Showcase
          </h1>
          <p className="text-sm text-gray-400 mt-2 max-w-xl">
            The AI stack powering Pagani Intelligence. Hover over each component to explore its architecture.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {models.map((model, idx) => (
            <motion.div
              key={model.name}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="group relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:bg-white/[0.03] transition-all overflow-hidden"
            >
              {/* Glow accent */}
              <div
                className="absolute top-0 left-0 w-full h-1 transition-opacity duration-300"
                style={{
                  background: `linear-gradient(90deg, transparent, ${model.accentColor}, transparent)`,
                  opacity: hoveredIdx === idx ? 1 : 0.3,
                }}
              />

              {/* Icon + Title */}
              <div className="flex items-start gap-4 mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center border transition-all"
                  style={{
                    borderColor: hoveredIdx === idx ? model.accentColor : "rgba(255,255,255,0.06)",
                    background: hoveredIdx === idx ? `${model.accentColor.replace("0.8", "0.1")}` : "rgba(255,255,255,0.02)",
                    color: model.accentColor,
                  }}
                >
                  {model.icon}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{model.name}</h3>
                  <span
                    className="text-[10px] uppercase tracking-[0.15em] font-bold mt-0.5 block"
                    style={{ color: model.accentColor }}
                  >
                    {model.role}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-gray-400 leading-relaxed mb-5">
                {model.description}
              </p>

              {/* Specs grid */}
              <div className="grid grid-cols-2 gap-2">
                {model.specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                  >
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider">{spec.label}</div>
                    <div className="text-xs text-gray-200 font-medium mt-0.5">{spec.value}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* RAG Pipeline diagram */}
        <div className="mt-12 p-6 rounded-2xl border border-white/[0.06] bg-white/[0.015]">
          <h3 className="text-sm font-bold text-pagani-gold uppercase tracking-[0.15em] mb-6" style={{ fontFamily: "var(--font-orbitron)" }}>
            RAG Pipeline Flow
          </h3>
          <div className="flex items-center justify-between gap-2 px-4">
            {["User Query", "Embedding", "Vector Search", "Context Assembly", "LLM Generation", "Streamed Answer"].map(
              (step, i) => (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-pagani-gold/10 border border-pagani-gold/20 flex items-center justify-center text-pagani-gold text-xs font-bold">
                      {i + 1}
                    </div>
                    <span className="text-[9px] text-gray-400 text-center uppercase tracking-wider max-w-[70px]">
                      {step}
                    </span>
                  </div>
                  {i < 5 && (
                    <div className="flex-1 h-[1px] bg-gradient-to-r from-pagani-gold/30 to-pagani-gold/10" />
                  )}
                </React.Fragment>
              )
            )}
          </div>
        </div>
      </main>

      <TopicPreferencesModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedTopics={topicPreferences}
        onSave={handleSaveTopics}
      />
    </div>
  );
}
