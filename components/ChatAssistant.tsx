"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isAuthenticated, getStoredUser, getToken } from "@/lib/auth";
import { apiFetch, AuthError, sanitizeInput } from "@/lib/api";
import { logChatRequest, logChatResponse, logError } from "@/lib/logger";
import LiveActivityFeed from "@/components/LiveActivityFeed";
import { type SSEEvent, formatSSEEvent, getScoreColor, PIPELINE_STEPS } from "@/lib/constants";

interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    sources?: string[];
    confidence?: string;
    isStreaming?: boolean;
    errorType?: "network" | "ai_unavailable" | "empty_response" | "unknown";
}

// ── SSE Pipeline State Types ──
interface PlanningState {
    strategy: string;
    sub_queries: string[];
    complexity: string;
    duration_ms: number;
}

interface GatekeeperState {
    status: string;
    query: string;
}

interface RetrievalState {
    chunks_found: number;
    strategy_used: string;
    duration_ms: number;
    top_scores: number[];
}

interface RoutingState {
    decision: string;
    confidence: number;
}

interface AgentState {
    mode: string;
    status: string;
    duration_ms?: number;
    deduped_docs?: number;
}

interface CostState {
    latency_seconds: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number;
    total_pipeline_ms: number;
}

interface EvaluationState {
    relevance: number;
    accuracy: number;
    completeness: number;
    overall: number;
    duration_ms: number;
}

interface PipelineState {
    planning: PlanningState | null;
    gatekeeper: GatekeeperState | null;
    retrieval: RetrievalState | null;
    routing: RoutingState | null;
    agents: AgentState | null;
    cost: CostState | null;
    evaluation: EvaluationState | null;
    currentStage: string;
    isComplete: boolean;
}

interface ChatAssistantProps {
    isOpen: boolean;
    onClose: () => void;
}

// ── Simple Markdown Renderer ──
function renderMarkdown(text: string): string {
    // 1. Sanitize/Escape the raw text first to prevent XSS in dangerouslySetInnerHTML
    let sanitized = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    // 2. Apply markdown transformations on the sanitized text
    return sanitized
        // Code blocks (```...```) - Note: we use &lt;/&gt; now so we match those if needed, 
        // but usually code blocks are handled before escaping or we adjust regex.
        // Let's keep it simple: markdown symbols aren't escaped, only HTML tags.
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-black/40 rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>$2</code></pre>')
        // Inline code (`...`)
        .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-pagani-gold text-xs">$1</code>')
        // Bold (**...**)
        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
        // Italic (*...*)
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
        // Headings (### ... ## ... # ...)
        .replace(/^### (.+)$/gm, '<h4 class="text-pagani-gold text-sm font-bold mt-3 mb-1 uppercase tracking-wider">$1</h4>')
        .replace(/^## (.+)$/gm, '<h3 class="text-pagani-gold text-sm font-bold mt-3 mb-1 uppercase tracking-wider">$1</h3>')
        .replace(/^# (.+)$/gm, '<h2 class="text-white text-base font-bold mt-3 mb-1">$1</h2>')
        // Bullet points (- or *)
        .replace(/^[\-\*] (.+)$/gm, '<li class="ml-4 list-disc text-gray-300">$1</li>')
        // Numbered lists
        .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-300">$1</li>')
        // Line breaks
        .replace(/\n/g, '<br />');
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
    const [selectedFormat, setSelectedFormat] = useState("Standard");
    const [isLoading, setIsLoading] = useState(false);
    const [authError, setAuthError] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    // ── SSE Pipeline State ──
    const [pipeline, setPipeline] = useState<PipelineState>({
        planning: null,
        gatekeeper: null,
        retrieval: null,
        routing: null,
        agents: null,
        cost: null,
        evaluation: null,
        currentStage: "",
        isComplete: false,
    });

    // ── Live Activity Feed State ──
    const [sseEvents, setSSEEvents] = useState<SSEEvent[]>([]);
    const [showConsole, setShowConsole] = useState(true);
    const [showChunksDrawer, setShowChunksDrawer] = useState(false);
    const [retrievedChunks, setRetrievedChunks] = useState<any[]>([]);
    const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
    const [currentStep, setCurrentStep] = useState(0);

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

    const getErrorMessage = (errorType: string): string => {
        switch (errorType) {
            case "network":
                return "⚠ Network error. Please check your connection and try again.";
            case "ai_unavailable":
                return "⚠ The AI service is temporarily unavailable. Please try again in a moment.";
            case "empty_response":
                return "⚠ The AI returned an empty response. Please rephrase your question.";
            default:
                return "⚠ An unexpected error occurred. Please try again.";
        }
    };

    const resetPipeline = useCallback(() => {
        setPipeline({
            planning: null,
            gatekeeper: null,
            retrieval: null,
            routing: null,
            agents: null,
            cost: null,
            evaluation: null,
            currentStage: "",
            isComplete: false,
        });
        setSSEEvents([]);
        setRetrievedChunks([]);
        setThinkingSteps([]);
        setCurrentStep(0);
    }, []);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        if (!isAuthenticated()) {
            setAuthError(true);
            return;
        }

        const sanitizedInput = sanitizeInput(input.trim());

        const userMessage: Message = {
            id: generateId(),
            role: "user",
            content: sanitizedInput,
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);
        setAuthError(false);
        resetPipeline();

        const startTime = Date.now();
        logChatRequest(sanitizedInput);

        const assistantId = generateId();

        // Add placeholder assistant message
        setMessages((prev) => [
            ...prev,
            {
                id: assistantId,
                role: "assistant",
                content: "",
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
                body: JSON.stringify({ question: sanitizedInput, format: selectedFormat }),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No response body");

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                let currentEvent = "";
                let currentData = "";

                for (const line of lines) {
                    if (line.startsWith("event: ")) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith("data: ")) {
                        currentData = line.slice(6).trim();
                    } else if (line === "" && currentEvent && currentData) {
                        // Process complete SSE message
                        try {
                            const data = JSON.parse(currentData);

                            switch (currentEvent) {
                                case "progress":
                                    setPipeline((prev) => ({
                                        ...prev,
                                        currentStage: data.label || prev.currentStage,
                                    }));
                                    setCurrentStep(data.step || 0);
                                    break;

                                case "planning":
                                case "planner":
                                    setPipeline((prev) => ({
                                        ...prev,
                                        currentStage: "planning",
                                        planning: data as PlanningState,
                                    }));
                                    setCurrentStep(1);
                                    break;

                                case "gatekeeper":
                                    setPipeline((prev) => ({
                                        ...prev,
                                        currentStage: "gatekeeper",
                                        gatekeeper: data as GatekeeperState,
                                    }));
                                    break;

                                case "retrieval":
                                case "chunks":
                                    setPipeline((prev) => ({
                                        ...prev,
                                        currentStage: "retrieval",
                                        retrieval: data as RetrievalState,
                                    }));
                                    setCurrentStep(2);
                                    if (currentEvent === "chunks" && data.chunks) {
                                        setRetrievedChunks(data.chunks);
                                    }
                                    break;

                                case "routing":
                                case "router":
                                    setPipeline((prev) => ({
                                        ...prev,
                                        currentStage: "routing",
                                        routing: data as RoutingState,
                                    }));
                                    break;

                                case "agent":
                                case "agents":
                                    setPipeline((prev) => ({
                                        ...prev,
                                        currentStage: "agents",
                                        agents: {
                                            mode: data.active_agent || data.name || data.mode || "",
                                            status: data.status || "",
                                            duration_ms: data.duration_ms,
                                            deduped_docs: data.deduped_docs,
                                        },
                                    }));
                                    setCurrentStep(3);
                                    break;

                                case "thinking":
                                    setThinkingSteps((prev) => [...prev, String(data.thought || data.message || "")]);
                                    break;

                                case "token":
                                    setMessages((prev) =>
                                        prev.map((m) =>
                                            m.id === assistantId
                                                ? {
                                                      ...m,
                                                      content: m.content + (data.text || ""),
                                                  }
                                                : m
                                        )
                                    );
                                    break;

                                case "cost":
                                    setPipeline((prev) => ({
                                        ...prev,
                                        currentStage: "cost",
                                        cost: data as CostState,
                                    }));
                                    break;

                                case "evaluation":
                                    setPipeline((prev) => ({
                                        ...prev,
                                        currentStage: "evaluation",
                                        evaluation: data as EvaluationState,
                                    }));
                                    break;

                                case "result":
                                    // Multi-agent result with answer
                                    setMessages((prev) =>
                                        prev.map((m) =>
                                            m.id === assistantId
                                                ? {
                                                      ...m,
                                                      content: data.answer || m.content,
                                                      sources: data.sources || [],
                                                      confidence: String(data.confidence ?? ""),
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
                                                      confidence: String(data.confidence ?? ""),
                                                      isStreaming: false,
                                                  }
                                                : m
                                        )
                                    );
                                    setPipeline((prev) => ({
                                        ...prev,
                                        currentStage: "done",
                                        isComplete: true,
                                    }));
                                    logChatResponse("success", Date.now() - startTime);
                                    break;

                                case "error":
                                    setMessages((prev) =>
                                        prev.map((m) =>
                                            m.id === assistantId
                                                ? {
                                                      ...m,
                                                      content: `⚠ Pipeline error: ${data.message || "Unknown error"}`,
                                                      isStreaming: false,
                                                      errorType: "ai_unavailable",
                                                  }
                                                : m
                                        )
                                    );
                                    break;
                            }
                        } catch {
                            // Skip malformed JSON
                        }

                        // Capture every event for the LiveActivityFeed
                        if (currentEvent && currentEvent !== "token") {
                            try {
                                const payload = JSON.parse(currentData);
                                const now = new Date();
                                const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
                                setSSEEvents((prev) => [...prev, {
                                    timestamp: ts,
                                    event_type: currentEvent,
                                    payload,
                                    human_readable: formatSSEEvent(currentEvent, payload),
                                }]);
                            } catch { /* skip */ }
                        }

                        currentEvent = "";
                        currentData = "";
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== "AbortError") {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantId
                            ? {
                                  ...m,
                                  content: getErrorMessage("network"),
                                  isStreaming: false,
                                  errorType: "network",
                              }
                            : m
                    )
                );
                logChatResponse("error", Date.now() - startTime);
            }
        } finally {
            setIsLoading(false);
            abortRef.current = null;
            // Ensure streaming flag is off
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantId && m.isStreaming
                        ? { ...m, isStreaming: false }
                        : m
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
                                aria-label="Close assistant"
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
                                    transition={{ duration: 0.3, ease: "easeOut" }}
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
                                        }`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user"
                                            ? "bg-pagani-gold/15 text-white border border-pagani-gold/20"
                                            : msg.role === "system"
                                                ? "bg-carbon-gray/50 text-gray-400 border border-white/5 text-center w-full text-xs"
                                                : msg.errorType
                                                    ? "bg-red-500/10 text-red-300 border border-red-500/20"
                                                    : "bg-white/5 text-gray-200 border border-white/10"
                                            }`}
                                    >
                                        {/* Render markdown for assistant messages, plain text for others */}
                                        {msg.role === "assistant" && !msg.errorType ? (
                                            <div className="relative">
                                                <div
                                                    className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap"
                                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                                />
                                                {/* Inline blinking cursor during token streaming */}
                                                {msg.isStreaming && (
                                                    <span
                                                        className="inline-block w-[2px] h-[1.1em] bg-pagani-gold ml-0.5 align-text-bottom"
                                                        style={{
                                                            animation: "cursorBlink 0.8s steps(2) infinite",
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        ) : (
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
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

                            {/* Pipeline UI & Loading */}
                            {(isLoading || (pipeline.currentStage && !pipeline.isComplete)) && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="flex justify-start w-full relative mb-4"
                                >
                                    <div className="bg-[#111] border border-white/10 rounded-xl px-5 py-4 w-full max-w-[95%] shadow-xl">
                                        
                                        {/* 4-Step Progress Bar */}
                                        <div className="flex items-start justify-between mb-5 relative">
                                            {/* Centered connecting line */}
                                            <div className="absolute top-[5px] left-[10%] right-[10%] h-[2px] bg-white/10 -z-10" />
                                            
                                            {PIPELINE_STEPS.map((s) => {
                                                const isActive = s.step === currentStep;
                                                const isPast = s.step < currentStep;
                                                return (
                                                    <div key={s.step} className="flex flex-col items-center flex-1 z-10">
                                                        {/* Fixed size container for the circle to ensure alignment over the line */}
                                                        <div className="bg-[#111] px-2 mb-2 flex items-center justify-center">
                                                            <div className={`w-3 h-3 rounded-full border-2 transition-all ${
                                                                isActive
                                                                    ? "bg-pagani-gold border-pagani-gold shadow-[0_0_10px_rgba(212,175,55,0.6)] animate-pulse"
                                                                    : isPast
                                                                        ? "bg-pagani-gold border-pagani-gold"
                                                                        : "bg-black border-white/20"
                                                            }`} />
                                                        </div>
                                                        <span className={`text-[10px] uppercase tracking-widest text-center px-1 ${
                                                            isActive ? "text-pagani-gold" : isPast ? "text-pagani-gold/60" : "text-gray-600"
                                                        }`}>
                                                            {s.label}
                                                            {isPast && " ✓"}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Agent Timeline (visible during step 3) */}
                                        {currentStep >= 3 && pipeline.agents && (
                                            <div className="mb-3 bg-black/60 rounded-lg p-2 border border-white/5">
                                                <div className="text-[9px] text-blue-400 uppercase tracking-wider mb-1.5">Agent Execution</div>
                                                <div className="flex gap-2">
                                                    {["Retriever", "Analyst", "Writer"].map((name) => (
                                                        <div key={name} className="flex-1">
                                                            <div className="flex items-center gap-1 mb-1">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${pipeline.agents?.mode.includes(name) ? "bg-blue-400 animate-pulse" : pipeline.agents?.status === "done" ? "bg-green-500" : "bg-white/20"}`} />
                                                                <span className="text-[9px] text-white/60">{name}</span>
                                                            </div>
                                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full transition-all duration-500 ${
                                                                    pipeline.agents?.mode.includes(name) ? "bg-blue-500 w-2/3 animate-pulse" : "bg-green-500/40 w-full"
                                                                }`} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* Thinking Steps */}
                                                {thinkingSteps.length > 0 && (
                                                    <div className="mt-2 space-y-0.5">
                                                        {thinkingSteps.map((t, i) => (
                                                            <motion.div
                                                                key={i}
                                                                initial={{ opacity: 0, y: 4 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                className="text-[9px] text-gray-500 italic pl-3 border-l border-white/10"
                                                            >
                                                                {t}
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* LiveActivityFeed Console */}
                                        {showConsole && (
                                            <div className="mb-3">
                                                <LiveActivityFeed
                                                    events={sseEvents}
                                                    title="Backend Activity"
                                                    height="h-28"
                                                    onClear={() => setSSEEvents([])}
                                                />
                                            </div>
                                        )}
                                        <button
                                            onClick={() => setShowConsole(!showConsole)}
                                            className="text-[9px] text-white/30 hover:text-white/60 uppercase tracking-wider transition-colors mb-2"
                                        >
                                            {showConsole ? "Hide" : "Show"} Activity ({sseEvents.length})
                                        </button>

                                        {/* Evaluation Score Cards */}
                                        {pipeline.evaluation && (
                                            <div className="mt-2 grid grid-cols-3 gap-2 pb-2">
                                                {[
                                                    { label: "Faithfulness", value: pipeline.evaluation.relevance },
                                                    { label: "Relevance", value: pipeline.evaluation.accuracy },
                                                    { label: "Completeness", value: pipeline.evaluation.completeness },
                                                ].map((card, i) => (
                                                    <motion.div
                                                        key={card.label}
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        transition={{ delay: i * 0.15 }}
                                                        className="bg-black p-2 text-center border border-white/10 rounded"
                                                    >
                                                        <div className="text-[8px] text-gray-500 uppercase tracking-wider">{card.label}</div>
                                                        <div className={`text-sm font-bold ${getScoreColor(card.value || 0)}`}>
                                                            {Math.round((card.value || 0) * 100)}%
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Cost Summary */}
                                        {pipeline.cost && (
                                            <div className="text-[10px] text-gray-400 mt-1">
                                                ${pipeline.cost.estimated_cost_usd} · {pipeline.cost.input_tokens + pipeline.cost.output_tokens} tokens · {pipeline.cost.total_pipeline_ms}ms
                                            </div>
                                        )}

                                        <div className="animate-pulse flex gap-1 mt-2 font-mono text-[10px] text-green-400">
                                            <span className="w-1.5 h-3 bg-green-500 inline-block self-end"/>
                                            <span>{pipeline.currentStage ? `Executing ${pipeline.currentStage.toUpperCase()}...` : "Initializing connection..."}</span>
                                        </div>

                                    </div>
                                </motion.div>
                            )}

                            {/* Chunks Drawer Toggle */}
                            {retrievedChunks.length > 0 && pipeline.isComplete && (
                                <div className="mb-2">
                                    <button
                                        onClick={() => setShowChunksDrawer(!showChunksDrawer)}
                                        className="text-[10px] text-teal-400 hover:text-teal-300 transition-colors uppercase tracking-wider"
                                    >
                                        {showChunksDrawer ? "Hide" : "Show"} Context ({retrievedChunks.length} chunks)
                                    </button>
                                    {showChunksDrawer && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            className="mt-2 space-y-2 max-h-48 overflow-y-auto"
                                        >
                                            {retrievedChunks.map((chunk: any, i: number) => (
                                                <div key={i} className="bg-black/60 border border-white/10 rounded-lg p-2 text-[10px]">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 text-[8px] uppercase">
                                                            {chunk.chunk_type || "text"}
                                                        </span>
                                                        {chunk.heading_path && (
                                                            <span className="text-white/30 truncate">{chunk.heading_path}</span>
                                                        )}
                                                        {chunk.score && (
                                                            <span className={`ml-auto ${getScoreColor(chunk.score)}`}>
                                                                {(chunk.score * 100).toFixed(0)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-white/50 line-clamp-2">{chunk.text_preview || chunk.text?.slice(0, 120)}</p>
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </div>
                            )}

                            {/* Feedback Buttons (after completed response) */}
                            {pipeline.isComplete && messages.length > 1 && (
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-[9px] text-white/30 uppercase tracking-wider">Was this helpful?</span>
                                    {[1, -1].map((rating) => (
                                        <button
                                            key={rating}
                                            onClick={async () => {
                                                const lastUser = messages.filter(m => m.role === "user").pop();
                                                try {
                                                    const token = getToken();
                                                    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                                                    await fetch(`${apiBase}/api/v1/query/feedback`, {
                                                        method: "POST",
                                                        headers: {
                                                            "Content-Type": "application/json",
                                                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                                        },
                                                        body: JSON.stringify({ query: lastUser?.content || "", rating, comment: null }),
                                                    });
                                                } catch { /* silent */ }
                                            }}
                                            className="px-2 py-1 rounded border border-white/10 text-xs hover:bg-white/10 transition-colors"
                                        >
                                            {rating === 1 ? "👍" : "👎"}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="px-4 py-3 border-t border-pagani-gold/20 bg-black/30">
                            {/* Format Selector Pills */}
                            <div className="flex gap-2 mb-3 overflow-x-auto hidden-scrollbar pb-1">
                                {["Standard", "Bullet Points", "Executive Summary", "Technical Review"].map(fmt => (
                                    <button
                                        key={fmt}
                                        onClick={() => setSelectedFormat(fmt)}
                                        className={`whitespace-nowrap px-3 py-1 text-[10px] uppercase tracking-wider rounded-full border transition-all ${
                                            selectedFormat === fmt 
                                                ? "bg-pagani-gold/20 border-pagani-gold text-pagani-gold" 
                                                : "bg-black border-white/10 text-white/50 hover:bg-white/5 hover:text-white"
                                        }`}
                                    >
                                        {fmt}
                                    </button>
                                ))}
                            </div>
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
                                    className="px-4 py-2.5 bg-pagani-gold/15 border border-pagani-gold/30 rounded-lg text-pagani-gold hover:bg-pagani-gold hover:text-black transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-pagani-gold/15 disabled:hover:text-pagani-gold active:scale-95"
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
