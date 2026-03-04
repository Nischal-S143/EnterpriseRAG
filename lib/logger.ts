/**
 * Pagani Zonda R – Frontend Debug Logger
 * Optional structured console logging for frontend events.
 * Enable via NEXT_PUBLIC_DEBUG_LOG=true in .env.local
 */

const IS_DEBUG = process.env.NEXT_PUBLIC_DEBUG_LOG === "true";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    event: string;
    data?: Record<string, unknown>;
}

function formatEntry(entry: LogEntry): string {
    const prefix = `[Pagani ${entry.level.toUpperCase()}]`;
    const time = entry.timestamp;
    const data = entry.data ? ` | ${JSON.stringify(entry.data)}` : "";
    return `${prefix} ${time} | ${entry.event}${data}`;
}

function log(level: LogLevel, event: string, data?: Record<string, unknown>) {
    if (!IS_DEBUG) return;

    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        data,
    };

    const formatted = formatEntry(entry);

    switch (level) {
        case "error":
            console.error(formatted);
            break;
        case "warn":
            console.warn(formatted);
            break;
        case "debug":
            console.debug(formatted);
            break;
        default:
            console.log(formatted);
    }
}

// ── Exported Event Loggers ──

export function logLogin(username: string, success: boolean) {
    log(success ? "info" : "warn", "login_attempt", { username, success });
}

export function logRouteChange(from: string, to: string) {
    log("info", "route_change", { from, to });
}

export function logChatRequest(question: string) {
    log("info", "chat_request", { question: question.slice(0, 80) });
}

export function logChatResponse(status: "success" | "error", latencyMs?: number) {
    log("info", "chat_response", { status, latencyMs });
}

export function logError(event: string, error: unknown) {
    log("error", event, {
        message: error instanceof Error ? error.message : String(error),
    });
}

export default {
    logLogin,
    logRouteChange,
    logChatRequest,
    logChatResponse,
    logError,
};
