/**
 * Pagani Zonda R – Centralized API Client
 * Handles fetch with auth headers, 401 auto-refresh, and env config.
 */

// NOTE: For production, httpOnly cookies are more secure than localStorage.
// This implementation uses localStorage for demo simplicity.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FetchOptions extends RequestInit {
    skipAuth?: boolean;
}

/**
 * Centralized API fetch wrapper.
 * - Attaches Authorization Bearer header from stored token.
 * - On 401, attempts token refresh and retries the original request.
 * - Uses NEXT_PUBLIC_API_URL env var for base URL.
 */
export async function apiFetch<T = unknown>(
    endpoint: string,
    options: FetchOptions = {}
): Promise<T> {
    const { skipAuth = false, headers: customHeaders, ...rest } = options;

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(customHeaders as Record<string, string>),
    };

    if (!skipAuth) {
        const token = getStoredToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }
    }

    const url = `${API_BASE_URL}${endpoint}`;

    let response = await fetch(url, { headers, ...rest });

    // 401 Auto-Refresh Logic
    if (response.status === 401 && !skipAuth) {
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
            // Retry with new token
            const newToken = getStoredToken();
            if (newToken) {
                headers["Authorization"] = `Bearer ${newToken}`;
            }
            response = await fetch(url, { headers, ...rest });
        } else {
            // Refresh failed – clear tokens
            clearTokens();
            throw new AuthError("Session expired. Please log in again.");
        }
    }

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({
            detail: "Request failed",
        }));
        throw new ApiError(errorBody.detail || "Request failed", response.status);
    }

    return response.json();
}

/**
 * Streaming fetch for SSE endpoints.
 */
export async function apiFetchStream(
    endpoint: string,
    options: FetchOptions = {}
): Promise<ReadableStreamDefaultReader<Uint8Array> | null> {
    const { skipAuth = false, headers: customHeaders, ...rest } = options;

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(customHeaders as Record<string, string>),
    };

    if (!skipAuth) {
        const token = getStoredToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, { headers, ...rest });

    if (response.status === 401) {
        clearTokens();
        throw new AuthError("Session expired. Please log in again.");
    }

    if (!response.ok) {
        throw new ApiError("Streaming request failed", response.status);
    }

    return response.body?.getReader() || null;
}

// ── Token Storage ──

function getStoredToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("pagani_access_token");
}

function clearTokens(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem("pagani_access_token");
    localStorage.removeItem("pagani_refresh_token");
    localStorage.removeItem("pagani_user");
}

async function attemptTokenRefresh(): Promise<boolean> {
    const refreshToken = typeof window !== "undefined"
        ? localStorage.getItem("pagani_refresh_token")
        : null;

    if (!refreshToken) return false;

    try {
        const url = `${API_BASE_URL}/api/refresh`;
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!response.ok) return false;

        const data = await response.json();
        localStorage.setItem("pagani_access_token", data.access_token);
        localStorage.setItem("pagani_refresh_token", data.refresh_token);
        localStorage.setItem(
            "pagani_user",
            JSON.stringify({ username: data.username, role: data.role })
        );
        return true;
    } catch {
        return false;
    }
}

// ── Error Classes ──

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

export class AuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AuthError";
    }
}
