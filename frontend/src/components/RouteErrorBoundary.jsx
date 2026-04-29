import React from 'react';

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Route error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            This page encountered an error
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            The rest of the application is still working.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre style={{
              textAlign: 'left',
              background: 'var(--bg-tertiary, #f5f5f5)',
              padding: '1rem',
              borderRadius: '8px',
              overflow: 'auto',
              maxWidth: '600px',
              margin: '1rem auto',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}>
              {this.state.error.message}
            </pre>
          )}
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.5rem 1.5rem',
                background: 'linear-gradient(to right, var(--accent-cyan), var(--accent-purple))',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
              }}
            >
              Try Again
            </button>
            <a
              href="/"
              style={{
                padding: '0.5rem 1.5rem',
                background: 'var(--bg-tertiary, #e5e7eb)',
                color: 'var(--text-secondary, #374151)',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Go Home
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default RouteErrorBoundary;
