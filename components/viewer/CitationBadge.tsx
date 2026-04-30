"use client";

import React from "react";

interface CitationBadgeProps {
  index: number;
  onClick: () => void;
}

/**
 * Small clickable badge rendering [N] citation markers in assistant messages.
 * Clicking opens the SourceDrawer.
 */
export default function CitationBadge({ index, onClick }: CitationBadgeProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 mx-0.5 text-[9px] font-bold text-pagani-gold bg-pagani-gold/10 border border-pagani-gold/25 rounded hover:bg-pagani-gold/20 hover:border-pagani-gold/40 transition-all cursor-pointer align-text-top"
      title={`View source ${index}`}
    >
      {index}
    </button>
  );
}
