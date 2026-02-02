import { invoke } from "@tauri-apps/api/core";
import posthog from "posthog-js";

// Types for the Rust backend
interface QueuedEvent {
  event_type: string;
  payload: Record<string, unknown>;
}

// Sync pending events when online
async function syncPendingEvents() {
  try {
    const pending = await invoke<[number, QueuedEvent][]>("get_pending_telemetry");
    if (pending.length === 0) return;

    const sentIds: number[] = [];
    for (const [id, event] of pending) {
      try {
        // Only send if PostHog is initialized
        if (posthog.__loaded) {
          posthog.capture(event.event_type, event.payload);
        }
        sentIds.push(id);
      } catch {
        // Stop on first failure (likely offline)
        break;
      }
    }

    if (sentIds.length > 0) {
      await invoke("mark_telemetry_sent", { ids: sentIds });
    }
  } catch (e) {
    console.error("Failed to sync telemetry:", e);
  }
}

// Initialize sync on load and periodically
let syncInitialized = false;

function initSync() {
  if (syncInitialized) return;
  syncInitialized = true;

  // Sync on load
  syncPendingEvents();

  // Sync every minute
  setInterval(syncPendingEvents, 60000);
}

export function useAnalytics() {
  // Initialize sync when hook is first used
  initSync();

  const track = async (event: string, properties?: Record<string, unknown>) => {
    // Skip in development
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- Dev-only logging for analytics debugging
      console.log("[Analytics]", event, properties);
      return;
    }

    // Check if analytics is enabled (user preference)
    const analyticsEnabled = localStorage.getItem("analytics_enabled") !== "false";
    if (!analyticsEnabled) return;

    // Always queue to SQLite first (reliable storage)
    try {
      await invoke("queue_telemetry_event", {
        eventType: event,
        payload: properties || {},
      });
    } catch (e) {
      console.error("Failed to queue telemetry:", e);
    }

    // Try to send immediately if online
    try {
      if (posthog.__loaded) {
        posthog.capture(event, properties);
      }
    } catch {
      // Will be synced later from SQLite queue
    }
  };

  return {
    // Tool usage
    trackToolOpened: (tool: "anvil" | "smelter" | "dashboard") =>
      track("tool_opened", { tool }),

    // The Anvil events
    trackAnvilUpgrade: (
      fileCount: number,
      targetVersion: string
    ) =>
      track("anvil_upgrade", {
        file_count: fileCount,
        target_version: targetVersion,
      }),

    trackAnvilFilesAdded: (fileCount: number) =>
      track("anvil_files_added", { file_count: fileCount }),

    // The Smelter events
    trackSmelterOrganize: (
      fileCount: number,
      organizeBy: "genre" | "mood",
      operation: "copy" | "move"
    ) =>
      track("smelter_organize", {
        file_count: fileCount,
        organize_by: organizeBy,
        operation,
      }),

    trackSmelterFilesAdded: (fileCount: number, method: "browse" | "drag_drop") =>
      track("smelter_files_added", { file_count: fileCount, method }),

    // App-level events
    trackAppLaunched: () => track("app_launched"),
    trackUpdateInstalled: (version: string) =>
      track("update_installed", { version }),
    trackSettingsOpened: () => track("settings_opened"),
  };
}

// Utility to toggle analytics
export function setAnalyticsEnabled(enabled: boolean) {
  localStorage.setItem("analytics_enabled", String(enabled));
  if (!enabled) {
    posthog.opt_out_capturing();
  } else {
    posthog.opt_in_capturing();
  }
}

export function isAnalyticsEnabled(): boolean {
  return localStorage.getItem("analytics_enabled") !== "false";
}
