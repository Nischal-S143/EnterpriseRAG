"use client";

import React from "react";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

/**
 * Inline error banner with retry button.
 * Never uses full-page error screens — always inline.
 */
export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/[0.06]">
      <div className="flex items-center gap-2.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="text-xs text-red-400">{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-[10px] text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 px-3 py-1 rounded-md uppercase tracking-wider font-semibold transition-all"
        >
          Retry
        </button>
      )}
    </div>
  );
}
