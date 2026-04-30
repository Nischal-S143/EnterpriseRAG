"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface SourceInfo {
  chunk_text: string;
  document_name: string;
  page_number?: number;
}

interface SourceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  source: SourceInfo | null;
  sourceIndex: number;
}

/**
 * Slide-in drawer from the right showing source chunk details.
 * Triggered by clicking a CitationBadge.
 */
export default function SourceDrawer({ isOpen, onClose, source, sourceIndex }: SourceDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && source && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 z-[90] h-full w-[380px] max-w-[90vw] flex flex-col"
            style={{
              background: "linear-gradient(145deg, rgba(26,26,26,0.98) 0%, rgba(15,15,15,0.99) 100%)",
              borderLeft: "1px solid rgba(212,175,55,0.15)",
              boxShadow: "-8px 0 40px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-pagani-gold/10 flex items-center justify-center text-[10px] font-bold text-pagani-gold">
                  {sourceIndex}
                </div>
                <div>
                  <h3
                    className="text-xs font-bold text-pagani-gold uppercase tracking-[0.1em]"
                    style={{ fontFamily: "var(--font-orbitron)" }}
                  >
                    Source
                  </h3>
                  <p className="text-[10px] text-gray-500 truncate max-w-[200px]">
                    {source.document_name}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-pagani-gold transition-colors p-1"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Document Info */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[9px] text-pagani-gold/60 bg-pagani-gold/[0.06] border border-pagani-gold/15 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                  Document
                </span>
                <span className="text-xs text-gray-300">{source.document_name}</span>
              </div>

              {source.page_number !== undefined && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[9px] text-gray-500 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Page {source.page_number}
                  </span>
                </div>
              )}

              {/* Chunk Text */}
              <div className="mt-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                  Retrieved Chunk
                </p>
                <div className="bg-black/40 rounded-lg p-4 border border-white/[0.04]">
                  <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {source.chunk_text}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
