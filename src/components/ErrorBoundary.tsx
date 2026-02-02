import * as Sentry from "@sentry/react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return (
        <div className="error-screen">
          <div className="error-content">
            <h2>Something went wrong</h2>
            <p className="error-message">{errorMessage}</p>
            <p className="error-hint">
              This error has been automatically reported. You can try again or restart the app.
            </p>
            <div className="error-actions">
              <button onClick={resetError} className="error-button primary">
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="error-button secondary"
              >
                Restart app
              </button>
            </div>
          </div>
        </div>
      );
      }}
      onError={(error, componentStack) => {
        console.error("ErrorBoundary caught an error:", error, componentStack);
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
