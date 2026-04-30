"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import ViewerTopbar from "@/components/viewer/ViewerTopbar";
import { apiFetch } from "@/lib/api";

interface DocumentDetail {
  id: string;
  filename?: string;
  type?: string;
  content?: string;
  file_size?: number;
  upload_date?: string;
  created_at?: string;
  chunk_count?: number;
  pdf_filename?: string;
}

export default function DocumentViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const data = await apiFetch(`/api/v1/documents/${id}`) as DocumentDetail;
        setDoc(data);
      } catch (err: any) {
        setError(err.message || "Failed to load document");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchDoc();
  }, [id]);

  const pdfUrl = doc?.pdf_filename
    ? `http://localhost:8000/api/v1/static/pdfs/${encodeURIComponent(doc.pdf_filename)}`
    : null;

  /** Render each section: split on the separator lines */
  const renderContent = (content: string) => {
    // Split on the ═══ separator pattern
    const sections = content.split(/\n*═{10,}\n*/g).filter(Boolean);

    if (sections.length <= 1) {
      // No section separators — just render as-is
      return (
        <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      );
    }

    // Sections come in pairs: heading, content, heading, content, …
    const rendered: React.ReactNode[] = [];
    let i = 0;
    while (i < sections.length) {
      const text = sections[i].trim();
      // Check if the next section exists — if so this is a heading
      if (i + 1 < sections.length && text.length < 200 && !text.includes("\n\n")) {
        rendered.push(
          <div key={i} className="mt-8 first:mt-0">
            <h3
              className="text-base font-bold text-pagani-gold tracking-wide mb-3 flex items-center gap-2"
              style={{ fontFamily: "var(--font-orbitron)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-pagani-gold" />
              {text}
            </h3>
            <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap pl-4 border-l border-white/[0.06]">
              {sections[i + 1].trim()}
            </div>
          </div>
        );
        i += 2;
      } else {
        rendered.push(
          <div key={i} className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap mt-4">
            {text}
          </div>
        );
        i += 1;
      }
    }
    return <>{rendered}</>;
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0a] overflow-hidden text-gray-200">
      <ViewerTopbar onOpenSettings={() => {}} />

      <main className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto px-6 py-8">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500 hover:text-pagani-gold transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </button>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-pagani-gold/20 border-t-pagani-gold rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-8 border border-red-500/20 bg-red-500/5 rounded-xl text-center text-red-400">
            {error}
          </div>
        ) : doc ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Header Card */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-wide mb-3">{doc.filename || `Document ${id}`}</h1>
                  <div className="flex items-center gap-4 text-xs text-gray-500 uppercase tracking-widest flex-wrap">
                    {doc.type && <span className="bg-pagani-gold/10 text-pagani-gold px-2 py-1 rounded">{doc.type}</span>}
                    {doc.file_size != null && !isNaN(doc.file_size) && <span>{(doc.file_size / 1024).toFixed(1)} KB</span>}
                    {(doc.upload_date || doc.created_at) && !isNaN(new Date(doc.upload_date || doc.created_at!).getTime()) && (
                      <span>{new Date(doc.upload_date || doc.created_at!).toLocaleDateString()}</span>
                    )}
                    {doc.chunk_count != null && doc.chunk_count > 1 && (
                      <span>{doc.chunk_count} sections</span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] text-gray-400 border border-white/[0.08] hover:bg-white/[0.08] hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8">
              {doc.content ? renderContent(doc.content) : (
                <div className="text-center text-gray-500 py-12">
                  No content available for this document.
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </main>
    </div>
  );
}
