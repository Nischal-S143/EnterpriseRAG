"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isAuthenticated, getStoredUser } from "@/lib/auth";
import { apiFetch, apiFetchStream, AuthError } from "@/lib/api";

interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    sources?: string[];
    confidence?: string;
    isStreaming?: boolean;
}

interface ChatAssistantProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ChatAssistant({ isOpen, onClose }: ChatAssistantProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "system",
            content:
                "Welcome to Pagani Intelligence. Ask anything about the Zonda R.",
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [authError, setAuthError] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
        // Check auth on open
        if (isOpen && !isAuthenticated()) {
            setAuthError(true);
        } else {
            setAuthError(false);
        }
    }, [isOpen]);

    const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        if (!isAuthenticated()) {
            setAuthError(true);
            return;
        }

        const userMessage: Message = {
            id: generateId(),
            role: "user",
            content: input.trim(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);
        setAuthError(false);

        const assistantId = generateId();

        try {
            // Try streaming first
            const reader = await apiFetchStream("/api/chat/stream", {
                method: "POST",
                body: JSON.stringify({ question: userMessage.content }),
            });

            if (reader) {
                // Streaming mode
                setMessages((prev) => [
                    ...prev,
                    {
                        id: assistantId,
                        role: "assistant",
                        content: "",
                        isStreaming: true,
                    },
                ]);

                const decoder = new TextDecoder();
                let fullContent = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const text = decoder.decode(value);
                    const lines = text.split("\n");

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = line.slice(6);
                            if (data === "[DONE]") continue;
                            fullContent += data;
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === assistantId
                                        ? { ...m, content: fullContent }
                                        : m
                                )
                            );
                        }
                    }
                }

                // Mark streaming complete
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantId
                            ? { ...m, isStreaming: false }
                            : m
                    )
                );
            }
        } catch (error) {
            if (error instanceof AuthError) {
                setAuthError(true);
                setMessages((prev) =>
                    prev.filter((m) => m.id !== assistantId)
                );
            } else {
                // Fallback to non-streaming
                try {
                    const result = await apiFetch<{
                        answer: string;
                        sources: string[];
                        confidence: string;
                    }>("/api/chat", {
                        method: "POST",
                        body: JSON.stringify({ question: userMessage.content }),
                    });

                    setMessages((prev) => [
                        ...prev,
                        {
                            id: assistantId,
                            role: "assistant",
                            content: result.answer,
                            sources: result.sources,
                            confidence: result.confidence,
                        },
                    ]);
                } catch (fallbackError) {
                    if (fallbackError instanceof AuthError) {
                        setAuthError(true);
                    } else {
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: assistantId,
                                role: "assistant",
                                content:
                                    "I apologize, but I'm unable to process your request at this time. Please try again.",
                            },
                        ]);
                    }
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const user = getStoredUser();

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.95 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed bottom-6 right-6 z-[70] w-[420px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl overflow-hidden"
                        style={{
                            background:
                                "linear-gradient(145deg, rgba(26,26,26,0.97) 0%, rgba(20,20,20,0.99) 100%)",
                            border: "1px solid rgba(212,175,55,0.25)",
                            boxShadow:
                                "0 0 60px rgba(212,175,55,0.08), 0 25px 50px rgba(0,0,0,0.5)",
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-pagani-gold/20">
                            <div className="flex items-center gap-3">
                                {/* Animated pulse dot */}
                                <div className="relative">
                                    <div className="w-2.5 h-2.5 rounded-full bg-pagani-gold" />
                                    <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-pagani-gold animate-ping opacity-40" />
                                </div>
                                <div>
                                    <h3
                                        className="text-sm font-bold tracking-[0.15em] uppercase text-pagani-gold"
                                        style={{ fontFamily: "var(--font-orbitron)" }}
                                    >
                                        Pagani Intelligence
                                    </h3>
                                    <p className="text-[10px] text-gray-500 tracking-wider uppercase">
                                        {user
                                            ? `${user.role.toUpperCase()} ACCESS`
                                            : "ENTERPRISE RAG SYSTEM"}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-gray-500 hover:text-pagani-gold transition-colors p-1"
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin">
                            {/* Auth Error */}
                            {authError && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-center"
                                >
                                    <p className="text-red-400 text-sm mb-3">
                                        Authentication required to access Pagani Intelligence.
                                    </p>
                                    <a
                                        href="/login"
                                        className="inline-block text-xs font-bold tracking-[0.15em] uppercase text-pagani-gold border border-pagani-gold/40 px-5 py-2 hover:bg-pagani-gold hover:text-black transition-all"
                                    >
                                        Sign In
                                    </a>
                                </motion.div>
                            )}

                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
                                        }`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user"
                                                ? "bg-pagani-gold/15 text-white border border-pagani-gold/20"
                                                : msg.role === "system"
                                                    ? "bg-carbon-gray/50 text-gray-400 border border-white/5 text-center w-full text-xs"
                                                    : "bg-white/5 text-gray-200 border border-white/10"
                                            }`}
                                    >
                                        <p className="whitespace-pre-wrap">{msg.content}</p>

                                        {/* Streaming indicator */}
                                        {msg.isStreaming && (
                                            <span className="inline-block w-1.5 h-4 bg-pagani-gold ml-1 animate-pulse" />
                                        )}

                                        {/* Sources & Confidence */}
                                        {msg.sources && msg.sources.length > 0 && (
                                            <div className="mt-3 pt-2 border-t border-white/10">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] text-pagani-gold uppercase tracking-wider font-bold">
                                                        Sources
                                                    </span>
                                                    {msg.confidence && (
                                                        <span
                                                            className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${msg.confidence === "high"
                                                                    ? "bg-green-500/20 text-green-400"
                                                                    : msg.confidence === "medium"
                                                                        ? "bg-yellow-500/20 text-yellow-400"
                                                                        : "bg-red-500/20 text-red-400"
                                                                }`}
                                                        >
                                                            {msg.confidence}
                                                        </span>
                                                    )}
                                                </div>
                                                {msg.sources.map((s, i) => (
                                                    <div
                                                        key={i}
                                                        className="text-[10px] text-gray-500 truncate"
                                                    >
                                                        → {s}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            {/* Loading indicator */}
                            {isLoading && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex justify-start"
                                >
                                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-2">
                                        <div className="flex gap-1">
                                            <span
                                                className="w-1.5 h-1.5 bg-pagani-gold rounded-full animate-bounce"
                                                style={{ animationDelay: "0ms" }}
                                            />
                                            <span
                                                className="w-1.5 h-1.5 bg-pagani-gold rounded-full animate-bounce"
                                                style={{ animationDelay: "150ms" }}
                                            />
                                            <span
                                                className="w-1.5 h-1.5 bg-pagani-gold rounded-full animate-bounce"
                                                style={{ animationDelay: "300ms" }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            Processing...
                                        </span>
                                    </div>
                                </motion.div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="px-4 py-3 border-t border-pagani-gold/20 bg-black/30">
                            <div className="flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={
                                        authError
                                            ? "Sign in to ask questions..."
                                            : "Ask about the Zonda R..."
                                    }
                                    disabled={isLoading || authError}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-pagani-gold/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={{ fontFamily: "var(--font-rajdhani)" }}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={isLoading || !input.trim() || authError}
                                    className="px-4 py-2.5 bg-pagani-gold/15 border border-pagani-gold/30 rounded-lg text-pagani-gold hover:bg-pagani-gold hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-pagani-gold/15 disabled:hover:text-pagani-gold"
                                >
                                    <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                                    </svg>
                                </button>
                            </div>
                            <p className="text-[9px] text-gray-600 mt-2 text-center tracking-wider uppercase">
                                Powered by Gemini 1.5 Pro • Enterprise RAG
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
