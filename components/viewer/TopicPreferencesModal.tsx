"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const TOPICS = [
  "Aerodynamics",
  "Engine specs",
  "Lap records",
  "Carbon fiber",
  "Horsepower",
  "Chassis design",
  "Press releases",
  "Race history",
] as const;

interface TopicPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTopics: string[];
  onSave: (topics: string[]) => void;
}

/**
 * Modal for selecting topic preferences.
 * Multi-select chips. Persists to localStorage key viewer_topic_prefs.
 * Uses Framer Motion AnimatePresence scale-in animation.
 */
export default function TopicPreferencesModal({
  isOpen,
  onClose,
  selectedTopics,
  onSave,
}: TopicPreferencesModalProps) {
  const [localTopics, setLocalTopics] = React.useState<string[]>(selectedTopics);

  React.useEffect(() => {
    setLocalTopics(selectedTopics);
  }, [selectedTopics, isOpen]);

  const toggle = (topic: string) => {
    setLocalTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const handleSave = () => {
    onSave(localTopics);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] w-[420px] max-w-[90vw] rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(145deg, rgba(26,26,26,0.98) 0%, rgba(15,15,15,0.99) 100%)",
              border: "1px solid rgba(212,175,55,0.2)",
              boxShadow: "0 0 60px rgba(212,175,55,0.06), 0 25px 50px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div>
                <h3
                  className="text-sm font-bold text-pagani-gold uppercase tracking-[0.1em]"
                  style={{ fontFamily: "var(--font-orbitron)" }}
                >
                  Topic Preferences
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Select topics to filter AI assistant responses
                </p>
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

            {/* Topic Chips */}
            <div className="px-6 py-5">
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((topic) => {
                  const isSelected = localTopics.includes(topic);
                  return (
                    <button
                      key={topic}
                      onClick={() => toggle(topic)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                        isSelected
                          ? "bg-pagani-gold/15 text-pagani-gold border-pagani-gold/30"
                          : "bg-white/[0.02] text-gray-400 border-white/[0.06] hover:border-white/15 hover:text-gray-300"
                      }`}
                    >
                      {isSelected && (
                        <span className="mr-1">✓</span>
                      )}
                      {topic}
                    </button>
                  );
                })}
              </div>

              <p className="text-[10px] text-gray-600 mt-4">
                {localTopics.length} topic{localTopics.length !== 1 ? "s" : ""} selected
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/[0.06]">
              <button
                onClick={onClose}
                className="text-xs text-gray-500 hover:text-gray-300 px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="text-xs font-bold text-pagani-black bg-pagani-gold hover:bg-bright-gold px-5 py-2 rounded-lg uppercase tracking-wider transition-all hover:shadow-[0_0_15px_rgba(255,215,0,0.3)]"
                style={{ fontFamily: "var(--font-orbitron)" }}
              >
                Save
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
