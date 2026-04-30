"use client";

import React from "react";
import ViewerSidebar from "@/components/viewer/ViewerSidebar";

export default function ViewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#0A0A0A] overflow-hidden text-white">
      <ViewerSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
