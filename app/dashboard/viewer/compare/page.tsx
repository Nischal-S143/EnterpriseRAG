"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout } from "@/lib/auth";
import { motion } from "framer-motion";
import ViewerTopbar from "@/components/viewer/ViewerTopbar";
import ModelComparison from "@/components/viewer/ModelComparison";

export default function CompareDashboard() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auth Verification — redirect if not viewer
  useEffect(() => {
    (async () => {
      try {
        const me = await getUser();
        if (me.role !== "viewer") {
          router.replace("/");
          return;
        }
        setAuthorized(true);
      } catch {
        logout();
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-pagani-black flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          className="w-10 h-10 border-2 border-pagani-gold/30 border-t-pagani-gold rounded-full"
        />
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <>
      <ViewerTopbar onOpenSettings={() => {}} />

      <main className="flex-1 overflow-y-auto p-5 relative z-10 flex flex-col">
        {/* Background Effects (same as main dashboard) */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#D4AF37]/[0.06] rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#2A2A2A]/30 rounded-full blur-[100px]" />
        </div>

        {/* Content (above background) */}
        <div className="relative z-10 flex flex-col gap-5 flex-1 p-8">
          <ModelComparison />
        </div>
      </main>
    </>
  );
}
