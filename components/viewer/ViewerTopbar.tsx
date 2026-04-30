"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getStoredUser, logout } from "@/lib/auth";
import HelpModal from "./HelpModal";

interface ViewerTopbarProps {
  onOpenSettings: () => void;
}

/**
 * Sticky top bar with search input + icon buttons.
 * Matches the dark Pagani executive dashboard aesthetic.
 */
export default function ViewerTopbar({ onOpenSettings }: ViewerTopbarProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [hasUnread, setHasUnread] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState<"none" | "notifications" | "profile">("none");
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const user = getStoredUser();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    router.push(`/dashboard/viewer/search?q=${encodeURIComponent(q)}`);
    setSearch("");
  };

  const toggleDropdown = (type: "notifications" | "profile") => {
    if (activeDropdown === type) {
      setActiveDropdown("none");
    } else {
      setActiveDropdown(type);
      if (type === "notifications") setHasUnread(false);
    }
  };

  // Close dropdowns on outside click
  const topbarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (topbarRef.current && !topbarRef.current.contains(e.target as Node)) {
        setActiveDropdown("none");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const dropdownVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, damping: 25, stiffness: 300 } },
    exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.15 } }
  };

  return (
    <>
      <header
        ref={topbarRef}
        className="sticky top-0 z-40 flex items-center justify-between px-5 h-14 border-b border-white/[0.06] backdrop-blur-2xl"
        style={{ background: "rgba(10,10,10,0.6)" }}
      >
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents, topics, models…"
              className="w-full h-[34px] pl-9 pr-3 rounded-lg text-xs text-white bg-white/[0.04] border border-white/[0.08] placeholder-gray-500 outline-none focus:border-pagani-gold/30 focus:bg-white/[0.06] transition-all"
            />
          </div>
        </form>

        {/* Right Icons */}
        <div className="flex items-center gap-2 ml-4">
          
          {/* Settings / Topic Preferences */}
          <button
            onClick={onOpenSettings}
            className="w-[30px] h-[30px] flex items-center justify-center rounded-lg border border-white/[0.08] hover:border-pagani-gold/30 hover:bg-white/[0.04] active:scale-95 transition-all text-gray-400 hover:text-pagani-gold"
            title="Topic Preferences"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown("notifications")}
              className={`relative w-[30px] h-[30px] flex items-center justify-center rounded-lg border transition-all active:scale-95 ${activeDropdown === "notifications" ? 'border-pagani-gold/50 bg-white/[0.04] text-pagani-gold' : 'border-white/[0.08] hover:border-pagani-gold/30 text-gray-400 hover:text-pagani-gold hover:bg-white/[0.04]'}`}
              title="Notifications"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              {hasUnread && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 border border-[#0a0a0a]" />
              )}
            </button>
            <AnimatePresence>
              {activeDropdown === "notifications" && (
                <motion.div
                  variants={dropdownVariants}
                  initial="hidden" animate="visible" exit="exit"
                  className="absolute right-0 top-10 w-[280px] rounded-xl border border-white/[0.08] overflow-hidden shadow-2xl"
                  style={{ background: "rgba(15,15,15,0.98)" }}
                >
                  <div className="px-4 py-3 border-b border-white/[0.06] flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-200">System Alerts</span>
                    <span className="text-[9px] text-pagani-gold uppercase tracking-wider">0 Unread</span>
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="p-2 hover:bg-white/[0.03] rounded-lg cursor-pointer transition-colors">
                      <p className="text-[11px] text-white font-medium">Welcome to Pagani Intelligence</p>
                      <p className="text-[10px] text-gray-500 mt-1">Your viewer dashboard is ready to use.</p>
                      <p className="text-[9px] text-pagani-gold mt-1.5 flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> Just now
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Help */}
          <button
            onClick={() => setIsHelpOpen(true)}
            className="w-[30px] h-[30px] flex items-center justify-center rounded-lg border border-white/[0.08] hover:border-pagani-gold/30 hover:bg-white/[0.04] active:scale-95 transition-all text-gray-400 hover:text-pagani-gold"
            title="Dashboard Guide"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown("profile")}
              className={`w-[30px] h-[30px] flex items-center justify-center rounded-lg border transition-all active:scale-95 ${activeDropdown === "profile" ? 'border-pagani-gold/50 bg-white/[0.04] text-pagani-gold' : 'border-white/[0.08] hover:border-pagani-gold/30 text-gray-400 hover:text-pagani-gold hover:bg-white/[0.04]'}`}
              title="Profile"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            <AnimatePresence>
              {activeDropdown === "profile" && (
                <motion.div
                  variants={dropdownVariants}
                  initial="hidden" animate="visible" exit="exit"
                  className="absolute right-0 top-10 w-[200px] rounded-xl border border-white/[0.08] overflow-hidden shadow-2xl p-2"
                  style={{ background: "rgba(15,15,15,0.98)" }}
                >
                  <div className="px-3 py-3 border-b border-white/[0.06] flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-pagani-gold/10 border border-pagani-gold/25 flex items-center justify-center text-[10px] font-bold text-pagani-gold uppercase">
                       {user?.username?.substring(0, 2) || "V"}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white truncate">{user?.username || "Viewer"}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{user?.role || "Viewer"}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      logout();
                      router.push("/login");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-red-400 hover:bg-red-500/10 transition-colors text-left"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Log Out -&gt;
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
        </div>
      </header>
      
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
}
