"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { getUser, type UserInfo } from "@/lib/auth";

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    }),
};

interface UserObj {
    username: string;
    role: string;
    created_at: string;
}

interface ReviewItem {
    id: string;
    username: string;
    question: string;
    reason: string;
    status: string;
    created_at: string;
}

const ADMIN_KEY = "pagani-super-secret-admin";

export default function AdminPage() {
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [adminKey, setAdminKey] = useState("");
    const [gatePassed, setGatePassed] = useState(false);
    const [activeTab, setActiveTab] = useState("Roles");
    const TABS = ["Roles", "Metrics", "Review Queue", "Reports", "Audit Logs", "Documents"];

    const [users, setUsers] = useState<UserObj[]>([]);
    const [rolesAudit, setRolesAudit] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);

    const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editResponseText, setEditResponseText] = useState("");

    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    // Document Management State
    const [documents, setDocuments] = useState<any[]>([]);
    const [selectedDocVersions, setSelectedDocVersions] = useState<any[]>([]);
    const [viewingDocId, setViewingDocId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewContent, setPreviewContent] = useState<any>(null);
    const [isFetchingPreview, setIsFetchingPreview] = useState(false);



    useEffect(() => {
        (async () => {
            try {
                const me = await getUser();
                if (me.role !== "admin") {
                    router.replace("/");
                    return;
                }
                setUser(me);

                // Fetch data independently — don't let one failure crash everything
                try {
                    const usersData = await apiFetch<{ users: UserObj[] }>("/api/v1/admin/users");
                    setUsers(usersData.users);
                } catch { /* users endpoint may fail silently */ }

                try {
                    const auditData = await apiFetch<{ audit_logs: any[] }>("/api/v1/admin/roles/audit");
                    setRolesAudit(auditData.audit_logs || []);
                } catch { /* audit endpoint may fail silently */ }
            } catch {
                router.replace("/");
            } finally {
                setLoading(false);
            }
        })();
    }, [router]);

    const changeRole = async (username: string, newRole: string) => {
        try {
            await apiFetch(`/api/v1/admin/users/${username}/role`, {
                method: "PUT",
                body: JSON.stringify({ new_role: newRole })
            });
            setUsers(prev => prev.map(u => u.username === username ? { ...u, role: newRole } : u));
        } catch (err) {
            console.error(err);
        }
    };

    const deleteUser = async (username: string) => {
        if (!confirm(`Are you sure you want to completely remove user ${username}? This cannot be undone.`)) return;
        try {
            await apiFetch(`/api/v1/admin/users/${username}`, { method: "DELETE" });
            setUsers(prev => prev.filter(u => u.username !== username));
        } catch (err) {
            console.error(err);
            alert("Failed to delete user.");
        }
    };

    useEffect(() => {
        if (activeTab === "Metrics" && gatePassed) {
            (async () => {
                try {
                    const data = await apiFetch<any>("/api/v1/analytics/summary", {
                        headers: { "X-Admin-Key": ADMIN_KEY }
                    });
                    setSummary(data);
                } catch (err: any) {
                    console.error("Failed to fetch analytics summary:", err);
                }
            })();
        } else if (activeTab === "Review Queue" && gatePassed) {
            (async () => {
                try {
                    const data = await apiFetch<{ review_queue: ReviewItem[] }>("/api/v1/admin/review-queue", {
                        headers: { "X-Admin-Key": ADMIN_KEY }
                    });
                    setReviewItems(data.review_queue || []);
                } catch (err: any) {
                    console.error("Failed to fetch review queue:", err);
                }
            })();
        } else if (activeTab === "Reports" && gatePassed) {
            (async () => {
                try {
                    const data = await apiFetch<{ reports: any[] }>("/api/v1/admin/strategist-reports", {
                        headers: { "X-Admin-Key": ADMIN_KEY }
                    });
                    setReports(data.reports || []);
                } catch (err: any) {
                    console.error("Failed to fetch reports:", err);
                }
            })();
        } else if (activeTab === "Audit Logs" && gatePassed) {
            (async () => {
                try {
                    const data = await apiFetch<{ logs: any[] }>("/api/v1/admin/audit-log", {
                        headers: { "X-Admin-Key": ADMIN_KEY }
                    });
                    setAuditLogs(data.logs || []);
                } catch (err: any) {
                    console.error("Failed to fetch audit logs:", err);
                }
            })();
        } else if (activeTab === "Documents" && gatePassed) {
            fetchDocuments();
        }
    }, [activeTab, gatePassed]);

    const fetchDocuments = async () => {
        try {
            const data = await apiFetch<{ documents: any[] }>("/api/v1/documents");
            setDocuments(data.documents || []);
        } catch (err) {
            console.error("Failed to fetch documents:", err);
        }
    };

    const fetchVersions = async (docId: string) => {
        try {
            const data = await apiFetch<{ versions: any[] }>(`/api/v1/documents/${docId}/versions`);
            setSelectedDocVersions(data.versions || []);
            setViewingDocId(docId);
        } catch (err) {
            console.error("Failed to fetch versions:", err);
        }
    };

    const handleRestore = async (docId: string, versionNum: number) => {
        if (!confirm(`Are you sure you want to restore document to version ${versionNum}?`)) return;
        try {
            await apiFetch(`/api/v1/documents/${docId}/restore/${versionNum}`, { method: "POST" });
            alert("Restored successfully!");
            fetchDocuments();
            setViewingDocId(null);
        } catch (err) {
            console.error("Restore failed:", err);
            alert("Restore failed.");
        }
    };

    const handleDelete = async (docId: string, filename: string) => {
        if (!confirm(`Are you sure you want to permanently delete "${filename}"? This will remove all versions from the database and the vector store.`)) {
            return;
        }

        try {
            await apiFetch(`/api/v1/documents/${docId}`, {
                method: "DELETE"
            });
            alert("Document deleted successfully");
            fetchDocuments();
        } catch (err: any) {
            console.error("Delete failed:", err);
            alert(`Failed to delete document: ${err.message}`);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            // Use standard fetch here because apiFetch forces JSON content-type
            const token = localStorage.getItem("pagani_access_token");
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/documents/upload`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            if (!res.ok) throw new Error("Upload failed");
            
            alert("Uploaded successfully!");
            fetchDocuments();
        } catch (err) {
            console.error("Upload failed:", err);
            e.target.value = "";
        } finally {
            setIsUploading(false);
            e.target.value = "";
        }
    };

    const handlePreview = async (docId: string) => {
        setIsFetchingPreview(true);
        setIsPreviewOpen(true);
        try {
            const data = await apiFetch<any>(`/api/v1/documents/${docId}/content`);
            setPreviewContent(data);
        } catch (err) {
            console.error("Preview failed:", err);
            setPreviewContent({ content: "Failed to load document content.", filename: "Error" });
        } finally {
            setIsFetchingPreview(false);
        }
    };

    const handleAuth = (e: React.FormEvent) => {
        e.preventDefault();
        if (!adminKey) return;
        setGatePassed(true);
    };

    const handleReviewAction = async (itemId: string, action: string, editedResponse?: string) => {
        try {
            await apiFetch(`/api/v1/admin/review/${itemId}`, {
                method: "PATCH",
                headers: { "X-Admin-Key": ADMIN_KEY },
                body: JSON.stringify({ action, edited_response: editedResponse })
            });
            setReviewItems(prev => prev.filter(item => item.id !== itemId));
            setEditingItemId(null);
            setEditResponseText("");
        } catch (err) {
            console.error("Failed to process review action:", err);
            alert("Action failed. Check console.");
        }
    };

    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        try {
            await apiFetch("/api/v1/admin/strategist/trigger", {
                method: "POST",
                headers: { "X-Admin-Key": ADMIN_KEY }
            });
            // Fetch reports again
            const data = await apiFetch<{ reports: any[] }>("/api/v1/admin/strategist-reports", {
                headers: { "X-Admin-Key": ADMIN_KEY }
            });
            setReports(data.reports || []);
            alert("Report generated successfully!");
        } catch (err: any) {
            console.log("Strategist trigger returned an expected error:", err.message);
            alert(err.message || "Failed to generate report. Make sure there are pending reviews in the queue.");
        } finally {
            setIsGeneratingReport(false);
        }
    };



    if (loading) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                    className="w-10 h-10 border-2 border-pagani-gold/30 border-t-pagani-gold rounded-full"
                />
            </div>
        );
    }
    if (!user) return null;

    return (
        <div className="min-h-screen relative text-white bg-[#0A0A0A] overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#D4AF37]/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#2A2A2A]/40 rounded-full blur-[100px]" />
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20 mix-blend-overlay" />
            </div>

            {/* Top Bar */}
            <header className="sticky top-0 z-50 backdrop-blur-2xl border-b border-white/10 bg-[#0A0A0A]/60">
                <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
                    <h1 className="text-sm font-bold tracking-tighter uppercase text-white font-[var(--font-orbitron)]">
                        Pagani <span className="text-pagani-gold">Admin</span>
                    </h1>
                    <div className="flex items-center gap-4">
                        <span className="text-xs">{user.username}</span>
                        <button onClick={() => router.replace("/dashboard/admin")} className="text-[10px] uppercase text-gray-500 hover:text-white">Dashboard</button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
                {!gatePassed ? (
                    <div className="max-w-md mx-auto mt-20">
                        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="bg-[#111] border border-white/10 rounded-xl p-8 shadow-2xl backdrop-blur-md text-center">
                            <div className="w-12 h-12 mx-auto mb-4 bg-pagani-gold/20 flex items-center justify-center rounded-full text-pagani-gold text-2xl">🔒</div>
                            <h2 className="text-xl font-bold font-[var(--font-orbitron)] text-white mb-2">Admin Terminal</h2>
                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-6">Enter X-Admin-Key to proceed</p>
                            <form onSubmit={handleAuth} className="flex gap-2 justify-center">
                                <input type="password" value={adminKey} onChange={e => setAdminKey(e.target.value)} className="bg-black border border-white/20 rounded px-4 py-2 text-sm text-white outline-none focus:border-pagani-gold w-full" placeholder="Secure Key..." />
                                <button type="submit" className="bg-pagani-gold text-black uppercase tracking-widest text-[10px] font-bold px-4 rounded hover:bg-[#b0902c] transition-colors">Auth</button>
                            </form>
                        </motion.div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Tab Bar */}
                        <div className="flex gap-2 border-b border-white/10 mx-auto overflow-x-auto hidden-scrollbar">
                            {TABS.map(t => (
                                <button
                                    key={t}
                                    onClick={() => setActiveTab(t)}
                                    className={`px-4 py-3 text-xs uppercase tracking-widest font-bold whitespace-nowrap transition-colors border-b-2 ${activeTab === t ? "text-pagani-gold border-pagani-gold" : "text-gray-500 border-transparent hover:text-white"}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        {activeTab === "Roles" && (
                            <>
                                <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
                                    <h2 className="text-2xl font-bold font-[var(--font-orbitron)] text-pagani-gold">Role Management</h2>
                                    <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest">Enterprise Access Control</p>
                                </motion.div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="bg-[#111] border border-white/10 rounded-xl p-6 shadow-2xl backdrop-blur-md">
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-white/10 pb-2">Users ({users.length})</h3>
                                        <div className="space-y-3">
                                            {users.map((u) => (
                                                <div key={u.username} className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-lg hover:border-pagani-gold/50 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-pagani-gold/20 flex items-center justify-center text-pagani-gold font-bold uppercase">{u.username[0]}</div>
                                                        <div>
                                                            <div className="text-xs font-bold text-white">{u.username}</div>
                                                            <div className="text-[10px] text-gray-500">Joined: {new Date(u.created_at).toLocaleDateString()}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            value={u.role}
                                                            onChange={(e) => changeRole(u.username, e.target.value)}
                                                            disabled={user?.username === u.username}
                                                            className="bg-black border border-white/20 text-xs text-white rounded p-1 outline-none focus:border-pagani-gold disabled:opacity-50"
                                                        >
                                                            <option value="viewer">Viewer</option>
                                                            <option value="engineer">Engineer</option>
                                                            <option value="admin">Admin</option>
                                                        </select>
                                                        <button
                                                            onClick={() => deleteUser(u.username)}
                                                            disabled={user?.username === u.username}
                                                            className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors text-[10px] px-2 py-1 rounded border border-red-500/20 uppercase tracking-wider font-bold disabled:opacity-20 disabled:hover:bg-red-500/10 disabled:hover:text-red-500"
                                                            title="Remove User"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>

                                    <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="bg-[#111] border border-white/10 rounded-xl p-6 shadow-2xl backdrop-blur-md">
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-white/10 pb-2">Role Audit Log</h3>
                                        <div className="space-y-3 max-h-[500px] overflow-y-auto hidden-scrollbar">
                                            {rolesAudit.map((log, i) => (
                                                <div key={i} className="bg-white/5 border border-white/10 p-3 rounded-lg">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-xs text-gray-400">Changed <span className="text-white font-bold">{log.target_user}</span></div>
                                                        <div className="text-[10px] text-gray-600">{new Date(log.timestamp).toLocaleString()}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-2 text-[10px]">
                                                        <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded uppercase">{log.old_role}</span>
                                                        <span className="text-white">→</span>
                                                        <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded uppercase">{log.new_role}</span>
                                                    </div>
                                                    <div className="text-[9px] text-gray-500 mt-2 uppercase">By Admin: {log.changed_by}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                </div>
                            </>
                        )}

                        {activeTab === "Metrics" && summary && (
                            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-8">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <h2 className="text-2xl font-bold font-[var(--font-orbitron)] text-pagani-gold uppercase tracking-tighter">Enterprise Metrics</h2>
                                        <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest">Real-time Pipeline Intelligence</p>
                                    </div>
                                    <div className="text-xs text-gray-600 uppercase">Last updated: {new Date(summary.generated_at).toLocaleTimeString()}</div>
                                </div>

                                {/* Top Stat Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="bg-[#111] border border-white/10 rounded-xl p-6 shadow-2xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-pagani-gold/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-pagani-gold/10" />
                                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Avg Response (TTFT)</p>
                                        <h3 className="text-2xl font-bold text-white font-[var(--font-orbitron)]">{summary.avg_response_time_ms}<span className="text-pagani-gold text-sm ml-1">ms</span></h3>
                                        <div className="mt-2 text-xs text-green-500 uppercase font-bold">Stable Pipeline</div>
                                    </div>
                                    <div className="bg-[#111] border border-white/10 rounded-xl p-6 shadow-2xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-red-500/10" />
                                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Failed Query Rate</p>
                                        <h3 className="text-2xl font-bold text-white font-[var(--font-orbitron)]">{summary.failed_query_rate}<span className="text-red-500 text-sm ml-1">%</span></h3>
                                        <div className={`mt-2 text-xs uppercase font-bold ${summary.failed_query_rate < 5 ? 'text-green-500' : 'text-amber-500'}`}>
                                            {summary.failed_query_rate < 5 ? 'Healthy' : 'Needs Optimization'}
                                        </div>
                                    </div>
                                    <div className="bg-[#111] border border-white/10 rounded-xl p-6 shadow-2xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-blue-500/10" />
                                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Avg Session</p>
                                        <h3 className="text-2xl font-bold text-white font-[var(--font-orbitron)]">{Math.round(summary.avg_session_duration_s / 60)}<span className="text-blue-500 text-sm ml-1">min</span></h3>
                                        <div className="mt-2 text-xs text-blue-400 uppercase font-bold">User Engagement</div>
                                    </div>
                                    <div className="bg-[#111] border border-white/10 rounded-xl p-6 shadow-2xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-green-500/10" />
                                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Active Documents</p>
                                        <h3 className="text-2xl font-bold text-white font-[var(--font-orbitron)]">{documents.length}</h3>
                                        <div className="mt-2 text-xs text-green-400 uppercase font-bold">Knowledge Base</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Query Volume Chart */}
                                    <div className="bg-[#111] border border-white/10 rounded-xl p-6 shadow-2xl">
                                        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 border-b border-white/5 pb-3 flex justify-between">
                                            Query Volume (Last 7 Days)
                                            <span className="text-pagani-gold text-sm">Total: {summary.query_volume.reduce((a: any, b: any) => a + b.count, 0)}</span>
                                        </h3>
                                        <div className="h-48 flex items-end gap-2 px-2">
                                            {summary.query_volume.map((day: any, i: number) => {
                                                const maxCount = Math.max(...summary.query_volume.map((d: any) => d.count), 1);
                                                const height = (day.count / maxCount) * 100;
                                                return (
                                                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                                        <div className="relative w-full">
                                                            <motion.div 
                                                                initial={{ height: 0 }}
                                                                animate={{ height: `${height}%` }}
                                                                className="w-full bg-pagani-gold/20 border-t border-pagani-gold/50 rounded-t-sm group-hover:bg-pagani-gold/40 transition-all relative"
                                                            >
                                                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-pagani-gold text-[10px] font-bold px-1.5 py-0.5 rounded border border-pagani-gold/20">
                                                                    {day.count}
                                                                </div>
                                                            </motion.div>
                                                        </div>
                                                        <span className="text-[10px] text-gray-600 font-bold uppercase">{day.date}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Top Documents */}
                                    <div className="bg-[#111] border border-white/10 rounded-xl p-6 shadow-2xl">
                                        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 border-b border-white/5 pb-3">Top 5 Documents</h3>
                                        <div className="space-y-4">
                                            {summary.top_documents.length === 0 ? (
                                                <p className="text-center py-10 text-xs text-gray-600 uppercase italic">No retrieval data yet</p>
                                            ) : (
                                                summary.top_documents.map((doc: any, i: number) => {
                                                    const maxCount = Math.max(...summary.top_documents.map((d: any) => d.count), 1);
                                                    const width = (doc.count / maxCount) * 100;
                                                    return (
                                                        <div key={i} className="space-y-1">
                                                            <div className="flex justify-between text-xs uppercase font-bold">
                                                                <span className="text-white truncate max-w-[200px]">{doc.id}</span>
                                                                <span className="text-pagani-gold">{doc.count} hits</span>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                                <motion.div 
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${width}%` }}
                                                                    className="h-full bg-pagani-gold rounded-full"
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === "Review Queue" && (
                            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-6">
                                <h2 className="text-2xl font-bold font-[var(--font-orbitron)] text-pagani-gold">Review Queue</h2>
                                <p className="text-xs text-gray-500 uppercase tracking-widest">Gatekeeper Flagged Queries</p>
                                
                                {reviewItems.length === 0 ? (
                                    <div className="bg-[#111] border border-white/10 rounded-xl p-12 text-center">
                                        <span className="text-4xl block mb-4">✅</span>
                                        <h3 className="text-lg font-bold text-white uppercase tracking-widest">All Clear</h3>
                                        <p className="text-xs text-gray-500 mt-2">No queries currently awaiting review.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {reviewItems.map(item => (
                                            <div key={item.id} className="bg-[#111] border border-white/10 rounded-xl p-6 shadow-2xl relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-pagani-gold" />
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <div className="text-xs text-pagani-gold font-bold uppercase tracking-wider">User: {item.username}</div>
                                                        <div className="text-[10px] text-gray-500">{new Date(item.created_at).toLocaleString()}</div>
                                                    </div>
                                                    <div className="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded text-[10px] uppercase font-bold">
                                                        {item.reason}
                                                    </div>
                                                </div>
                                                <div className="bg-black/50 p-4 rounded-lg border border-white/5 mb-4">
                                                    <p className="text-sm text-gray-300">"{item.question}"</p>
                                                </div>
                                                
                                                {editingItemId === item.id ? (
                                                    <div className="mb-4 space-y-2">
                                                        <textarea 
                                                            className="w-full bg-black border border-pagani-gold/50 rounded p-3 text-sm text-white outline-none focus:border-pagani-gold h-24"
                                                            placeholder="Enter edited response..."
                                                            value={editResponseText}
                                                            onChange={e => setEditResponseText(e.target.value)}
                                                        />
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={() => handleReviewAction(item.id, "edit", editResponseText)}
                                                                className="bg-pagani-gold text-black px-4 py-2 rounded text-xs font-bold uppercase tracking-wider hover:bg-[#b0902c] transition-colors"
                                                            >
                                                                Submit Edit
                                                            </button>
                                                            <button 
                                                                onClick={() => setEditingItemId(null)}
                                                                className="bg-transparent border border-white/20 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-3">
                                                        <button 
                                                            onClick={() => handleReviewAction(item.id, "approve")}
                                                            className="bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white border border-green-500/50 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button 
                                                            onClick={() => handleReviewAction(item.id, "reject")}
                                                            className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/50 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors"
                                                        >
                                                            Reject
                                                        </button>
                                                        <button 
                                                            onClick={() => { setEditingItemId(item.id); setEditResponseText(""); }}
                                                            className="bg-pagani-gold/20 text-pagani-gold hover:bg-pagani-gold hover:text-black border border-pagani-gold/50 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors"
                                                        >
                                                            Edit & Approve
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}



                        {activeTab === "Reports" && (
                            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-2xl font-bold font-[var(--font-orbitron)] text-pagani-gold">Strategist Reports</h2>
                                        <p className="text-xs text-gray-500 uppercase tracking-widest">Nightly AI Analysis Reports</p>
                                    </div>
                                    <button 
                                        onClick={handleGenerateReport}
                                        disabled={isGeneratingReport}
                                        className="bg-pagani-gold text-black px-4 py-2 rounded text-xs font-bold uppercase tracking-wider hover:bg-[#b0902c] transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isGeneratingReport ? (
                                            <>
                                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-3 h-3 border border-black border-t-transparent rounded-full" />
                                                Generating...
                                            </>
                                        ) : "Generate Report Now"}
                                    </button>
                                </div>
                                
                                {reports.length === 0 ? (
                                    <div className="bg-[#111] border border-white/10 rounded-xl p-12 text-center">
                                        <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest">No reports generated yet.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {reports.map(report => (
                                            <div key={report.id} className="bg-[#111] border border-white/10 rounded-xl p-6 shadow-2xl relative overflow-hidden">
                                                <div className="flex justify-between items-start mb-4 border-b border-white/10 pb-4">
                                                    <div>
                                                        <div className="text-xs text-white font-bold uppercase tracking-wider mb-1">Report ID: {report.id}</div>
                                                        <div className="text-[10px] text-gray-500">
                                                            {report.created_at ? new Date(report.created_at).toLocaleString() : "Unknown"} 
                                                            {report.period_start && ` | Period: ${new Date(report.period_start).toLocaleDateString()} - ${new Date(report.period_end).toLocaleDateString()}`}
                                                        </div>
                                                    </div>
                                                    <div className="bg-pagani-gold/20 text-pagani-gold px-3 py-1 rounded text-[10px] uppercase font-bold">
                                                        Analyzed: {report.queries_analyzed} queries
                                                    </div>
                                                </div>
                                                <div className="text-sm text-gray-300 whitespace-pre-wrap font-mono bg-black/50 p-4 rounded-lg border border-white/5">
                                                    {report.report_text}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {activeTab === "Audit Logs" && (
                            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-6">
                                <h2 className="text-2xl font-bold font-[var(--font-orbitron)] text-pagani-gold">System Audit Logs</h2>
                                <p className="text-xs text-gray-500 uppercase tracking-widest">Global Activity Tracking</p>
                                
                                <div className="bg-[#111] border border-white/10 rounded-xl p-6 shadow-2xl overflow-hidden">
                                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto hidden-scrollbar">
                                        {auditLogs.length === 0 ? (
                                            <p className="text-center text-xs text-gray-500 py-10 uppercase tracking-widest">No logs found.</p>
                                        ) : (
                                            <table className="w-full text-left border-collapse">
                                                <thead className="sticky top-0 bg-[#111] z-10 border-b border-white/10">
                                                    <tr>
                                                        <th className="p-3 text-[10px] text-pagani-gold uppercase tracking-wider font-bold">Time</th>
                                                        <th className="p-3 text-[10px] text-pagani-gold uppercase tracking-wider font-bold">Action</th>
                                                        <th className="p-3 text-[10px] text-pagani-gold uppercase tracking-wider font-bold">User</th>
                                                        <th className="p-3 text-[10px] text-pagani-gold uppercase tracking-wider font-bold">Metadata</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {auditLogs.map((log, i) => (
                                                        <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                            <td className="p-3 text-[10px] text-gray-400 whitespace-nowrap">
                                                                {log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}
                                                            </td>
                                                            <td className="p-3">
                                                                <span className="bg-white/10 text-white px-2 py-1 rounded text-[10px] uppercase font-bold">
                                                                    {log.action}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-xs text-gray-300">
                                                                {log.user_id || "System"}
                                                            </td>
                                                            <td className="p-3 text-[10px] text-gray-500 max-w-xs truncate" title={log.metadata ? JSON.stringify(log.metadata) : ""}>
                                                                {log.metadata ? JSON.stringify(log.metadata) : "—"}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === "Documents" && (
                            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h2 className="text-2xl font-bold font-[var(--font-orbitron)] text-pagani-gold">Document Management</h2>
                                        <p className="text-xs text-gray-500 uppercase tracking-widest">Versioned Knowledge Base</p>
                                    </div>
                                    <label className="bg-pagani-gold text-black px-4 py-2 rounded text-xs font-bold uppercase tracking-wider hover:bg-[#b0902c] transition-colors cursor-pointer flex items-center gap-2">
                                        {isUploading ? (
                                            <>
                                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-3 h-3 border border-black border-t-transparent rounded-full" />
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                                Upload New Document
                                            </>
                                        )}
                                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {documents.map((doc) => (
                                        <div key={doc.id} className="bg-[#111] border border-white/10 rounded-xl p-5 hover:border-pagani-gold/40 transition-all group relative">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                                </div>
                                                <div className="bg-pagani-gold/20 text-pagani-gold px-2 py-0.5 rounded text-[10px] font-bold">V{doc.version}</div>
                                            </div>
                                            <h4 className="text-sm font-bold text-white truncate mb-1" title={doc.filename}>{doc.filename}</h4>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">
                                                {doc.type} • {doc.file_size ? (Number(doc.file_size) / 1024).toFixed(1) : 0} KB
                                            </p>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => fetchVersions(doc.id)}
                                                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded py-2 text-[10px] font-bold uppercase tracking-wider transition-colors"
                                                >
                                                    History
                                                </button>
                                                <button 
                                                    onClick={() => handlePreview(doc.id)}
                                                    className="bg-pagani-gold/10 hover:bg-pagani-gold/20 border border-pagani-gold/20 text-pagani-gold rounded px-3 py-2 transition-colors"
                                                    title="Preview"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(doc.id, doc.filename)}
                                                    className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded px-3 py-2 transition-colors"
                                                    title="Delete"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}
            </main>

            {/* Version History Modal */}
            {viewingDocId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => setViewingDocId(null)}
                    />
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg relative z-10 overflow-hidden shadow-2xl"
                    >
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold font-[var(--font-orbitron)] text-pagani-gold">Version History</h3>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Select a version to restore</p>
                            </div>
                            <button onClick={() => setViewingDocId(null)} className="text-gray-500 hover:text-white transition-colors">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="p-4 max-h-[400px] overflow-y-auto hidden-scrollbar space-y-3">
                            {selectedDocVersions.map((v) => (
                                <div key={v.id} className="bg-white/5 border border-white/5 rounded-xl p-4 flex items-center justify-between group hover:border-pagani-gold/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-full bg-pagani-gold/10 flex items-center justify-center text-pagani-gold text-[10px] font-bold">
                                            V{v.version_number}
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-white">Uploaded by {v.created_by}</div>
                                            <div className="text-[10px] text-gray-500">{new Date(v.created_at).toLocaleString()} • Hash: {v.hash}</div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleRestore(viewingDocId, v.version_number)}
                                        className="bg-white/5 hover:bg-pagani-gold hover:text-black border border-white/10 group-hover:border-pagani-gold transition-all px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider"
                                    >
                                        Restore
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-black/40 text-center border-t border-white/5">
                            <p className="text-[10px] text-gray-600 uppercase tracking-widest">Restoring will update the active document in the RAG pipeline</p>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Document Preview Modal */}
            {isPreviewOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/90 backdrop-blur-md"
                        onClick={() => { setIsPreviewOpen(false); setPreviewContent(null); }}
                    />
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] relative z-10 overflow-hidden shadow-2xl flex flex-col"
                    >
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
                            <div>
                                <h3 className="text-lg font-bold font-[var(--font-orbitron)] text-pagani-gold">Document Preview</h3>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
                                    {isFetchingPreview ? "Loading content..." : `Viewing: ${previewContent?.filename || "..."}`}
                                </p>
                            </div>
                            <button onClick={() => { setIsPreviewOpen(false); setPreviewContent(null); }} className="text-gray-500 hover:text-white transition-colors p-2 bg-white/5 rounded-full">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 bg-[#0a0a0a]">
                            {isFetchingPreview ? (
                                <div className="h-64 flex flex-col items-center justify-center gap-4">
                                    <motion.div 
                                        animate={{ rotate: 360 }} 
                                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                        className="w-10 h-10 border-2 border-pagani-gold/30 border-t-pagani-gold rounded-full"
                                    />
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Extracting Knowledge...</span>
                                </div>
                            ) : (
                                <div className="max-w-3xl mx-auto">
                                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                                        {previewContent?.content || "No content available for this document."}
                                    </pre>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-pagani-gold/5 border-t border-pagani-gold/10 text-center">
                            <p className="text-[9px] text-pagani-gold/60 uppercase tracking-widest font-bold">
                                This content is currently active in the RAG vector store for retrieval
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
