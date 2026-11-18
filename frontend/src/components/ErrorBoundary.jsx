import React, { Component } from 'react';
import Button from './ui/Button';

export class ErrorBoundary extends Component {
  state = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="min-h-screen flex items-center justify-center bg-background text-on-surface p-4"
          role="alert"
          aria-live="assertive"
        >
          <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center border border-border-glass shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 bg-error-container/20 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-error text-3xl">error_outline</span>
            </div>

            <h2 className="text-headline-md font-display-lg text-on-surface mb-2">
              Something went wrong
            </h2>

            <p className="text-text-muted mb-6">
              We encountered an unexpected error. Our team has been notified.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details className="text-left mb-6 p-4 bg-surface-container rounded-lg border border-border-glass">
                <summary className="font-mono text-xs text-text-muted cursor-pointer">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 font-mono text-xs text-on-surface-variant overflow-auto max-h-40">
                  {this.state.error.message}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <Button
                variant="gradient"
                onClick={this.handleRetry}
                icon="refresh"
                aria-label="Retry loading the page"
              >
                Try Again
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.location.href = '/'}
                icon="home"
                aria-label="Go back to homepage"
              >
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;