"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { register } from "@/lib/auth";

const ROLES = [
    { value: "viewer", label: "Viewer", desc: "Basic access to public specifications" },
    { value: "engineer", label: "Engineer", desc: "Technical data including aerodynamics & suspension" },
    { value: "admin", label: "Admin", desc: "Full access including financial & production data" },
];

export default function RegisterPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("viewer");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isCapsLockOn, setIsCapsLockOn] = useState(false);

    const handleCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
        setIsCapsLockOn(e.getModifierState("CapsLock"));
    };

    const getPasswordFeedback = (pwd: string) => {
        const feedback = [];
        if (pwd.length < 8) feedback.push("At least 8 characters");
        if (!/[A-Z]/.test(pwd)) feedback.push("One uppercase letter");
        if (!/[a-z]/.test(pwd)) feedback.push("One lowercase letter");
        if (!/[0-9]/.test(pwd)) feedback.push("One number");
        if (!/[^A-Za-z0-9]/.test(pwd)) feedback.push("One special character");
        return feedback;
    };

    const calculateStrength = (pwd: string) => {
        let score = 0;
        if (pwd.length >= 8) score++;
        if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[^A-Za-z0-9]/.test(pwd)) score++;
        return score;
    };

    const strength = calculateStrength(password);
    const feedback = getPasswordFeedback(password);

    const strengthLabel = ["Weak", "Fair", "Good", "Strong"];
    const strengthColors = [
        "bg-red-500",
        "bg-yellow-500",
        "bg-blue-500",
        "bg-green-500",
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading || isSuccess) return; // Prevent double-submit
        setError("");
        setIsLoading(true);

        try {
            await register(username, password, role);
            setIsSuccess(true);
            setIsLoading(false);
            
            // Delay navigation so React flushes the success state to the DOM
            // This prevents the UI from getting "stuck" on "Creating Account..."
            setTimeout(() => {
                router.push("/login");
            }, 1000);
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Registration failed. Please try again."
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

            {/* Gold Glow Accent */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(212,175,55,0.08)_0%,_transparent_60%)] -z-10" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="relative z-10 w-full max-w-md"
            >
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold tracking-tighter uppercase text-white" style={{ fontFamily: "var(--font-orbitron)" }}>
                        Pagani <span className="text-pagani-gold">Intelligence</span>
                    </h1>
                    <p className="text-xs text-gray-400 tracking-[0.3em] uppercase mt-2">
                        Enterprise Registration
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
                    <h2 className="text-lg font-bold text-white tracking-[0.1em] uppercase mb-6" style={{ fontFamily: "var(--font-orbitron)" }}>
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
                                maxLength={128}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-12 text-white text-sm outline-none focus:border-pagani-gold/40 transition-colors placeholder-gray-600"
                                placeholder="Minimum 8 characters recommended"
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

                            {password && (
                                <div className="mt-3">
                                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(strength / 4) * 100}%` }}
                                            transition={{ duration: 0.3 }}
                                            className={`h-full ${
                                                strengthColors[strength - 1] || "bg-red-500"
                                            }`}
                                        />
                                    </div>

                                    <p className="text-xs mt-2 text-gray-400">
                                        Strength:{" "}
                                        <span
                                            className={`font-semibold ${
                                                strength === 4
                                                    ? "text-green-400"
                                                    : strength === 3
                                                    ? "text-blue-400"
                                                    : strength === 2
                                                    ? "text-yellow-400"
                                                    : "text-red-400"
                                            }`}
                                        >
                                            {strengthLabel[strength - 1] || "Weak"}
                                        </span>
                                    </p>

                                    {feedback.length > 0 && (
                                        <ul className="mt-2 text-xs text-gray-400 space-y-1">
                                            {feedback.map((item, index) => (
                                                <li key={index}>• {item}</li>
                                            ))}
                                        </ul>
                                    )}

                                    {strength === 4 && (
                                        <p className="mt-2 text-xs text-green-400 font-semibold">
                                            ✓ Strong password
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-3">
                                Access Level
                            </label>
                            <div className="space-y-2">
                                {ROLES.map((r) => (
                                    <label
                                        key={r.value}
                                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                                            role === r.value
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
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                            role === r.value
                                                ? "border-pagani-gold"
                                                : "border-gray-600"
                                        }`}>
                                            {role === r.value && (
                                                <div className="w-2 h-2 rounded-full bg-pagani-gold" />
                                            )}
                                        </div>
                                        <div>
                                            <span className={`text-sm font-bold ${
                                                role === r.value
                                                    ? "text-pagani-gold"
                                                    : "text-gray-300"
                                            }`}>
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
                            disabled={isLoading || isSuccess}
                            className="w-full py-3 bg-pagani-gold/20 border border-pagani-gold/40 text-pagani-gold text-sm font-bold tracking-[0.15em] uppercase rounded-lg hover:bg-pagani-gold hover:text-black transition-all disabled:opacity-50"
                        >
                            {isLoading ? "Creating Account..." : isSuccess ? "Success! Redirecting..." : "Register"}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-gray-400 text-sm">
                            Already have an account?{" "}
                            <a href="/login" className="text-pagani-gold hover:text-bright-gold transition-colors">
                                Sign In
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