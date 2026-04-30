"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { SkeletonCard } from "./SkeletonCard";
import ErrorBanner from "./ErrorBanner";

interface Document {
  id: string;
  filename: string;
  type: string;
  pages?: number;
  created_at?: string;
}

// Fallback mock data
// TODO: replace with real API — GET /api/documents?role=viewer&limit=4&sort=recent
const MOCK_DOCS: Document[] = [
  { id: "doc_1", filename: "Pagani_Zonda_R_Technical_Manual.pdf", type: "PDF", pages: 45, created_at: "2026-04-08T10:00:00Z" },
  { id: "doc_2", filename: "Huayra_BC_Spec_Sheet.pdf", type: "SPEC", pages: 12, created_at: "2026-04-07T14:30:00Z" },
  { id: "doc_3", filename: "Utopia_Press_Release.pdf", type: "PDF", pages: 8, created_at: "2026-04-06T09:15:00Z" },
  { id: "doc_4", filename: "Carbon_Fiber_Monocoque_Analysis.pdf", type: "SPEC", pages: 22, created_at: "2026-04-05T16:45:00Z" },
];

function getRecencyLabel(dateStr?: string): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Right-column document list card.
 * Fetches from /api/v1/documents with fallback to mock data.
 * Matches dark Pagani theme.
 */
export default function DocumentPanel() {
  const router = useRouter();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ documents: Document[]; total: number }>("/api/v1/documents");
      setDocs((data.documents ?? []).slice(0, 4));
    } catch {
      // Fallback to mock data
      setDocs(MOCK_DOCS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const typeBadge = (type: string) => {
    const isPDF = type.toLowerCase() === "pdf";
    return (
      <span
        className={`flex items-center justify-center w-[30px] h-[36px] rounded-md text-[9px] font-bold uppercase tracking-wider ${
          isPDF
            ? "bg-red-500/10 text-red-400 border border-red-500/15"
            : "bg-pagani-gold/10 text-pagani-gold border border-pagani-gold/15"
        }`}
      >
        {type}
      </span>
    );
  };

  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:shadow-pagani-gold/5"
      style={{
        background: "linear-gradient(145deg, rgba(30,30,30,0.5) 0%, rgba(15,15,15,0.8) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.3)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-xs font-bold text-bright-gold uppercase tracking-[0.15em]"
          style={{ fontFamily: "var(--font-orbitron)" }}
        >
          Recent Documents
        </h3>
        <span className="text-[10px] text-gray-600">{docs.length} shown</span>
      </div>

      {error && <ErrorBanner message={error} onRetry={fetchDocs} />}

      {loading ? (
        <SkeletonCard lines={4} showHeader={false} />
      ) : (
        <div className="space-y-1">
          {docs.map((doc, i) => (
            <motion.button
              key={doc.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              onClick={() => router.push(`/dashboard/viewer/documents/${doc.id}`)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-all group text-left"
              style={{ borderBottom: i < docs.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}
            >
              {typeBadge(doc.type)}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-medium truncate">{doc.filename}</p>
                <p className="text-[10px] text-gray-500">
                  {doc.pages ? `${doc.pages} pages` : ""}{doc.pages && doc.created_at ? " · " : ""}{getRecencyLabel(doc.created_at)}
                </p>
              </div>
              <svg className="w-3.5 h-3.5 text-gray-600 group-hover:text-pagani-gold transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
