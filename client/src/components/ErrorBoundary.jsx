import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-center p-8">
          <div>
            <h1 className="text-6xl font-bold text-[var(--red)] mb-4">Oops!</h1>
            <h2 className="text-2xl font-semibold mb-2">Something went wrong.</h2>
            <p className="text-[var(--text-secondary)] mb-6">The application encountered an unexpected error.</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-[var(--accent)] text-white rounded-[var(--radius)]"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
