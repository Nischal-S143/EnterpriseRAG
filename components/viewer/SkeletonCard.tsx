"use client";

import React from "react";

interface SkeletonCardProps {
  className?: string;
  lines?: number;
  showHeader?: boolean;
}

/**
 * Pulsing skeleton card for the Viewer dashboard.
 * Uses the dark Pagani theme: carbon-gray backgrounds with shimmer.
 */
export function SkeletonCard({ className = "", lines = 3, showHeader = true }: SkeletonCardProps) {
  return (
    <div
      className={`rounded-xl p-5 ${className}`}
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {showHeader && (
        <div className="h-3 w-[40%] rounded bg-white/[0.06] animate-pulse mb-4" />
      )}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-2.5 rounded bg-white/[0.06] animate-pulse"
            style={{ width: i === lines - 1 ? "60%" : "100%" }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Inline skeleton line — used within cards for partial loading states.
 */
export function SkeletonLine({ width = "100%" }: { width?: string }) {
  return (
    <div
      className="h-2.5 rounded bg-white/[0.06] animate-pulse"
      style={{ width }}
    />
  );
}

export default SkeletonCard;
