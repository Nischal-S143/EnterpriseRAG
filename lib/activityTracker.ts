/**
 * Client-side activity tracker for the Viewer dashboard.
 * Stores real user events in localStorage and provides
 * methods to log and retrieve them from any component.
 */

import { getUserScopedKey } from "./auth";

const MAX_EVENTS = 50;

export interface ActivityEvent {
  id: string;
  type: "ai_answer" | "bookmark" | "new_doc" | "view" | "login" | "search" | "feedback";
  text: string;
  timestamp: string;
}

function getStorageKey(): string {
  return getUserScopedKey("viewer_activity_log");
}

/**
 * Log a new user activity event.
 * Called by ViewerChatPanel, DocumentPanel, BookmarksGrid, etc.
 */
export function logViewerActivity(
  type: ActivityEvent["type"],
  text: string
): void {
  if (typeof window === "undefined") return;
  try {
    const key = getStorageKey();
    const raw = localStorage.getItem(key);
    const events: ActivityEvent[] = raw ? JSON.parse(raw) : [];
    const newEvent: ActivityEvent = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      text,
      timestamp: new Date().toISOString(),
    };
    events.unshift(newEvent);
    // Keep only the latest MAX_EVENTS
    localStorage.setItem(key, JSON.stringify(events.slice(0, MAX_EVENTS)));

    // Dispatch a custom event so ActivityFeed can update in real-time
    window.dispatchEvent(new CustomEvent("viewer-activity-update"));
  } catch {
    // Silently fail — localStorage may be full or unavailable
  }
}

/**
 * Retrieve the latest N activity events.
 */
export function getViewerActivity(limit: number = 8): ActivityEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return [];
    const events: ActivityEvent[] = JSON.parse(raw);
    return Array.isArray(events) ? events.slice(0, limit) : [];
  } catch {
    return [];
  }
}

/**
 * Clear all activity events (for testing/reset).
 */
export function clearViewerActivity(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getStorageKey());
  window.dispatchEvent(new CustomEvent("viewer-activity-update"));
}
