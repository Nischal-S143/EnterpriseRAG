"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout, getStoredUser, getUserScopedKey } from "@/lib/auth";
import { motion } from "framer-motion";
import { logViewerActivity } from "@/lib/activityTracker";

// Viewer components
import ViewerSidebar from "@/components/viewer/ViewerSidebar";
import ViewerTopbar from "@/components/viewer/ViewerTopbar";
import ViewerHero from "@/components/viewer/ViewerHero";
import PaganiCarousel from "@/components/viewer/PaganiCarousel";
import ViewerChatPanel from "@/components/viewer/ViewerChatPanel";
import DocumentPanel from "@/components/viewer/DocumentPanel";
import ActivityFeed from "@/components/viewer/ActivityFeed";
import BookmarksGrid from "@/components/viewer/BookmarksGrid";
import TopicPreferencesModal from "@/components/viewer/TopicPreferencesModal";

/**
 * Viewer Dashboard — Page Assembly
 *
 * Two-column shell: fixed 200px left sidebar + scrollable main content area.
 * Uses the same dark Pagani theme as admin/engineer dashboards.
 * No admin or engineer routes, endpoints, or data fields.
 */
export default function ViewerDashboard() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  // Topic preferences state (shared between TopicPreferencesModal and ViewerChatPanel)
  const [topicPreferences, setTopicPreferences] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        if (!sessionStorage.getItem("viewer_logged_in")) {
          logViewerActivity("login", "Logged in to Viewer Dashboard");
          sessionStorage.setItem("viewer_logged_in", "true");
        }
      } catch {
        logout();
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // Load topic preferences from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(getUserScopedKey("viewer_topic_prefs"));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setTopicPreferences(parsed);
        }
      }
    } catch {
      // no-op
    }
  }, []);

  const handleSaveTopics = (topics: string[]) => {
    setTopicPreferences(topics);
    if (typeof window !== "undefined") {
      localStorage.setItem(getUserScopedKey("viewer_topic_prefs"), JSON.stringify(topics));
    }
    if (topics.length > 0) {
      logViewerActivity("view", `Updated topic preferences: ${topics.join(", ")}`);
    }
  };

  // Loading state
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
      <ViewerTopbar onOpenSettings={() => setSettingsOpen(true)} />

      <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 relative z-10">
        {/* Background Effects (same as admin) */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#D4AF37]/[0.06] rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#2A2A2A]/30 rounded-full blur-[100px]" />
        </div>

        {/* Content (above background) */}
        <div className="relative z-10 flex flex-col gap-5">
          <ViewerHero />
          <PaganiCarousel />

          {/* Two-column: Chat + Right Panel */}
          <div className="grid grid-cols-[1fr_340px] gap-4 items-stretch">
            <ViewerChatPanel topicPreferences={topicPreferences} />
            <div className="flex flex-col gap-4">
              <div className="flex-1 min-h-0">
                <DocumentPanel />
              </div>
              <ActivityFeed />
            </div>
          </div>

          <BookmarksGrid />
        </div>
      </main>

      {/* Topic Preferences Modal (rendered at page level) */}
      <TopicPreferencesModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        selectedTopics={topicPreferences}
        onSave={handleSaveTopics}
      />
    </>
  );
}
