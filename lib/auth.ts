/**
 * Pagani Zonda R – Authentication Utilities
 * Login, register, logout, and user state management.
 */

import { apiFetch, AuthError } from "./api";

// ── Types ──

export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    role: string;
    username: string;
}

export interface UserInfo {
    username: string;
    role: string;
    created_at: string;
}

// ── Auth Functions ──

export async function login(
    username: string,
    password: string
): Promise<TokenResponse> {
    const data = await apiFetch<TokenResponse>("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
        skipAuth: true,
    });

    // Store tokens
    localStorage.setItem("pagani_access_token", data.access_token);
    localStorage.setItem("pagani_refresh_token", data.refresh_token);
    localStorage.setItem(
        "pagani_user",
        JSON.stringify({ username: data.username, role: data.role })
    );

    return data;
}

export async function register(
    username: string,
    password: string,
    role: string = "viewer"
): Promise<{ message: string; username: string; role: string }> {
    return apiFetch("/api/register", {
        method: "POST",
        body: JSON.stringify({ username, password, role }),
        skipAuth: true,
    });
}

export function logout(): void {
    localStorage.removeItem("pagani_access_token");
    localStorage.removeItem("pagani_refresh_token");
    localStorage.removeItem("pagani_user");
}

export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("pagani_access_token");
}

export function isAuthenticated(): boolean {
    return !!getToken();
}

export function getStoredUser(): { username: string; role: string } | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("pagani_user");
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export async function getUser(): Promise<UserInfo> {
    return apiFetch<UserInfo>("/api/me");
}

export { AuthError };
