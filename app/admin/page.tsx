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
    const TABS = ["Roles", "Review Queue", "Reports", "Audit Logs"];

    const [users, setUsers] = useState<UserObj[]>([]);
    const [rolesAudit, setRolesAudit] = useState<any[]>([]);

    const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editResponseText, setEditResponseText] = useState("");

    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);



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
        if (activeTab === "Review Queue" && gatePassed) {
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
        }
    }, [activeTab, gatePassed]);

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
                    </div>
                )}
            </main>
        </div>
    );
}