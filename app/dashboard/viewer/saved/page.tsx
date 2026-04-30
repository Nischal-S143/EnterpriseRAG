"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ViewerTopbar from "@/components/viewer/ViewerTopbar";
import TopicPreferencesModal from "@/components/viewer/TopicPreferencesModal";
import { getUserScopedKey } from "@/lib/auth";

interface Bookmark {
  id: string;
  tag: string;
  query: string;
  preview: string;
  content: string;
  savedAt: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SavedAnswersPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [filter, setFilter] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [topicPreferences, setTopicPreferences] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(getUserScopedKey("viewer_topic_prefs"));
      if (raw) setTopicPreferences(JSON.parse(raw));
    } catch {}

    try {
      const raw = localStorage.getItem(getUserScopedKey("viewer_bookmarks"));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setBookmarks(parsed);
      }
    } catch {}
  }, []);

  const handleDelete = (id: string) => {
    const updated = bookmarks.filter((b) => b.id !== id);
    setBookmarks(updated);
    localStorage.setItem(getUserScopedKey("viewer_bookmarks"), JSON.stringify(updated));
    window.dispatchEvent(new Event("bookmarks-updated"));
    if (expandedId === id) setExpandedId(null);
  };

  const handleSaveTopics = (topics: string[]) => {
    setTopicPreferences(topics);
    if (typeof window !== "undefined") {
      localStorage.setItem(getUserScopedKey("viewer_topic_prefs"), JSON.stringify(topics));
    }
  };

  const filtered = bookmarks.filter((b) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      b.query.toLowerCase().includes(q) ||
      b.preview.toLowerCase().includes(q) ||
      b.tag.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0a] overflow-hidden text-gray-200">
      <ViewerTopbar onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="flex-1 overflow-y-auto w-full max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/[0.06] pb-6 gap-4">
          <div>
            <h1
              className="text-3xl font-bold text-white tracking-wide flex items-center gap-3"
              style={{ fontFamily: "var(--font-orbitron)" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-pagani-gold" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Saved Answers
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              Your personalized archive of AI-generated insights.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Filter */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter saved answers…"
                className="w-56 h-[34px] pl-9 pr-3 rounded-lg text-xs text-white bg-white/[0.04] border border-white/[0.08] placeholder-gray-500 outline-none focus:border-pagani-gold/30 transition-all"
              />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-pagani-gold" style={{ fontFamily: "var(--font-orbitron)" }}>
                {filtered.length}
              </div>
              <div className="text-[9px] text-gray-500 uppercase tracking-widest">Results</div>
            </div>
          </div>
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <div className="p-16 border border-dashed border-white/[0.05] rounded-xl text-center">
            <svg className="w-10 h-10 mx-auto text-gray-600 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-xs text-gray-500 uppercase tracking-widest block mb-1">
              {filter ? "No Matches Found" : "No Saved Answers Yet"}
            </span>
            <span className="text-[10px] text-gray-600">
              {filter ? "Try broadening your search." : "Save AI responses from the Chat panel to see them here."}
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((bookmark, idx) => (
              <motion.div
                key={`${bookmark.id}_${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-pagani-gold/20 transition-all overflow-hidden"
              >
                {/* Card header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === bookmark.id ? null : bookmark.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-pagani-gold/10 text-pagani-gold border border-pagani-gold/20 shrink-0">
                      {bookmark.tag}
                    </span>
                    <h4 className="text-sm font-medium text-white truncate">
                      &quot;{bookmark.query}&quot;
                    </h4>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <span className="text-[10px] text-gray-500">{timeAgo(bookmark.savedAt)}</span>
                    <motion.svg
                      animate={{ rotate: expandedId === bookmark.id ? 180 : 0 }}
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </motion.svg>
                  </div>
                </div>

                {/* Collapsed preview */}
                {expandedId !== bookmark.id && (
                  <div className="px-5 pb-4 -mt-1">
                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{bookmark.preview}</p>
                  </div>
                )}

                {/* Expanded full content */}
                <AnimatePresence>
                  {expandedId === bookmark.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 border-t border-white/[0.04] pt-4">
                        <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto scrollbar-thin pr-2">
                          {bookmark.content || bookmark.preview}
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(bookmark.content || bookmark.preview);
                            }}
                            className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-gray-400 border border-white/[0.08] hover:border-pagani-gold/30 hover:text-pagani-gold transition-all"
                          >
                            Copy
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(bookmark.id);
                            }}
                            className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
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
