"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isAuthenticated, getStoredUser, getToken } from "@/lib/auth";
import { apiFetch, sanitizeInput } from "@/lib/api";
import { logViewerActivity } from "@/lib/activityTracker";
import { getUserScopedKey } from "@/lib/auth";
import SourceDrawer, { type SourceInfo } from "./SourceDrawer";
import GracefulAccessDenied from "./GracefulAccessDenied";

// ── Types ──

interface Source {
  chunk_text: string;
  document_name: string;
  page_number?: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: Source[];
  isStreaming?: boolean;
  feedbackGiven?: "helpful" | "not_helpful";
}

interface ViewerChatPanelProps {
  topicPreferences: string[];
  fullHeight?: boolean;
}

// ── Helpers ──

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Parse [N] citation markers in content and replace with clickable spans.
 * Returns JSX elements array.
 */
function renderContentWithCitations(
  content: string,
  onCitationClick: (index: number) => void
): React.ReactNode[] {
  const parts = content.split(/\[(\d+)\]/g);
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // Text part
      if (parts[i]) {
        nodes.push(<span key={i}>{parts[i]}</span>);
      }
    } else {
      // Citation number
      const num = parseInt(parts[i], 10);
      nodes.push(
        <button
          key={`citation-${i}`}
          onClick={() => onCitationClick(num)}
          className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 mx-0.5 text-[9px] font-bold text-pagani-gold bg-pagani-gold/10 border border-pagani-gold/25 rounded hover:bg-pagani-gold/20 hover:border-pagani-gold/40 transition-all cursor-pointer align-text-top"
          title={`View source ${num}`}
        >
          {num}
        </button>
      );
    }
  }
  return nodes;
}

// ── Mock Suggestion Data ──
const ALL_SUGGESTIONS = [
  "What makes the Zonda R's aerodynamics unique?",
  "Compare the Huayra BC and Utopia engines",
  "Tell me about the carbon fiber construction",
  "What is the top speed of the Zonda R?",
  "How much horsepower does the AMG V12 produce?",
  "What is the current market valuation of the Zonda R?",
  "Detail the Öhlins damper specifications.",
  "Show me the production timeline for all 15 units.",
  "What is the torsional rigidity of the Zonda R monocoque?",
  "What is the peak downforce at 300 km/h?",
  "Tell me about the carbon-titanium chassis.",
];

const getRandomSuggestions = (count: number, exclude: string[] = []) => {
  const available = ALL_SUGGESTIONS.filter(s => !exclude.includes(s));
  const pool = available.length >= count ? available : ALL_SUGGESTIONS;
  return [...pool].sort(() => 0.5 - Math.random()).slice(0, count);
};

/**
 * Main AI chat interface for the Viewer dashboard.
 * Uses existing SSE streaming from /api/v1/chat/sse.
 * Dark Pagani theme matching admin ChatAssistant patterns.
 */
export default function ViewerChatPanel({ topicPreferences, fullHeight }: ViewerChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(() => getRandomSuggestions(3));

  // Source drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSource, setDrawerSource] = useState<SourceInfo | null>(null);
  const [drawerIndex, setDrawerIndex] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleCitationClick = useCallback((msgSources: Source[] | undefined, index: number) => {
    if (!msgSources || index < 1 || index > msgSources.length) return;
    const src = msgSources[index - 1];
    setDrawerSource({
      chunk_text: src.chunk_text,
      document_name: src.document_name,
      page_number: src.page_number,
    });
    setDrawerIndex(index);
    setDrawerOpen(true);
  }, []);

  const handleSave = useCallback((msg: ChatMessage) => {
    if (typeof window === "undefined") return;
    try {
      const key = getUserScopedKey("viewer_bookmarks");
      const raw = localStorage.getItem(key);
      const bookmarks = raw ? JSON.parse(raw) : [];
      const userQuery = messages.find((m) => m.role === "user" && m.timestamp <= msg.timestamp)?.content ?? "";
      const newBookmark = {
        id: msg.id,
        query: userQuery,
        preview: msg.content.slice(0, 120),
        content: msg.content,
        tag: "AI Answer",
        savedAt: new Date().toISOString(),
      };
      bookmarks.unshift(newBookmark);
      localStorage.setItem(key, JSON.stringify(bookmarks));
      window.dispatchEvent(new Event("bookmarks-updated"));
      logViewerActivity("bookmark", `Saved answer: "${userQuery.slice(0, 60)}${userQuery.length > 60 ? "…" : ""}"`);
    } catch {
      // silently fail
    }
  }, [messages]);

  const handleFeedback = useCallback(async (msgId: string, rating: "helpful" | "not_helpful") => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedbackGiven: rating } : m))
    );
    logViewerActivity("feedback", `Rated response as ${rating === "helpful" ? "helpful 👍" : "not helpful 👎"}`);
    try {
      await apiFetch("/api/v1/query/feedback", {
        method: "POST",
        body: JSON.stringify({
          query: "",
          rating: rating === "helpful" ? 5 : 1,
          comment: `Viewer feedback: ${rating}`,
        }),
      });
    } catch {
      // Non-critical, silently fail
    }
  }, []);

  const handleExport = useCallback((msg: ChatMessage) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pagani Intelligence - AI Export</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #111; padding: 40px; max-width: 800px; margin: 0 auto; }
            .header { border-bottom: 2px solid #D4AF37; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
            .logo span { color: #D4AF37; }
            .meta { color: #666; font-size: 12px; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
            .content { font-size: 14px; white-space: pre-wrap; }
            .footer { margin-top: 60px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 20px; letter-spacing: 0.1em; text-transform: uppercase; }
            @media print {
              body { padding: 0; }
              @page { margin: 2cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">PAGANI <span>INTELLIGENCE</span></div>
            <div class="meta">AI Assistant Export • ${new Date().toLocaleString()}</div>
          </div>
          <div class="content">${msg.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          <div class="footer">© ${new Date().getFullYear()} Pagani Automobili. Enterprise System.</div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    // Allow styles to apply before triggering print dialog
    setTimeout(() => {
      printWindow.print();
    }, 250);
    
    logViewerActivity("view", "Exported an AI response to PDF/Print");
  }, []);


  const handleSend = async (text?: string) => {
    const messageText = text ?? input.trim();
    if (!messageText || isLoading) return;
    if (!isAuthenticated()) return;

    const sanitized = sanitizeInput(messageText);
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: sanitized,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setSuggestions([]);
    logViewerActivity("search", `Asked: "${sanitized.slice(0, 80)}${sanitized.length > 80 ? "…" : ""}"`);

    const assistantId = generateId();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      },
    ]);

    const token = getToken();
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${apiBase}/api/v1/chat/sse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question: sanitized,
          format: "Standard",
          metadata_filters: topicPreferences.length > 0 ? topicPreferences : undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";
      let currentData = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            currentData = line.slice(6).trim();
          } else if (line === "" && currentEvent && currentData) {
            try {
              const data = JSON.parse(currentData);

              switch (currentEvent) {
                case "token":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: m.content + (data.text || "") }
                        : m
                    )
                  );
                  break;

                case "result":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            content: data.answer || m.content,
                            sources: data.sources?.map((s: string) => ({
                              chunk_text: s,
                              document_name: s,
                            })) ?? [],
                          }
                        : m
                    )
                  );
                  break;

                case "done":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            content: data.answer || m.content,
                            isStreaming: false,
                          }
                        : m
                    )
                  );
                  logViewerActivity("ai_answer", `AI responded: "${(data.answer || "").slice(0, 80)}${(data.answer || "").length > 80 ? "…" : ""}"`);
                  break;

                case "error":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            content: `⚠ ${data.message || "Pipeline error occurred"}`,
                            isStreaming: false,
                          }
                        : m
                    )
                  );
                  break;
              }
            } catch {
              // Skip malformed JSON
            }

            currentEvent = "";
            currentData = "";
          }
        }
      }

      // Generate suggestions after response
      const askedQuestions = messages.filter(m => m.role === "user").map(m => m.content).concat(sanitized);
      setSuggestions(getRandomSuggestions(3, askedQuestions));
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "⚠ Network error. Please check your connection and try again.",
                  isStreaming: false,
                }
              : m
          )
        );
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && m.isStreaming ? { ...m, isStreaming: false } : m
        )
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div
        className="rounded-2xl flex flex-col overflow-hidden relative"
        style={{
          background: "linear-gradient(145deg, rgba(20,20,20,0.8) 0%, rgba(10,10,10,0.95) 100%)",
          border: "1px solid rgba(212,175,55,0.15)",
          boxShadow: "0 0 40px rgba(212,175,55,0.04), inset 0 1px 1px rgba(255,255,255,0.03)",
          height: "100%",
          minHeight: "420px",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 animate-ping opacity-40" />
            </div>
            <h3
              className="text-xs font-bold text-pagani-gold uppercase tracking-[0.12em]"
              style={{ fontFamily: "var(--font-orbitron)" }}
            >
              AI Assistant
            </h3>
          </div>
          <button className="text-gray-500 hover:text-pagani-gold transition-colors" title="Help">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 scrollbar-thin">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full opacity-40">
              <div className="w-8 h-[1px] bg-pagani-gold mb-2" />
              <p className="text-pagani-gold text-[10px] uppercase tracking-[0.2em]">
                Ask anything about Pagani
              </p>
              <div className="w-8 h-[1px] bg-pagani-gold mt-2" />
            </div>
          )}

          {messages.map((msg) => {
            // Check for ACCESS_RESTRICTED
            if (msg.role === "assistant" && msg.content.includes("[ACCESS_RESTRICTED]")) {
              return (
                <div key={msg.id} className="flex justify-start">
                  <GracefulAccessDenied onSuggestedQuery={(q) => handleSend(q)} />
                </div>
              );
            }

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[85%]">
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-pagani-gold/15 text-white border border-pagani-gold/20 rounded-br-sm"
                        : "bg-white/[0.04] text-gray-200 border border-white/[0.08] rounded-bl-sm"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="relative">
                        <div className="whitespace-pre-wrap">
                          {renderContentWithCitations(msg.content, (idx) =>
                            handleCitationClick(msg.sources, idx)
                          )}
                        </div>
                        {msg.isStreaming && (
                          <span
                            className="inline-block w-[2px] h-[1.1em] bg-pagani-gold ml-0.5 align-text-bottom"
                            style={{ animation: "cursorBlink 0.8s steps(2) infinite" }}
                          />
                        )}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>

                  {/* Action Buttons for Assistant Messages */}
                  {msg.role === "assistant" && !msg.isStreaming && msg.content && !msg.content.startsWith("⚠") && (
                    <div className="flex items-center gap-1 mt-1.5 ml-1">
                      {/* Helpful */}
                      <button
                        onClick={() => handleFeedback(msg.id, "helpful")}
                        disabled={!!msg.feedbackGiven}
                        className={`text-[10px] px-2 py-1 rounded transition-all ${
                          msg.feedbackGiven === "helpful"
                            ? "text-green-400 bg-green-500/10"
                            : msg.feedbackGiven
                            ? "text-gray-600 cursor-not-allowed"
                            : "text-gray-500 hover:text-green-400 hover:bg-green-500/10"
                        }`}
                      >
                        ▲ Helpful
                      </button>

                      {/* Not Helpful */}
                      <button
                        onClick={() => handleFeedback(msg.id, "not_helpful")}
                        disabled={!!msg.feedbackGiven}
                        className={`text-[10px] px-2 py-1 rounded transition-all ${
                          msg.feedbackGiven === "not_helpful"
                            ? "text-red-400 bg-red-500/10"
                            : msg.feedbackGiven
                            ? "text-gray-600 cursor-not-allowed"
                            : "text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                        }`}
                      >
                        ▽ Not helpful
                      </button>

                      {/* Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <button
                          onClick={() => handleCitationClick(msg.sources, 1)}
                          className="text-[10px] text-gray-500 hover:text-pagani-gold px-2 py-1 rounded hover:bg-pagani-gold/5 transition-all"
                        >
                          Sources
                        </button>
                      )}

                      {/* Save */}
                      <button
                        onClick={() => handleSave(msg)}
                        className="text-[10px] text-gray-500 hover:text-pagani-gold px-2 py-1 rounded hover:bg-pagani-gold/5 transition-all"
                      >
                        Save
                      </button>

                      {/* Export */}
                      <button
                        onClick={() => handleExport(msg)}
                        className="text-[10px] text-gray-500 hover:text-pagani-gold px-2 py-1 rounded hover:bg-pagani-gold/5 transition-all"
                      >
                        Export
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <AnimatePresence>
          {suggestions.length > 0 && !isLoading && messages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="px-5 pb-2 flex flex-wrap gap-1.5"
            >
              {suggestions.slice(0, 3).map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-[10px] text-gray-400 hover:text-pagani-gold px-2.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] hover:border-pagani-gold/20 hover:bg-pagani-gold/[0.04] transition-all"
                >
                  {s}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Row */}
        <div className="px-4 py-3 border-t border-white/[0.06] bg-black/30">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about Pagani..."
              disabled={isLoading}
              className="flex-1 h-9 px-4 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder-gray-500 outline-none focus:border-pagani-gold/30 focus:bg-white/[0.06] transition-all disabled:opacity-40"
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="h-9 px-4 rounded-lg text-xs font-bold text-pagani-black bg-pagani-gold hover:bg-bright-gold disabled:opacity-30 uppercase tracking-wider transition-all hover:shadow-[0_0_15px_rgba(255,215,0,0.3)] disabled:hover:shadow-none"
              style={{ fontFamily: "var(--font-orbitron)" }}
            >
              {isLoading ? (
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                >
                  ···
                </motion.span>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Source Drawer */}
      <SourceDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        source={drawerSource}
        sourceIndex={drawerIndex}
      />
    </>
  );
}
