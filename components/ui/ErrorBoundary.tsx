'use client';

import React, { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional label for logging which section crashed */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * FIXED: ARCH-3 — Error Boundary wrapping tab content components to prevent
 * a crash in one tab from unmounting the entire app (white screen).
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center h-full px-6 py-20 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
            style={{ background: 'var(--color-surface-2)' }}
          >
            <span className="text-3xl">⚠️</span>
          </div>
          <p
            className="font-semibold text-base mb-1"
            style={{ color: 'var(--color-text)' }}
          >
            Something went wrong
          </p>
          <p
            className="text-sm mb-4 max-w-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="glass-btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{ color: 'var(--color-on-accent)' }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
