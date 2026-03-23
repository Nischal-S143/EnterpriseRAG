"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { login } from "@/lib/auth";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isCapsLockOn, setIsCapsLockOn] = useState(false);

    const handleCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
        setIsCapsLockOn(e.getModifierState("CapsLock"));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading || isSuccess) return;
        setError("");
        setIsLoading(true);

        try {
            const data = await login(username, password);
            setIsSuccess(true);
            setIsLoading(false);
            
            setTimeout(() => {
                if (data.role === "admin") {
                    router.push("/dashboard/admin");
                } else if (data.role === "engineer") {
                    router.push("/dashboard/engineer");
                } else {
                    router.push("/");
                }
            }, 500);
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Login failed. Please try again."
            );
            setIsLoading(false);
        }
    };

    return (
        <main className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
            
            {/* Background Image */}
            <div
                className="fixed inset-0 bg-cover bg-center -z-10"
                style={{
                    backgroundImage: "url('/images/pagani-bg.png')",
                }}
            />

            {/* Dark Overlay */}
            <div className="fixed inset-0 bg-black/75 backdrop-blur-[2px] -z-10" />

            {/* Gold Accent Glow */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(212,175,55,0.08)_0%,_transparent_60%)] -z-10" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="relative z-10 w-full max-w-md"
            >
                <div className="text-center mb-10">
                    <h1
                        className="text-3xl font-bold tracking-tighter uppercase text-white"
                        style={{ fontFamily: "var(--font-orbitron)" }}
                    >
                        Pagani <span className="text-pagani-gold">Intelligence</span>
                    </h1>
                    <p className="text-xs text-gray-400 tracking-[0.3em] uppercase mt-2">
                        Enterprise Access Portal
                    </p>
                </div>

                <div
                    className="p-8 rounded-2xl backdrop-blur-xl"
                    style={{
                        background:
                            "linear-gradient(145deg, rgba(20,20,20,0.75) 0%, rgba(10,10,10,0.85) 100%)",
                        border: "1px solid rgba(212,175,55,0.25)",
                        boxShadow: "0 0 50px rgba(0,0,0,0.7)",
                    }}
                >
                    <h2
                        className="text-lg font-bold text-white tracking-[0.1em] uppercase mb-6"
                        style={{ fontFamily: "var(--font-orbitron)" }}
                    >
                        Sign In
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
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-pagani-gold/40 transition-colors placeholder-gray-600"
                                placeholder="Enter your username"
                            />
                        </div>

                        <div className="relative">
                            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                                Password
                            </label>

                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyUp={handleCapsLock}
                                onBlur={() => setIsCapsLockOn(false)}
                                required
                                minLength={6}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-12 text-white text-sm outline-none focus:border-pagani-gold/40 transition-colors placeholder-gray-600"
                                placeholder="Enter your password"
                            />

                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className={`absolute right-3 top-[38px] transition-all duration-300 ${
                                    showPassword
                                        ? "text-pagani-gold drop-shadow-[0_0_8px_rgba(212,175,55,0.8)]"
                                        : "text-gray-400 hover:text-pagani-gold"
                                }`}
                            >
                                👁
                            </button>

                            {isCapsLockOn && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-2 text-xs text-yellow-500 tracking-wide"
                                >
                                    ⚠ Caps Lock is ON
                                </motion.div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || isSuccess}
                            className="w-full py-3 bg-pagani-gold/20 border border-pagani-gold/40 text-pagani-gold text-sm font-bold tracking-[0.15em] uppercase rounded-lg hover:bg-pagani-gold hover:text-black transition-all disabled:opacity-50"
                        >
                            {isLoading ? "Authenticating..." : isSuccess ? "Success! Redirecting..." : "Sign In"}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-gray-400 text-sm">
                            No account?{" "}
                            <a
                                href="/register"
                                className="text-pagani-gold hover:text-bright-gold transition-colors"
                            >
                                Register
                            </a>
                        </p>
                    </div>
                </div>

                <p className="text-center text-gray-500 text-[10px] mt-8 tracking-wider uppercase">
                    © {new Date().getFullYear()} Pagani Automobili. Enterprise System.
                </p>
            </motion.div>
        </main>
    );
}