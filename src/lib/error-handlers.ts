import { ErrorDisplay } from "./error-boundary";
import { createRoot } from "react-dom/client";

/**
 * Global error handlers for startup issues.
 * Catches unhandled errors, rejected promises, and other runtime errors.
 */

let errorDisplayShown = false;

/**
 * Show error UI when a critical error occurs during startup
 */
function showErrorUI(error: Error) {
  if (errorDisplayShown) return;
  errorDisplayShown = true;

  try {
    // Remove any existing content from body
    const container = document.getElementById("root");
    if (container) {
      container.innerHTML = "";
      const root = createRoot(container);
      root.render(
        <ErrorDisplay
          error={error}
          errorInfo={{ componentStack: "" }}
          onReset={() => {
            errorDisplayShown = false;
            window.location.reload();
          }}
        />
      );
    } else {
      // Fallback: create error div if root doesn't exist
      const errorDiv = document.createElement("div");
      errorDiv.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;background:#7f1d1d;color:white;padding:20px;overflow:auto;font-family:monospace;z-index:9999";
      errorDiv.innerHTML = `
        <h1 style="margin:0 0 20px 0;font-size:24px;">⚠️ Startup Error</h1>
        <pre style="white-space:pre-wrap;word-wrap:break-word;margin:0 0 20px 0;background:rgba(159,18,18,0.5);padding:10px;border-radius:4px;">${escapeHtml(error.message)}\n\n${escapeHtml(error.stack || "")}</pre>
        <button onclick="location.reload()" style="padding:8px 16px;background:white;color:#7f1d1d;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Reload</button>
      `;
      document.body.appendChild(errorDiv);
    }
  } catch (e) {
    console.error("Failed to show error UI:", e);
  }
}

/**
 * Helper: Escape HTML to prevent injection
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

/**
 * Initialize global error handlers
 * Call this at app startup before rendering React
 */
export function initializeErrorHandlers() {
  // Handle uncaught synchronous errors
  window.onerror = (message, source, lineno, colno, error) => {
    const err = error instanceof Error ? error : new Error(String(message));
    console.error("[window.onerror]", {
      message,
      source,
      lineno,
      colno,
      error: err,
    });
    showErrorUI(err);
    return true; // Prevent default error handling
  };

  // Handle unhandled promise rejections
  window.onunhandledrejection = (event) => {
    const error =
      event.reason instanceof Error
        ? event.reason
        : new Error(`Unhandled Promise Rejection: ${String(event.reason)}`);
    console.error("[window.onunhandledrejection]", error);
    showErrorUI(error);
    event.preventDefault(); // Prevent default rejection handling
  };

  // Log any errors to console for debugging
  if (typeof console !== "undefined") {
    const originalError = console.error;
    console.error = function (...args) {
      originalError.apply(console, args);
      // Only show UI for actual Error objects logged to console
      if (args.length > 0 && args[0] instanceof Error && !errorDisplayShown) {
        // Don't auto-show for every console.error, but log for debugging
      }
    };
  }
}

/**
 * Reset error state (useful for testing or manual recovery)
 */
export function resetErrorState() {
  errorDisplayShown = false;
}
