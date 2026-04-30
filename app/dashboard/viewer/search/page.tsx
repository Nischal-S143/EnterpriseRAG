"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getUserScopedKey } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import ViewerTopbar from "@/components/viewer/ViewerTopbar";
import TopicPreferencesModal from "@/components/viewer/TopicPreferencesModal";

interface Bookmark {
  id: string;
  tag: string;
  query: string;
  preview: string;
  content: string;
  savedAt: string;
}

interface DocumentInfo {
  id: string;
  filename: string;
  upload_date: string;
  file_size: number;
}

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const rawQuery = searchParams.get("q") || "";
  const query = rawQuery.toLowerCase();
  
  const router = useRouter();

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [topicPreferences, setTopicPreferences] = useState<string[]>([]);

  useEffect(() => {
    // Load Topic Preferences
    try {
      const raw = localStorage.getItem(getUserScopedKey("viewer_topic_prefs"));
      if (raw) setTopicPreferences(JSON.parse(raw));
    } catch {}

    const fetchData = async () => {
      setLoading(true);

      const stopWords = ["a", "an", "the", "and", "or", "but", "about", "of", "in", "on", "to", "for", "with", "is", "are", "was", "were"];
      const tokens = query.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
      if (tokens.length === 0) tokens.push(query);

      const matchesSearch = (text: string) => {
        if (!text) return false;
        const lower = text.toLowerCase();
        return tokens.some(token => lower.includes(token));
      };

      // 1. Get filtered bookmarks
      try {
        const rawBookmarks = localStorage.getItem(getUserScopedKey("viewer_bookmarks"));
        if (rawBookmarks) {
          const parsed = JSON.parse(rawBookmarks);
          if (Array.isArray(parsed)) {
            const matched = parsed.filter(
              (b) => matchesSearch(b.query) || matchesSearch(b.preview) || matchesSearch(b.tag)
            );
            setBookmarks(matched);
          }
        }
      } catch (err) {
        console.error("Failed to parse bookmarks", err);
      }

      // 2. Get filtered documents
      try {
        const docsResult = await apiFetch("/api/v1/documents") as { documents?: DocumentInfo[] };
        if (docsResult && Array.isArray(docsResult.documents)) {
          const matchedDocs = docsResult.documents.filter((d: DocumentInfo) => 
            matchesSearch(d.filename)
          );
          setDocuments(matchedDocs);
        }
      } catch (err) {
        console.error("Failed to fetch documents", err);
      }

      setLoading(false);
    };

    if (query) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [query]);

  const handleSaveTopics = (topics: string[]) => {
    setTopicPreferences(topics);
    if (typeof window !== "undefined") {
      localStorage.setItem(getUserScopedKey("viewer_topic_prefs"), JSON.stringify(topics));
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <ViewerTopbar onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto px-6 py-8">
        
        {/* Header */}
        <div className="mb-10 flex items-center justify-between border-b border-white/[0.06] pb-6">
          <div>
            <button
              onClick={() => router.push("/dashboard/viewer")}
              className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500 hover:text-pagani-gold transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-white tracking-wide" style={{ fontFamily: "var(--font-orbitron)" }}>
              Search Results
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              Results found for "<span className="text-pagani-gold font-medium">{rawQuery}</span>"
            </p>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold text-pagani-gold" style={{ fontFamily: "var(--font-orbitron)" }}>
              {bookmarks.length + documents.length}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Total Hits</div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-pagani-gold/20 border-t-pagani-gold rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            
            {/* System Documents Column */}
            <div>
              <h2 className="text-sm uppercase tracking-[0.2em] font-bold text-pagani-gold mb-6 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                </svg>
                System Docs <span className="opacity-50">({documents.length})</span>
              </h2>
              
              {documents.length === 0 ? (
                <div className="p-8 border border-dashed border-white/[0.05] rounded-xl text-center">
                  <span className="text-xs text-gray-500 uppercase tracking-widest">No matching documents</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc, idx) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/viewer/documents/${doc.id}`)}
                    >
                      <div className="flex gap-3">
                        <div className="mt-1 pb-1">
                           <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                               <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                             </svg>
                           </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-gray-200">{doc.filename}</h4>
                          <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">
                            {doc.file_size != null && !isNaN(doc.file_size) && (
                              <span>{(doc.file_size / 1024).toFixed(1)} KB • </span>
                            )}
                            {(doc.upload_date || (doc as any).created_at) && !isNaN(new Date(doc.upload_date || (doc as any).created_at).getTime()) && (
                              <span>{new Date(doc.upload_date || (doc as any).created_at).toLocaleDateString()}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Answers Column */}
            <div>
              <h2 className="text-sm uppercase tracking-[0.2em] font-bold text-pagani-gold mb-6 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                   <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                Saved Answers <span className="opacity-50">({bookmarks.length})</span>
              </h2>
              
              {bookmarks.length === 0 ? (
                <div className="p-8 border border-dashed border-white/[0.05] rounded-xl text-center">
                  <span className="text-xs text-gray-500 uppercase tracking-widest">No matching bookmarks</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {bookmarks.map((bookmark, idx) => (
                    <motion.div
                      key={bookmark.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-pagani-gold/10 text-pagani-gold border border-pagani-gold/20">
                          {bookmark.tag}
                        </span>
                        <span className="text-[10px] text-gray-500">{new Date(bookmark.savedAt).toLocaleDateString()}</span>
                      </div>
                      <h4 className="text-sm font-medium text-white mb-2 line-clamp-1">"{bookmark.query}"</h4>
                      <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
                        {bookmark.preview}...
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

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

export default function SearchResultsPage() {
  return (
    <div className="flex h-full w-full bg-[#0a0a0a] overflow-hidden text-gray-200">
      <Suspense fallback={<div className="flex items-center justify-center w-full h-full"><div className="w-8 h-8 border-2 border-pagani-gold/20 border-t-pagani-gold rounded-full animate-spin"></div></div>}>
        <SearchResultsContent />
      </Suspense>
    </div>
  );
}
