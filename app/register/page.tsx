"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { register } from "@/lib/auth";

const ROLES = [
    {
        value: "viewer",
        label: "Viewer",
        desc: "Basic access to public specifications",
    },
    {
        value: "engineer",
        label: "Engineer",
        desc: "Technical data including aerodynamics & suspension",
    },
    {
        value: "admin",
        label: "Admin",
        desc: "Full access including financial & production data",
    },
];

export default function RegisterPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("viewer");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            await register(username, password, role);
            router.push("/login");
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Registration failed. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-pagani-black flex items-center justify-center px-4">
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(212,175,55,0.05)_0%,_transparent_60%)]" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="relative z-10 w-full max-w-md"
            >
                {/* Logo */}
                <div className="text-center mb-10">
                    <h1
                        className="text-3xl font-bold tracking-tighter uppercase text-white"
                        style={{ fontFamily: "var(--font-orbitron)" }}
                    >
                        Pagani <span className="text-pagani-gold">Intelligence</span>
                    </h1>
                    <p className="text-xs text-gray-500 tracking-[0.3em] uppercase mt-2">
                        Enterprise Registration
                    </p>
                </div>

                {/* Form Card */}
                <div
                    className="p-8 rounded-2xl"
                    style={{
                        background:
                            "linear-gradient(145deg, rgba(42,42,42,0.6) 0%, rgba(26,26,26,0.9) 100%)",
                        border: "1px solid rgba(212,175,55,0.15)",
                        boxShadow: "0 0 40px rgba(0,0,0,0.4)",
                    }}
                >
                    <h2
                        className="text-lg font-bold text-white tracking-[0.1em] uppercase mb-6"
                        style={{ fontFamily: "var(--font-orbitron)" }}
                    >
                        Create Account
                    </h2>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                        >
                            {error}
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                minLength={3}
                                maxLength={50}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-pagani-gold/40 transition-colors placeholder-gray-600"
                                placeholder="Choose a username"
                                style={{ fontFamily: "var(--font-rajdhani)" }}
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                maxLength={128}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-pagani-gold/40 transition-colors placeholder-gray-600"
                                placeholder="Minimum 6 characters"
                                style={{ fontFamily: "var(--font-rajdhani)" }}
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-3">
                                Access Level
                            </label>
                            <div className="space-y-2">
                                {ROLES.map((r) => (
                                    <label
                                        key={r.value}
                                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${role === r.value
                                                ? "border-pagani-gold/40 bg-pagani-gold/5"
                                                : "border-white/5 bg-white/[0.02] hover:border-white/10"
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="role"
                                            value={r.value}
                                            checked={role === r.value}
                                            onChange={(e) => setRole(e.target.value)}
                                            className="sr-only"
                                        />
                                        <div
                                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${role === r.value
                                                    ? "border-pagani-gold"
                                                    : "border-gray-600"
                                                }`}
                                        >
                                            {role === r.value && (
                                                <div className="w-2 h-2 rounded-full bg-pagani-gold" />
                                            )}
                                        </div>
                                        <div>
                                            <span
                                                className={`text-sm font-bold ${role === r.value
                                                        ? "text-pagani-gold"
                                                        : "text-gray-300"
                                                    }`}
                                            >
                                                {r.label}
                                            </span>
                                            <p className="text-[11px] text-gray-500">{r.desc}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 bg-pagani-gold/15 border border-pagani-gold/40 text-pagani-gold text-sm font-bold tracking-[0.15em] uppercase rounded-lg hover:bg-pagani-gold hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ fontFamily: "var(--font-orbitron)" }}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg
                                        className="animate-spin h-4 w-4"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                        />
                                    </svg>
                                    Creating Account...
                                </span>
                            ) : (
                                "Register"
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-gray-500 text-sm">
                            Already have an account?{" "}
                            <a
                                href="/login"
                                className="text-pagani-gold hover:text-bright-gold transition-colors"
                            >
                                Sign In
                            </a>
                        </p>
                    </div>
                </div>

                <p className="text-center text-gray-700 text-[10px] mt-8 tracking-wider uppercase">
                    © {new Date().getFullYear()} Pagani Automobili. Enterprise System.
                </p>
            </motion.div>
        </main>
    );
}
