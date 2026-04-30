"use client";

import React, { useState, useEffect } from "react";
import ViewerTopbar from "@/components/viewer/ViewerTopbar";
import ViewerChatPanel from "@/components/viewer/ViewerChatPanel";
import TopicPreferencesModal from "@/components/viewer/TopicPreferencesModal";
import { getUserScopedKey } from "@/lib/auth";

export default function ChatAssistantPage() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [topicPreferences, setTopicPreferences] = useState<string[]>([]);
  
  useEffect(() => {
    try {
      const raw = localStorage.getItem(getUserScopedKey("viewer_topic_prefs"));
      if (raw) setTopicPreferences(JSON.parse(raw));
    } catch {}
  }, []);

  const handleSaveTopics = (topics: string[]) => {
    setTopicPreferences(topics);
    if (typeof window !== "undefined") {
      localStorage.setItem(getUserScopedKey("viewer_topic_prefs"), JSON.stringify(topics));
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-pagani-black overflow-hidden relative">
      <ViewerTopbar onOpenSettings={() => setIsSettingsOpen(true)} />
      
      <main className="flex-1 w-full h-full relative">
        <div className="absolute inset-0 max-w-5xl mx-auto px-4 sm:px-6 md:px-8 pt-4 pb-0 h-full drop-shadow-2xl">
           <ViewerChatPanel topicPreferences={topicPreferences} fullHeight={true} />
        </div>
      </main>

      <TopicPreferencesModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedTopics={topicPreferences}
        onSave={handleSaveTopics}
      />
    </div>
  );
}
