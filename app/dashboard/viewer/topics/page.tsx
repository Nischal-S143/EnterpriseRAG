"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import ViewerTopbar from "@/components/viewer/ViewerTopbar";
import TopicPreferencesModal from "@/components/viewer/TopicPreferencesModal";
import { getUserScopedKey } from "@/lib/auth";

const ALL_TOPICS = [
  { id: "aerodynamics", label: "Aerodynamics", icon: "💨", description: "Drag coefficients, downforce, airflow management" },
  { id: "engine", label: "Engine & Powertrain", icon: "🔧", description: "AMG V12 specifications, horsepower, torque curves" },
  { id: "chassis", label: "Chassis & Structure", icon: "🏗️", description: "Carbon-titanium monocoque, CrMo tubular frames" },
  { id: "suspension", label: "Suspension & Dynamics", icon: "⚙️", description: "Pushrod systems, ride height, dampers" },
  { id: "braking", label: "Braking Systems", icon: "🛑", description: "Carbon-ceramic rotors, Brembo calipers, ABS tuning" },
  { id: "materials", label: "Advanced Materials", icon: "🧬", description: "Carbon fiber, titanium alloys, Triax weaving" },
  { id: "telemetry", label: "Telemetry & Data", icon: "📊", description: "Live data streams, sensor arrays, performance logs" },
  { id: "design", label: "Design Philosophy", icon: "🎨", description: "Horacio Pagani's art-meets-science approach" },
  { id: "safety", label: "Safety Systems", icon: "🛡️", description: "Crash structures, rollover protection, fire suppression" },
  { id: "electronics", label: "Electronics & ECU", icon: "💻", description: "Bosch ECU, traction control, launch control" },
  { id: "transmission", label: "Transmission", icon: "⚡", description: "7-speed sequential, Xtrac gearbox internals" },
  { id: "history", label: "Heritage & History", icon: "📜", description: "Zonda lineage, Huayra evolution, racing legacy" },
];

export default function TopicExplorerPage() {
  const router = useRouter();
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

  const toggleTopic = (id: string) => {
    const updated = topicPreferences.includes(id)
      ? topicPreferences.filter((t) => t !== id)
      : [...topicPreferences, id];
    handleSaveTopics(updated);
  };

  const handleExplore = (topicLabel: string) => {
    router.push(`/dashboard/viewer/search?q=${encodeURIComponent(topicLabel)}`);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0a] overflow-hidden text-gray-200">
      <ViewerTopbar onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="flex-1 overflow-y-auto w-full max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-12 border-b border-white/[0.06] pb-6 flex items-center justify-between">
          <div>
            <h1
              className="text-3xl font-bold text-white tracking-wide flex items-center gap-3"
              style={{ fontFamily: "var(--font-orbitron)" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-pagani-gold" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Topic Explorer
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              Select topics to focus the AI, or click Explore to search the knowledge base.
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-pagani-gold" style={{ fontFamily: "var(--font-orbitron)" }}>
              {topicPreferences.length}
            </div>
            <div className="text-[9px] text-gray-500 uppercase tracking-widest">Active</div>
          </div>
        </div>

        {/* Topic Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ALL_TOPICS.map((topic, idx) => {
            const isActive = topicPreferences.includes(topic.id);
            return (
              <motion.div
                key={topic.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={`group relative p-5 rounded-xl border transition-all overflow-hidden ${
                  isActive
                    ? "border-pagani-gold/40 bg-pagani-gold/5"
                    : "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12]"
                }`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-pagani-gold to-transparent" />
                )}

                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{topic.icon}</span>
                    <div>
                      <h3 className={`text-sm font-bold ${isActive ? "text-pagani-gold" : "text-gray-200"}`}>
                        {topic.label}
                      </h3>
                    </div>
                  </div>
                  {/* Toggle */}
                  <button
                    onClick={() => toggleTopic(topic.id)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${
                      isActive ? "bg-pagani-gold/30" : "bg-white/[0.08]"
                    }`}
                  >
                    <motion.div
                      animate={{ x: isActive ? 20 : 2 }}
                      transition={{ type: "spring" as const, damping: 20, stiffness: 300 }}
                      className={`absolute top-0.5 w-4 h-4 rounded-full ${
                        isActive ? "bg-pagani-gold" : "bg-gray-500"
                      }`}
                    />
                  </button>
                </div>

                <p className="text-[11px] text-gray-500 leading-relaxed mb-4">
                  {topic.description}
                </p>

                <button
                  onClick={() => handleExplore(topic.label)}
                  className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-pagani-gold transition-colors flex items-center gap-1.5"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Explore
                </button>
              </motion.div>
            );
          })}
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
