"use client";

import React from "react";
import { motion } from "framer-motion";

interface GracefulAccessDeniedProps {
  onSuggestedQuery: (query: string) => void;
}

const PERMITTED_QUERIES = [
  "What is the top speed of the Pagani Zonda R?",
  "Tell me about the Zonda R's carbon fiber monocoque",
  "What engine does the Huayra BC use?",
];

/**
 * Replaces an assistant message bubble when [ACCESS_RESTRICTED] is detected.
 * Shows a lock icon, friendly message, and 3 permitted query suggestions.
 * Never shows raw error strings to the viewer.
 */
export default function GracefulAccessDenied({ onSuggestedQuery }: GracefulAccessDeniedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-[85%] rounded-xl px-5 py-4 bg-white/[0.04] border border-pagani-gold/15"
    >
      {/* Lock Icon */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-lg bg-pagani-gold/10 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <span
          className="text-xs font-bold text-pagani-gold uppercase tracking-[0.1em]"
          style={{ fontFamily: "var(--font-orbitron)" }}
        >
          Access Restricted
        </span>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        This content is restricted to your current access level.
      </p>

      {/* Permitted Query Suggestions */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
          Try these instead
        </p>
        {PERMITTED_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => onSuggestedQuery(q)}
            className="block w-full text-left text-xs text-gray-400 hover:text-pagani-gold px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-pagani-gold/[0.06] border border-white/[0.04] hover:border-pagani-gold/20 transition-all"
          >
            → {q}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
