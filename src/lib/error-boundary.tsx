import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack: string } | null;
}

/**
 * Global React Error Boundary
 * Catches errors thrown during render and lifecycle methods.
 * Displays error details on a full-screen error page instead of crashing.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    this.setState({
      error,
      errorInfo,
    });
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorDisplay
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={() => {
            this.setState({
              hasError: false,
              error: null,
              errorInfo: null,
            });
          }}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorDisplayProps {
  error: Error | null;
  errorInfo: { componentStack: string } | null;
  onReset: () => void;
}

/**
 * Full-screen error display component
 * Shows error message and stack trace to help diagnose startup issues
 */
export function ErrorDisplay({ error, errorInfo, onReset }: ErrorDisplayProps) {
  const errorMessage = error?.message || "An unknown error occurred";
  const errorStack = error?.stack || "";
  const componentStack = errorInfo?.componentStack || "";

  return (
    <div className="min-h-screen w-full bg-red-950 text-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">⚠️ Error</h1>
          <p className="text-red-200">The app encountered a critical error and could not start.</p>
        </div>

        {/* Error Message */}
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-lg mb-2">Error Message:</h2>
          <p className="text-red-100 break-words font-mono text-sm">{errorMessage}</p>
        </div>

        {/* Error Stack */}
        {errorStack && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6 max-h-48 overflow-y-auto">
            <h2 className="font-semibold text-lg mb-2">Stack Trace:</h2>
            <pre className="text-red-100 text-xs whitespace-pre-wrap break-words font-mono">
              {errorStack}
            </pre>
          </div>
        )}

        {/* Component Stack */}
        {componentStack && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6 max-h-48 overflow-y-auto">
            <h2 className="font-semibold text-lg mb-2">Component Stack:</h2>
            <pre className="text-red-100 text-xs whitespace-pre-wrap break-words font-mono">
              {componentStack}
            </pre>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={onReset}
            className="px-6 py-2 bg-white text-red-950 font-semibold rounded-lg hover:bg-red-50 transition"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-800 text-white font-semibold rounded-lg hover:bg-red-700 transition border border-red-600"
          >
            Reload App
          </button>
        </div>

        {/* Debug Info */}
        <div className="mt-8 pt-6 border-t border-red-700">
          <p className="text-red-300 text-xs">
            📱 Timestamp: {new Date().toISOString()}
            <br />
            🔗 User Agent: {typeof navigator !== "undefined" ? navigator.userAgent : "N/A"}
          </p>
        </div>
      </div>
    </div>
  );
}
