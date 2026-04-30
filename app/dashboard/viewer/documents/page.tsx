"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import ViewerTopbar from "@/components/viewer/ViewerTopbar";
import TopicPreferencesModal from "@/components/viewer/TopicPreferencesModal";
import { apiFetch } from "@/lib/api";
import { getUserScopedKey } from "@/lib/auth";

interface DocumentInfo {
  id: string;
  filename: string;
  upload_date: string;
  file_size: number;
}

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [topicPreferences, setTopicPreferences] = useState<string[]>([]);
  
  useEffect(() => {
    try {
      const raw = localStorage.getItem(getUserScopedKey("viewer_topic_prefs"));
      if (raw) setTopicPreferences(JSON.parse(raw));
    } catch {}

    const fetchDocs = async () => {
      try {
        const res = await apiFetch("/api/v1/documents") as { documents?: DocumentInfo[] };
        if (res && res.documents) {
          setDocuments(res.documents);
        }
      } catch (err) {
        console.error("Failed to fetch documents", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDocs();
  }, []);

  const handleSaveTopics = (topics: string[]) => {
    setTopicPreferences(topics);
    if (typeof window !== "undefined") {
      localStorage.setItem(getUserScopedKey("viewer_topic_prefs"), JSON.stringify(topics));
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0a] overflow-hidden text-gray-200">
      <ViewerTopbar onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="flex-1 overflow-y-auto w-full max-w-6xl mx-auto px-6 py-10">
        <div className="mb-10 flex items-center justify-between border-b border-white/[0.06] pb-6">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-wide flex items-center gap-3" style={{ fontFamily: "var(--font-orbitron)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-pagani-gold" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
              System Documents
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              Browse the foundational knowledge base loaded into Pagani Intelligence.
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-pagani-gold" style={{ fontFamily: "var(--font-orbitron)" }}>
              {documents.length}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Total Files</div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-pagani-gold/20 border-t-pagani-gold rounded-full animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="p-16 border border-dashed border-white/[0.05] rounded-xl text-center">
            <svg className="w-10 h-10 mx-auto text-gray-600 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline>
            </svg>
            <span className="text-xs text-gray-500 uppercase tracking-widest block mb-1">No Documents Available</span>
            <span className="text-[10px] text-gray-600">The system has not indexed any knowledge sources.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {documents.map((doc, idx) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => router.push(`/dashboard/viewer/documents/${doc.id}`)}
                className="group p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-pagani-gold/30 transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-pagani-gold/5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-150" />
                <div className="flex items-start gap-4 relative z-10">
                  <div className="mt-1 w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 group-hover:bg-red-500/20 transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-gray-200 truncate group-hover:text-pagani-gold transition-colors">{doc.filename}</h4>
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-500 uppercase tracking-widest">
                      {doc.file_size != null && !isNaN(doc.file_size) && (
                        <>
                          <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                          <span className="w-1 h-1 rounded-full bg-gray-700" />
                        </>
                      )}
                      {(doc.upload_date || (doc as any).created_at) && !isNaN(new Date(doc.upload_date || (doc as any).created_at).getTime()) && (
                        <span>{new Date(doc.upload_date || (doc as any).created_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
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
