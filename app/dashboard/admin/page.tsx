"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getUser, logout, type UserInfo } from "@/lib/auth";
import RAGDebugPanel, { DebugLoadingSteps, type DebugData } from "@/components/RAGDebugPanel";
import ChatAssistant from "@/components/ChatAssistant";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface ChatResponse {
    answer: string;
    sources: string[];
    confidence: number;
    user_role: string;
}

/* ═══════════════════════════════════════════════════════════════
   TYPES FOR LIVE DATA
   ═══════════════════════════════════════════════════════════════ */

interface LiveUser {
    username: string;
    role: string;
    created_at: string;
}

interface LiveAuditEntry {
    id: string;
    user: string;
    role: string;
    question: string;
    time: string;
    timestamp: string | null;
}

const ASSEMBLY_TIMELINE = [
    { phase: "Design & Prototyping", months: "0–8", pct: 100 },
    { phase: "Carbon Layup", months: "8–14", pct: 100 },
    { phase: "Powertrain Integration", months: "14–18", pct: 100 },
    { phase: "Assembly & QC", months: "18–22", pct: 100 },
    { phase: "Delivery & Commissioning", months: "22–24", pct: 100 },
];

const REVENUE_DATA = [
    { year: "2007", value: 4.5 },
    { year: "2008", value: 7.5 },
    { year: "2009", value: 6.0 },
    { year: "2010", value: 4.5 },
];

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    admin: { bg: "rgba(255,215,0,0.15)", text: "#FFD700", border: "rgba(255,215,0,0.4)" },
    engineer: { bg: "rgba(56,189,248,0.15)", text: "#38BDF8", border: "rgba(56,189,248,0.4)" },
    viewer: { bg: "rgba(156,163,175,0.15)", text: "#D1D5DB", border: "rgba(156,163,175,0.4)" },
};

/* ═══════════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ═══════════════════════════════════════════════════════════════ */

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    }),
};

/* ═══════════════════════════════════════════════════════════════
   ANIMATED COUNTER
   ═══════════════════════════════════════════════════════════════ */

function AnimatedCounter({ target, prefix = "", suffix = "", duration = 1.8 }: {
    target: number;
    prefix?: string;
    suffix?: string;
    duration?: number;
}) {
    const [current, setCurrent] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        let frame: number;
        const start = performance.now();
        const tick = (now: number) => {
            const elapsed = Math.min((now - start) / (duration * 1000), 1);
            const eased = 1 - Math.pow(1 - elapsed, 3); // easeOutCubic
            setCurrent(Math.round(target * eased));
            if (elapsed < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [target, duration]);

    return (
        <span ref={ref}>
            {prefix}{current.toLocaleString()}{suffix}
        </span>
    );
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function AdminDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [authorized, setAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);

    // Console state
    const [query, setQuery] = useState("");
    const [response, setResponse] = useState<ChatResponse | null>(null);
    const [queryError, setQueryError] = useState("");
    const [querying, setQuerying] = useState(false);

    // Debug mode state
    const [debugMode, setDebugMode] = useState(false);
    const [debugData, setDebugData] = useState<DebugData | null>(null);
    const [loadingStep, setLoadingStep] = useState<string>("");
    const [isChatOpen, setIsChatOpen] = useState(false);

    // Live data state
    const [liveUsers, setLiveUsers] = useState<LiveUser[]>([]);
    const [liveAudit, setLiveAudit] = useState<LiveAuditEntry[]>([]);

    /* ── Auth Verification ── */
    useEffect(() => {
        (async () => {
            try {
                const me = await getUser();
                if (me.role !== "admin") {
                    router.replace("/");
                    return;
                }
                setUser(me);
                setAuthorized(true);

                // Fetch real users
                try {
                    const usersData = await apiFetch<{ users: LiveUser[] }>("/api/v1/admin/users");
                    setLiveUsers(usersData.users || []);
                } catch (e) {
                    console.warn("Failed to load users:", e);
                }

                // Fetch real chat history
                try {
                    const chatsData = await apiFetch<{ chats: LiveAuditEntry[] }>("/api/v1/admin/recent-chats?limit=6");
                    setLiveAudit(chatsData.chats || []);
                } catch (e) {
                    console.warn("Failed to load chat history:", e);
                }
            } catch {
                logout();
                router.replace("/login");
            } finally {
                setLoading(false);
            }
        })();
    }, [router]);

    /* ── RAG Query ── */
    const handleQuery = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            const q = query.trim();
            if (!q || querying) return;

            setQuerying(true);
            setQueryError("");
            setResponse(null);
            setDebugData(null);

            try {
                if (debugMode) {
                    // Animated loading steps
                    setLoadingStep("embedding");
                    await new Promise((r) => setTimeout(r, 300));
                    setLoadingStep("searching");
                    await new Promise((r) => setTimeout(r, 200));
                    setLoadingStep("retrieving");
                    await new Promise((r) => setTimeout(r, 200));
                    setLoadingStep("reranking");

                    const data = await apiFetch<ChatResponse & { debug: DebugData }>("/api/chat/debug", {
                        method: "POST",
                        body: JSON.stringify({ question: q }),
                    });
                    setLoadingStep("generating");
                    await new Promise((r) => setTimeout(r, 150));
                    setLoadingStep("");
                    setResponse(data);
                    setDebugData(data.debug);
                } else {
                    const data = await apiFetch<ChatResponse>("/api/chat", {
                        method: "POST",
                        body: JSON.stringify({ question: q }),
                    });
                    setResponse(data);
                }
            } catch (err: unknown) {
                setLoadingStep("");
                setQueryError(err instanceof Error ? err.message : "Query failed.");
            } finally {
                setQuerying(false);
            }
        },
        [query, querying, debugMode]
    );

    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    const maxRevenue = Math.max(...REVENUE_DATA.map((d) => d.value));

    /* ── Loading / Auth gate ── */
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

    /* ═══════════════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════════════ */

    return (
        <div className="min-h-screen relative text-white bg-[#0A0A0A] overflow-hidden">
            {/* ── Background Effects ── */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#D4AF37]/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#2A2A2A]/40 rounded-full blur-[100px]" />
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20 mix-blend-overlay" />
            </div>

            {/* ── Top Bar ── */}
            <header
                className="sticky top-0 z-50 backdrop-blur-2xl border-b border-white/10"
                style={{ background: "rgba(10,10,10,0.6)" }}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 flex items-center justify-between h-14">
                    <div className="flex items-center gap-4">
                        <h1
                            className="text-sm font-bold tracking-tighter uppercase text-white"
                            style={{ fontFamily: "var(--font-orbitron)" }}
                        >
                            Pagani <span className="text-bright-gold">Command</span>
                        </h1>
                        <span className="hidden sm:inline text-[10px] text-gray-600 tracking-[0.25em] uppercase">
                            Executive Dashboard
                        </span>
                        <nav className="hidden md:flex items-center gap-1 ml-4">
                            {[
                                { href: "/evaluations", label: "Evaluations" },
                                { href: "/pipeline", label: "Pipeline" },
                                { href: "/admin", label: "Admin" },
                            ].map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="text-[10px] text-gray-500 hover:text-pagani-gold uppercase tracking-wider px-2.5 py-1.5 rounded-md hover:bg-white/5 transition-all"
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <button
                                onClick={() => setIsChatOpen(true)}
                                className="text-[10px] text-pagani-gold/70 hover:text-pagani-gold uppercase tracking-wider px-2.5 py-1.5 rounded-md hover:bg-pagani-gold/10 transition-all border border-pagani-gold/20"
                            >
                                💬 AI Chat
                            </button>
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-bright-gold/10 border border-bright-gold/30 flex items-center justify-center text-bright-gold text-[10px] font-bold uppercase">
                                {user?.username?.charAt(0) ?? "A"}
                            </div>
                            <div className="hidden sm:block">
                                <p className="text-xs text-white font-medium">{user?.username}</p>
                                <p className="text-[9px] text-bright-gold/60 uppercase tracking-wider">
                                    Administrator
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="text-[10px] text-gray-500 hover:text-red-400 border border-white/5 px-3 py-1.5 rounded-lg transition-colors uppercase tracking-wider"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Main Content ── */}
            <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-10 space-y-8">
                {/* ── Hero Stats ── */}
                <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                    initial="hidden"
                    animate="visible"
                >
                    {[
                        {
                            label: "Total Units Produced",
                            value: 15,
                            suffix: "",
                            accent: true,
                            sub: "All allocated pre-announcement",
                        },
                        {
                            label: "Remaining Inventory",
                            value: 0,
                            suffix: " units",
                            accent: false,
                            sub: "Production line closed",
                        },
                        {
                            label: "Unit Price (MSRP)",
                            value: 1500000,
                            prefix: "€",
                            suffix: "",
                            accent: true,
                            sub: "Excl. local taxes & duties",
                        },
                        {
                            label: "Revenue Projection",
                            value: 22500000,
                            prefix: "€",
                            suffix: "",
                            accent: false,
                            sub: "15 units × €1.5M base",
                        },
                    ].map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            variants={fadeUp}
                            custom={i}
                            className="group relative rounded-2xl p-5 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-pagani-gold/10 overflow-hidden backdrop-blur-xl"
                            style={{
                                background: "linear-gradient(145deg, rgba(30,30,30,0.6) 0%, rgba(15,15,15,0.8) 100%)",
                                border: stat.accent
                                    ? "1px solid rgba(255,215,0,0.25)"
                                    : "1px solid rgba(255,255,255,0.08)",
                                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.4)",
                            }}
                        >
                            <div
                                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                style={{
                                    boxShadow: stat.accent ? "inset 0 0 30px rgba(255,215,0,0.08)" : "inset 0 0 30px rgba(255,255,255,0.03)",
                                }}
                            />
                            {/* Glass reflection */}
                            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                            <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em] mb-2 font-medium z-10 relative">
                                {stat.label}
                            </p>
                            <p
                                className={`text-2xl sm:text-3xl font-bold tracking-tight ${stat.accent ? "text-bright-gold" : "text-white"
                                    }`}
                                style={{ fontFamily: "var(--font-orbitron)" }}
                            >
                                <AnimatedCounter
                                    target={stat.value}
                                    prefix={stat.prefix ?? ""}
                                    suffix={stat.suffix ?? ""}
                                />
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1">{stat.sub}</p>
                        </motion.div>
                    ))}
                </motion.div>

                {/* ── Row: Assembly Timeline + Revenue Chart ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Assembly Timeline */}
                    <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        custom={4}
                        className="rounded-2xl p-6 relative overflow-hidden backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:shadow-pagani-gold/5 border border-white/5 hover:border-white/10"
                        style={{
                            background: "linear-gradient(145deg, rgba(30,30,30,0.5) 0%, rgba(15,15,15,0.8) 100%)",
                            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.4)",
                        }}
                    >
                        <h3
                            className="text-xs font-bold text-bright-gold uppercase tracking-[0.15em] mb-5"
                            style={{ fontFamily: "var(--font-orbitron)" }}
                        >
                            Assembly Timeline
                        </h3>
                        <div className="space-y-3">
                            {ASSEMBLY_TIMELINE.map((step, i) => (
                                <motion.div
                                    key={step.phase}
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.6 + i * 0.1, duration: 0.4 }}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-gray-300">{step.phase}</span>
                                        <span className="text-[10px] text-gray-500">
                                            {step.months} mo
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full rounded-full"
                                            style={{
                                                background:
                                                    "linear-gradient(90deg, #D4AF37, #FFD700)",
                                            }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${step.pct}%` }}
                                            transition={{
                                                delay: 0.8 + i * 0.15,
                                                duration: 0.8,
                                                ease: "easeOut",
                                            }}
                                        />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                        <p className="text-[10px] text-gray-600 mt-4 italic">
                            All 15 units completed. Production closed 2010.
                        </p>
                    </motion.div>

                    {/* Revenue Bar Chart */}
                    <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        custom={5}
                        className="rounded-2xl p-6 relative overflow-hidden backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:shadow-pagani-gold/5 border border-white/5 hover:border-white/10"
                        style={{
                            background: "linear-gradient(145deg, rgba(30,30,30,0.5) 0%, rgba(15,15,15,0.8) 100%)",
                            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.4)",
                        }}
                    >
                        <h3
                            className="text-xs font-bold text-bright-gold uppercase tracking-[0.15em] mb-5"
                            style={{ fontFamily: "var(--font-orbitron)" }}
                        >
                            Revenue by Year (€M)
                        </h3>
                        <div className="flex items-end gap-3 h-[180px]">
                            {REVENUE_DATA.map((d, i) => (
                                <div key={d.year} className="flex-1 flex flex-col items-center gap-2">
                                    <span className="text-[10px] text-gray-400">
                                        €{d.value}M
                                    </span>
                                    <div className="w-full bg-white/5 rounded-t-md overflow-hidden relative" style={{ height: "140px" }}>
                                        <motion.div
                                            className="absolute bottom-0 left-0 right-0 rounded-t-md"
                                            style={{
                                                background:
                                                    "linear-gradient(180deg, #FFD700 0%, #D4AF37 100%)",
                                            }}
                                            initial={{ height: 0 }}
                                            animate={{
                                                height: `${(d.value / maxRevenue) * 100}%`,
                                            }}
                                            transition={{
                                                delay: 0.8 + i * 0.15,
                                                duration: 0.7,
                                                ease: "easeOut",
                                            }}
                                        />
                                    </div>
                                    <span className="text-[10px] text-gray-500">{d.year}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-gray-600 mt-4 italic">
                            Total lifetime revenue: €22.5M (15 × €1.5M MSRP)
                        </p>
                    </motion.div>
                </div>

                {/* ── Row: User Management + RAG Audit ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* User Management */}
                    <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        custom={6}
                        className="rounded-2xl p-6 relative overflow-hidden backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:shadow-pagani-gold/5 border border-white/5 hover:border-white/10"
                        style={{
                            background: "linear-gradient(145deg, rgba(30,30,30,0.5) 0%, rgba(15,15,15,0.8) 100%)",
                            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.4)",
                        }}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h3
                                className="text-xs font-bold text-bright-gold uppercase tracking-[0.15em]"
                                style={{ fontFamily: "var(--font-orbitron)" }}
                            >
                                User Management
                            </h3>
                            <span className="text-[10px] text-gray-500">
                                {liveUsers.length} registered
                            </span>
                        </div>
                        <div className="space-y-2">
                            {liveUsers.length === 0 ? (
                                <p className="text-xs text-gray-600 italic text-center py-4">No users found</p>
                            ) : liveUsers.map((u, i) => {
                                const rc = ROLE_COLORS[u.role] ?? ROLE_COLORS.viewer;
                                return (
                                    <motion.div
                                        key={u.username}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.7 + i * 0.06, duration: 0.35 }}
                                        className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/[0.02] transition-colors"
                                        style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold uppercase"
                                                style={{
                                                    background: rc.bg,
                                                    color: rc.text,
                                                    border: `1px solid ${rc.border}`,
                                                }}
                                            >
                                                {u.username.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-xs text-white font-medium">
                                                    {u.username}
                                                </p>
                                                <p className="text-[10px] text-gray-600">
                                                    Joined {new Date(u.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <span
                                            className="text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold"
                                            style={{
                                                background: rc.bg,
                                                color: rc.text,
                                                border: `1px solid ${rc.border}`,
                                            }}
                                        >
                                            {u.role}
                                        </span>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* RAG Query Audit */}
                    <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        custom={7}
                        className="rounded-2xl p-6 relative overflow-hidden backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:shadow-pagani-gold/5 border border-white/5 hover:border-white/10"
                        style={{
                            background: "linear-gradient(145deg, rgba(30,30,30,0.5) 0%, rgba(15,15,15,0.8) 100%)",
                            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.4)",
                        }}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h3
                                className="text-xs font-bold text-bright-gold uppercase tracking-[0.15em]"
                                style={{ fontFamily: "var(--font-orbitron)" }}
                            >
                                RAG Query Audit
                            </h3>
                            <span className="text-[10px] text-gray-500">{liveAudit.length > 0 ? `Last ${liveAudit.length} queries` : "No queries yet"}</span>
                        </div>
                        <div className="space-y-2">
                            {liveAudit.length === 0 ? (
                                <p className="text-xs text-gray-600 italic text-center py-4">No chat history yet. Start querying to see activity here.</p>
                            ) : liveAudit.map((entry, i) => {
                                const rc = ROLE_COLORS[entry.role] ?? ROLE_COLORS.viewer;
                                return (
                                    <motion.div
                                        key={entry.id || i}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.7 + i * 0.06, duration: 0.35 }}
                                        className="py-2.5 px-3 rounded-lg hover:bg-white/[0.02] transition-colors"
                                        style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-white font-medium">
                                                    {entry.user}
                                                </span>
                                                <span
                                                    className="text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider"
                                                    style={{
                                                        background: rc.bg,
                                                        color: rc.text,
                                                        border: `1px solid ${rc.border}`,
                                                    }}
                                                >
                                                    {entry.role}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-gray-600">
                                                {entry.time}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-400 truncate">
                                            &quot;{entry.question}&quot;
                                        </p>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>
                </div>

                {/* ── Executive Intelligence Console ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    custom={8}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-bright-gold animate-pulse" />
                            <p
                                className="text-xs text-bright-gold/80 uppercase tracking-[0.2em]"
                                style={{ fontFamily: "var(--font-orbitron)" }}
                            >
                                Executive Intelligence Console
                            </p>
                        </div>
                        {/* Debug Mode Toggle */}
                        <button
                            onClick={() => setDebugMode(!debugMode)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-semibold transition-all border ${debugMode
                                    ? "bg-[#FFD700]/10 text-[#FFD700] border-[#FFD700]/30 shadow-[0_0_12px_rgba(255,215,0,0.15)]"
                                    : "bg-white/[0.02] text-gray-500 border-white/5 hover:border-white/10"
                                }`}
                        >
                            <div
                                className={`w-6 h-3.5 rounded-full relative transition-colors ${debugMode ? "bg-[#FFD700]/30" : "bg-white/10"
                                    }`}
                            >
                                <div
                                    className={`absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all ${debugMode
                                            ? "left-3 bg-[#FFD700]"
                                            : "left-0.5 bg-gray-500"
                                        }`}
                                />
                            </div>
                            Debug Mode
                        </button>
                    </div>

                    <div
                        className="rounded-2xl overflow-hidden relative backdrop-blur-2xl"
                        style={{
                            background: "linear-gradient(145deg, rgba(20,20,20,0.8) 0%, rgba(10,10,10,0.95) 100%)",
                            border: "1px solid rgba(255,215,0,0.2)",
                            boxShadow: "0 0 40px rgba(255,215,0,0.05), inset 0 1px 1px rgba(255,255,255,0.05)",
                        }}
                    >
                        {/* Terminal raster scanline effect */}
                        <div className="absolute inset-0 pointer-events-none opacity-5 mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')]" />

                        {/* Input */}
                        <form onSubmit={handleQuery} className="flex border-b border-pagani-gold/20 focus-within:border-pagani-gold/50 transition-colors bg-black/40">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="[INPUT REQUIRED]: Enter executive intelligence query..."
                                disabled={querying}
                                className="flex-1 bg-transparent text-sm text-pagani-gold outline-none placeholder-pagani-gold/30 px-6 py-5 disabled:opacity-40"
                                style={{ fontFamily: "var(--font-rajdhani)" }}
                            />
                            <button
                                type="submit"
                                disabled={querying || !query.trim()}
                                className="px-8 text-xs text-pagani-black font-bold uppercase tracking-widest bg-pagani-gold hover:bg-bright-gold hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all disabled:opacity-30 disabled:hover:shadow-none border-l border-white/5"
                                style={{ fontFamily: "var(--font-orbitron)" }}
                            >
                                {querying ? (
                                    <motion.span
                                        animate={{ opacity: [0.4, 1, 0.4] }}
                                        transition={{ repeat: Infinity, duration: 1.2 }}
                                        className="flex items-center gap-2"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
                                        PROCESSING
                                    </motion.span>
                                ) : (
                                    "EXECUTE"
                                )}
                            </button>
                        </form>

                        {/* Response Panel */}
                        <div className="min-h-[120px] p-6 bg-black/20">
                            {!response && !queryError && !querying && (
                                <div className="flex flex-col items-center justify-center h-full space-y-2 opacity-30">
                                    <div className="w-8 h-[1px] bg-pagani-gold" />
                                    <p className="text-pagani-gold text-[10px] uppercase tracking-[0.2em] font-medium">
                                        System Ready: Awaiting Query
                                    </p>
                                    <div className="w-8 h-[1px] bg-pagani-gold" />
                                </div>
                            )}

                            {querying && (
                                <div className="flex flex-col items-center justify-center py-4 space-y-4">
                                    {debugMode && loadingStep ? (
                                        <div className="w-full px-2">
                                            <DebugLoadingSteps step={loadingStep} />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="relative">
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                                    className="w-10 h-10 border border-pagani-gold/20 border-t-pagani-gold rounded-full"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-1 h-1 bg-pagani-gold rounded-full animate-ping" />
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-pagani-gold/60 uppercase tracking-[0.3em] animate-pulse">
                                                Decrypting Intelligence...
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}

                            {queryError && (
                                <div className="p-3 rounded-lg bg-red-500/8 border border-red-500/15">
                                    <p className="text-red-400 text-xs">⚠ {queryError}</p>
                                </div>
                            )}

                            {response && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4 }}
                                    className="space-y-3"
                                >
                                    <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                                        {response.answer}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5">
                                        <span
                                            className="text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider"
                                            style={{
                                                background:
                                                    (typeof response.confidence === 'number' ? response.confidence : 0) >= 0.7
                                                        ? "rgba(34,197,94,0.1)"
                                                        : "rgba(234,179,8,0.1)",
                                                color:
                                                    (typeof response.confidence === 'number' ? response.confidence : 0) >= 0.7 ? "#4ade80" : "#facc15",
                                                border:
                                                    (typeof response.confidence === 'number' ? response.confidence : 0) >= 0.7
                                                        ? "1px solid rgba(34,197,94,0.2)"
                                                        : "1px solid rgba(234,179,8,0.2)",
                                            }}
                                        >
                                            Confidence: {typeof response.confidence === 'number' && !isNaN(response.confidence) ? (response.confidence * 100).toFixed(0) : "0"}%
                                        </span>
                                        {response.sources.map((src) => (
                                            <span
                                                key={src}
                                                className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded"
                                            >
                                                {src}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Debug Panel */}
                                    {debugMode && debugData && (
                                        <RAGDebugPanel debug={debugData} />
                                    )}
                                </motion.div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </main>

            {/* ── Footer ── */}
            <footer className="border-t border-white/5 px-6 py-4 text-center">
                <p className="text-[10px] text-gray-700 tracking-wider uppercase">
                    © {new Date().getFullYear()} Pagani Automobili S.p.A. — Executive Command
                </p>
            </footer>

            {/* ── AI Chat Assistant ── */}
            <ChatAssistant
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
            />
            {!isChatOpen && (
                <button
                    onClick={() => setIsChatOpen(true)}
                    className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 md:hidden"
                    style={{
                        background: "linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0.05) 100%)",
                        border: "1px solid rgba(212,175,55,0.35)",
                        boxShadow: "0 0 30px rgba(212,175,55,0.1)",
                    }}
                    aria-label="Open AI Assistant"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.5">
                        <path d="M12 2a10 10 0 0110 10c0 5.523-4.477 10-10 10a10 10 0 01-8.94-5.526L2 22l2.526-5.06A10 10 0 0112 2z" />
                        <path d="M8 10h8M8 14h5" strokeLinecap="round" />
                    </svg>
                </button>
            )}
        </div>
    );
}