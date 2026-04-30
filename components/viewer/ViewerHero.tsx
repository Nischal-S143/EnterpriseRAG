"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { getStoredUser, getUserScopedKey } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { SkeletonLine } from "./SkeletonCard";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Hero card with personalised greeting and real stat pills.
 * Fetches real data from /api/v1/documents and /api/v1/evaluations/summary.
 * Matches the dark Pagani executive dashboard theme.
 */
export default function ViewerHero() {
  const user = getStoredUser();
  const firstName = user?.username?.split(".")[0] ?? "Viewer";

  const [greeting, setGreeting] = useState("Good afternoon");
  const [loading, setLoading] = useState(true);
  const [docCount, setDocCount] = useState(0);
  const [totalQueries, setTotalQueries] = useState(0);
  const [avgRelevance, setAvgRelevance] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const fetchRealData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch real document count
      const docsData = await apiFetch<{ documents: unknown[]; total: number }>("/api/v1/documents");
      setDocCount(docsData.total ?? 0);
    } catch {
      setDocCount(0);
    }

    try {
      // Fetch real evaluation metrics (public endpoint)
      const evalData = await apiFetch<{
        total_queries: number;
        avg_relevance: number;
        avg_faithfulness: number;
      }>("/api/v1/evaluations/summary");
      setTotalQueries(evalData.total_queries ?? 0);
      setAvgRelevance(evalData.avg_relevance ? Math.round(evalData.avg_relevance * 100) : 0);
    } catch {
      setTotalQueries(0);
      setAvgRelevance(0);
    }

    // Read bookmark count from localStorage
    try {
      const raw = localStorage.getItem(getUserScopedKey("viewer_bookmarks"));
      if (raw) {
        const parsed = JSON.parse(raw);
        setBookmarkCount(Array.isArray(parsed) ? parsed.length : 0);
      }
    } catch {
      setBookmarkCount(0);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRealData();
  }, [fetchRealData]);

  const stats = [
    { value: totalQueries, label: "Total queries" },
    { value: docCount, label: "Documents" },
    { value: bookmarkCount, label: "Saved answers" },
    { value: avgRelevance > 0 ? `${avgRelevance}%` : "—", label: "Relevance" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl p-6 relative overflow-hidden backdrop-blur-xl"
      style={{
        background: "linear-gradient(145deg, rgba(30,30,30,0.6) 0%, rgba(15,15,15,0.8) 100%)",
        border: "1px solid rgba(255,215,0,0.2)",
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* Subtle gold glow */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-pagani-gold/20 to-transparent" />

      <div className="flex items-start justify-between">
        {/* Left: Greeting */}
        <div>
          <h2
            className="text-lg font-bold text-white tracking-tight capitalize"
            style={{ fontFamily: "var(--font-orbitron)" }}
          >
            {greeting},{" "}
            <span className="text-bright-gold">{firstName}</span>
          </h2>
          <div className="text-sm text-gray-400 mt-1.5">
            {loading ? (
              <SkeletonLine width="260px" />
            ) : docCount > 0 ? (
              <p>
                You have{" "}
                <span className="text-pagani-gold font-medium">{docCount}</span>{" "}
                documents in the knowledge base
                {bookmarkCount > 0 && (
                  <>
                    {" "}and{" "}
                    <span className="text-pagani-gold font-medium">{bookmarkCount}</span>{" "}
                    saved answers
                  </>
                )}.
              </p>
            ) : (
              <p>Welcome to the Pagani Intelligence platform.</p>
            )}
          </div>
        </div>

        {/* Right: Stat Pills */}
        <div className="flex items-center gap-3">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.35 }}
              className="px-4 py-2.5 rounded-xl text-center min-w-[90px]"
              style={{
                background: "rgba(212,175,55,0.06)",
                border: "1px solid rgba(212,175,55,0.12)",
              }}
            >
              {loading ? (
                <div className="flex flex-col items-center gap-1.5">
                  <SkeletonLine width="40px" />
                  <SkeletonLine width="60px" />
                </div>
              ) : (
                <>
                  <p
                    className="text-xl font-bold text-bright-gold"
                    style={{ fontFamily: "var(--font-orbitron)" }}
                  >
                    {stat.value}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
                    {stat.label}
                  </p>
                </>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
