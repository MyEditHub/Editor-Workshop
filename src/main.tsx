import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import posthog from "posthog-js";
import App from "./App";

// Initialize Sentry for error tracking (only if DSN is set)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.DEV ? "development" : "production",
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1, // 10% of transactions
    beforeSend(event) {
      // Strip local file paths for privacy
      return event;
    },
  });
}

// Initialize PostHog for analytics (only if key is set and not in dev)
const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
if (posthogKey && !import.meta.env.DEV) {
  // Check user preference
  const analyticsEnabled = localStorage.getItem("analytics_enabled") !== "false";

  posthog.init(posthogKey, {
    api_host: "https://app.posthog.com",
    autocapture: false, // Manual tracking only
    capture_pageview: false, // Desktop app, not web pages
    persistence: "localStorage",
    opt_out_capturing_by_default: !analyticsEnabled,
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
