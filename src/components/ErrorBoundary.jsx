import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          background: '#1a1a1a',
          color: '#ff4d4d',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontFamily: 'monospace'
        }}>
          <h2 style={{ margin: '0 0 10px 0' }}>Something went wrong.</h2>
          <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '20px' }}>
            The dashboard crashed. Please try reloading.
          </p>
          <div style={{ 
            background: '#000', 
            padding: '15px', 
            borderRadius: '8px', 
            textAlign: 'left', 
            maxWidth: '90%', 
            overflowX: 'auto',
            fontSize: '0.8rem',
            marginBottom: '20px'
          }}>
            <pre style={{ margin: 0, color: '#f8f8f8' }}>
              {this.state.error && this.state.error.toString()}
            </pre>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: '#ff4d4d',
              color: 'white',
              border: 'none',
              borderRadius: '24px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Reload App
          </button>

        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
