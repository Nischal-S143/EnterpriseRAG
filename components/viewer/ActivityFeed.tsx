"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getViewerActivity, type ActivityEvent } from "@/lib/activityTracker";

const DOT_COLORS: Record<string, string> = {
  ai_answer: "bg-green-400",
  bookmark: "bg-pagani-gold",
  new_doc: "bg-orange-400",
  view: "bg-sky-400",
  login: "bg-emerald-400",
  search: "bg-violet-400",
  feedback: "bg-pink-400",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/**
 * Live activity feed showing REAL user actions.
 * Reads from the shared activityTracker (localStorage).
 * Listens for the custom "viewer-activity-update" DOM event
 * so it updates instantly when any component logs an action.
 * Also polls every 10s to keep relative timestamps fresh.
 */
export default function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  const refresh = useCallback(() => {
    setActivities(getViewerActivity(8));
  }, []);

  useEffect(() => {
    // Initial load
    refresh();

    // Listen for real-time activity updates from other components
    const handleUpdate = () => refresh();
    window.addEventListener("viewer-activity-update", handleUpdate);

    // Poll every 10s to keep relative timestamps fresh
    const interval = setInterval(refresh, 10_000);

    return () => {
      window.removeEventListener("viewer-activity-update", handleUpdate);
      clearInterval(interval);
    };
  }, [refresh]);

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
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 animate-ping opacity-40" />
          </div>
          <h3
            className="text-xs font-bold text-bright-gold uppercase tracking-[0.15em]"
            style={{ fontFamily: "var(--font-orbitron)" }}
          >
            Activity
          </h3>
        </div>
        <span className="text-[10px] text-gray-600">Live</span>
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 opacity-40">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(212,175,55,0.3)" strokeWidth="1.5" strokeLinecap="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <p className="text-[10px] text-gray-500 mt-2">No activity yet</p>
          <p className="text-[9px] text-gray-600 mt-0.5">Your actions will appear here</p>
        </div>
      ) : (
        <div className="space-y-0 max-h-[240px] overflow-y-auto scrollbar-thin pr-1">
          <AnimatePresence initial={false}>
            {activities.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex items-start gap-2.5 py-2.5"
                style={{
                  borderBottom: i < activities.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                }}
              >
                <div className={`w-[7px] h-[7px] rounded-full mt-1 flex-shrink-0 ${DOT_COLORS[item.type] ?? "bg-gray-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 leading-relaxed">{item.text}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{timeAgo(item.timestamp)}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
