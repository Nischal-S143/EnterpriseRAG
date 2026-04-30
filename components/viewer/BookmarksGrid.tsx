"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { getUserScopedKey } from "@/lib/auth";

interface Bookmark {
  id: string;
  query: string;
  preview: string;
  content?: string;
  tag: string;
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

/**
 * Deduplicate bookmarks by id, keeping the first occurrence.
 */
function deduplicateBookmarks(bookmarks: Bookmark[]): Bookmark[] {
  const seen = new Set<string>();
  return bookmarks.filter((bm) => {
    if (seen.has(bm.id)) return false;
    seen.add(bm.id);
    return true;
  });
}

/**
 * Full-width bookmarks grid reading from localStorage key viewer_bookmarks.
 * Renders first 3 cards. Empty state with SVG star icon.
 * Uses unique keys (id + index fallback) to prevent React duplicate key errors.
 * Matches dark Pagani theme.
 */
export default function BookmarksGrid() {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadBookmarks = () => {
      try {
        const raw = localStorage.getItem(getUserScopedKey("viewer_bookmarks"));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const deduped = deduplicateBookmarks(parsed);
            setBookmarks(deduped.slice(0, 3));
            setTotalCount(deduped.length);
            return;
          }
        }
      } catch {
        // no-op
      }
      setBookmarks([]);
      setTotalCount(0);
    };

    loadBookmarks();

    // Re-read when bookmarks change (e.g. after saving from chat)
    const handleUpdate = () => loadBookmarks();
    window.addEventListener("viewer-activity-update", handleUpdate);
    return () => window.removeEventListener("viewer-activity-update", handleUpdate);
  }, []);

  return (
    <div>
      {/* Section Header */}
      <div className="flex items-center justify-start gap-4 mb-3">
        <h3
          className="text-xs font-bold text-bright-gold uppercase tracking-[0.15em]"
          style={{ fontFamily: "var(--font-orbitron)" }}
        >
          Saved Answers
        </h3>
        {totalCount > 0 && (
          <button
            onClick={() => router.push("/dashboard/viewer/saved")}
            className="text-[10px] text-pagani-gold/60 hover:text-pagani-gold uppercase tracking-wider transition-colors"
          >
            View all {totalCount} →
          </button>
        )}
      </div>

      {bookmarks.length === 0 ? (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center justify-center py-10 rounded-2xl"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px dashed rgba(255,255,255,0.06)",
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(212,175,55,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <p className="text-sm text-gray-500 mt-3">No saved answers yet</p>
          <p className="text-[10px] text-gray-600 mt-1">
            Save AI responses from the chat to access them here
          </p>
        </motion.div>
      ) : (
        /* Bookmarks Grid — uses composite key to guarantee uniqueness */
        <div className="grid grid-cols-3 gap-3">
          {bookmarks.map((bm, i) => (
            <motion.div
              key={`${bm.id}_${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.35 }}
              className="rounded-xl p-4 cursor-pointer transition-all duration-300 group"
              style={{
                background: "linear-gradient(145deg, rgba(30,30,30,0.5) 0%, rgba(15,15,15,0.8) 100%)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(212,175,55,0.4)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)";
              }}
              onClick={() => setSelectedBookmark(bm)}
            >
              <p className="text-sm text-white font-medium mb-2 line-clamp-1">{bm.query}</p>
              <p className="text-xs text-gray-500 line-clamp-2 mb-3">{bm.preview}</p>
              <div className="flex items-center justify-between">
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-pagani-gold/[0.08] text-pagani-gold/70 border border-pagani-gold/15 font-medium">
                  {bm.tag}
                </span>
                <span className="text-[10px] text-gray-600">{timeAgo(bm.savedAt)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Full Answer Modal */}
      <AnimatePresence>
        {selectedBookmark && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBookmark(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl max-h-[85vh] rounded-2xl flex flex-col overflow-hidden"
              style={{
                background: "linear-gradient(145deg, rgba(20,20,20,0.95) 0%, rgba(10,10,10,0.98) 100%)",
                border: "1px solid rgba(212,175,55,0.2)",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between p-5 border-b border-white/[0.06]">
                <div className="pr-8">
                  <span className="text-[10px] text-pagani-gold font-bold uppercase tracking-widest mb-2 block">
                    Saved Answer
                  </span>
                  <h3 className="text-base text-white font-medium leading-snug">
                    {selectedBookmark.query}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedBookmark(null)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                {selectedBookmark.content || selectedBookmark.preview}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-white/[0.06] bg-black/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-pagani-gold/[0.08] text-pagani-gold border border-pagani-gold/20 font-medium tracking-wide">
                    {selectedBookmark.tag}
                  </span>
                  <span className="text-xs text-gray-500">
                    Saved {timeAgo(selectedBookmark.savedAt)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const key = getUserScopedKey("viewer_bookmarks");
                    const bookmarks = JSON.parse(localStorage.getItem(key) || "[]");
                    const updated = bookmarks.filter((b: Bookmark) => b.id !== selectedBookmark.id);
                    localStorage.setItem(key, JSON.stringify(updated));
                    window.dispatchEvent(new Event("bookmarks-updated"));
                    window.dispatchEvent(new CustomEvent("viewer-activity-update"));
                    setSelectedBookmark(null);
                  }}
                  className="text-[10px] text-red-500/70 hover:text-red-400 uppercase tracking-wider font-bold transition-colors"
                >
                  Remove Bookmark
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
