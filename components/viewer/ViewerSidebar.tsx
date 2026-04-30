"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getStoredUser, logout, getUserScopedKey } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeColor?: string;
}

/**
 * Fixed left sidebar for the Viewer dashboard (200px wide).
 * Matches the dark Pagani theme used by admin/engineer dashboards.
 */
export default function ViewerSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [docCount, setDocCount] = useState<number>(0);
  const [bookmarkCount, setBookmarkCount] = useState<number>(0);

  // Load user client-side only to avoid hydration mismatch
  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  // Fetch document count
  useEffect(() => {
    (async () => {
      try {
        // TODO: replace with real API — GET /api/documents/count?role=viewer
        const data = await apiFetch<{ documents: unknown[]; total: number }>("/api/v1/documents");
        setDocCount(data.total ?? 0);
      } catch {
        setDocCount(0);
      }
    })();
  }, []);

  // Read bookmark count from localStorage — reactive via interval + custom event
  useEffect(() => {
    if (typeof window === "undefined") return;

    const readCount = () => {
      try {
        const raw = localStorage.getItem(getUserScopedKey("viewer_bookmarks"));
        if (raw) {
          const bookmarks = JSON.parse(raw);
          setBookmarkCount(Array.isArray(bookmarks) ? bookmarks.length : 0);
        } else {
          setBookmarkCount(0);
        }
      } catch {
        setBookmarkCount(0);
      }
    };

    readCount();
    const interval = setInterval(readCount, 2000);
    window.addEventListener("bookmarks-updated", readCount);
    return () => {
      clearInterval(interval);
      window.removeEventListener("bookmarks-updated", readCount);
    };
  }, []);

  const isActive = (href: string) => pathname === href || (href !== "/dashboard/viewer" && pathname.startsWith(href));

  const mainNav: NavItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard/viewer",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      label: "Chat assistant",
      href: "/dashboard/viewer/chat",
      badge: "Live",
      badgeColor: "bg-green-500",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      ),
    },
    {
      label: "Documents",
      href: "/dashboard/viewer/documents",
      badge: docCount > 0 ? docCount : undefined,
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
        </svg>
      ),
    },
    {
      label: "Saved answers",
      href: "/dashboard/viewer/saved",
      badge: bookmarkCount > 0 ? bookmarkCount : undefined,
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
        </svg>
      ),
    },
  ];

  const exploreNav: NavItem[] = [
    {
      label: "Topic explorer",
      href: "/dashboard/viewer/topics",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      label: "Model comparison",
      href: "/dashboard/viewer/compare",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="8" width="7" height="13" rx="1" />
        </svg>
      ),
    },
  ];

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <button
        key={item.label}
        onClick={() => router.push(item.href)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${
          active
            ? "bg-pagani-gold/15 text-pagani-gold font-medium"
            : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
        }`}
      >
        <span className={active ? "text-pagani-gold" : "text-gray-500"}>{item.icon}</span>
        <span className="flex-1 text-left">{item.label}</span>
        {item.badge !== undefined && (
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
              item.badgeColor === "bg-green-500"
                ? "bg-green-500/15 text-green-400"
                : "bg-white/[0.06] text-gray-400"
            }`}
          >
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const initials = user?.username
    ? user.username.split(".").map((s) => s.charAt(0).toUpperCase()).join("").slice(0, 2)
    : "";

  return (
    <div
      className="w-[200px] min-w-[200px] h-screen flex flex-col border-r border-white/[0.06]"
      style={{
        background: "linear-gradient(180deg, rgba(20,20,20,0.95) 0%, rgba(10,10,10,0.98) 100%)",
      }}
    >
      {/* Logo Block */}
      <div className="px-4 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-pagani-gold"
            style={{
              background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))",
              border: "1px solid rgba(212,175,55,0.25)",
            }}
          >
            E
          </div>
          <div>
            <p
              className="text-xs font-bold text-white tracking-tight"
              style={{ fontFamily: "var(--font-orbitron)" }}
            >
              EnterpriseRAG
            </p>
            <p className="text-[9px] text-pagani-gold/50 tracking-wider uppercase">
              Pagani Intelligence
            </p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <p className="text-[9px] text-gray-600 uppercase tracking-[0.15em] px-3 mb-2 font-semibold">
          Main
        </p>
        {mainNav.map(renderNavItem)}

        <div className="pt-4">
          <p className="text-[9px] text-gray-600 uppercase tracking-[0.15em] px-3 mb-2 font-semibold">
            Explore
          </p>
          {exploreNav.map(renderNavItem)}
        </div>
      </div>

      {/* Footer — User Row */}
      <div className="px-3 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-7 h-7 rounded-full bg-pagani-gold/10 border border-pagani-gold/25 flex items-center justify-center text-[10px] font-bold text-pagani-gold uppercase">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white font-medium truncate">{user?.username ?? "Viewer"}</p>
            <p className="text-[9px] text-pagani-gold/50 uppercase tracking-wider">Viewer</p>
          </div>
          {/* Logout button */}
          <button 
            onClick={() => {
              logout();
              router.push("/login");
            }}
            title="Log out"
            className="text-gray-600 hover:text-red-400 transition-colors p-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
