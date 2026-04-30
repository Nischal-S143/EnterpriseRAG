"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] w-[540px] max-w-[90vw] rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(145deg, rgba(26,26,26,0.98) 0%, rgba(15,15,15,0.99) 100%)",
              border: "1px solid rgba(212,175,55,0.2)",
              boxShadow: "0 0 60px rgba(212,175,55,0.06), 0 25px 50px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-pagani-gold/10 flex items-center justify-center text-pagani-gold border border-pagani-gold/20">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-pagani-gold uppercase tracking-[0.1em]" style={{ fontFamily: "var(--font-orbitron)" }}>
                    Dashboard Guide
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-widest">
                    Quick Tips & Information
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-pagani-gold transition-colors p-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-5">
              
              <div className="flex gap-4">
                <div className="pt-0.5 text-pagani-gold">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-200 mb-1">Saving & Exporting Answers</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Click the <strong>Save</strong> button on any AI response to permanently add it to your Bookmarks. Click <strong>Export</strong> to open a clean, print-friendly PDF view of the response.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="pt-0.5 text-pagani-gold">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-200 mb-1">Global Entity Search</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Use the top search bar to instantly scan across all uploaded system **Documents** and your personalized **Saved Answers**. It isolates data retrieval from AI prompt generation.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="pt-0.5 text-pagani-gold">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20v-6M6 20V10M18 20V4" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-200 mb-1">Topic Preferences</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Click the Gear icon next to the search bar to filter which topics the AI focuses on. Your preferences are saved locally and automatically applied to new chats.
                  </p>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/[0.06] bg-black/20 flex justify-center">
              <button
                onClick={onClose}
                className="text-xs font-bold text-pagani-black bg-pagani-gold hover:bg-bright-gold px-8 py-2 rounded-lg uppercase tracking-wider transition-all hover:shadow-[0_0_15px_rgba(255,215,0,0.3)]"
                style={{ fontFamily: "var(--font-orbitron)" }}
              >
                Close Guide
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
