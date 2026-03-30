"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          className="glass-panel flex flex-col items-center justify-center gap-3 p-8"
          style={{ color: "var(--text-muted)" }}
        >
          <p className="text-sm">Something went wrong</p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="rounded-lg px-4 py-2 text-xs transition-colors"
            style={{
              background: "var(--accent-dim)",
              color: "var(--accent)",
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
