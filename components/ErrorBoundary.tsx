import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public handleReset = () => {
      this.setState({ hasError: false, error: null });
      window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-gray-50 p-10 text-center animate-fade-in">
          <div className="text-6xl mb-6">😵</div>
          <h2 className="text-2xl font-black text-brand-dark mb-2">System Glitch</h2>
          <p className="text-brand-muted mb-8 max-w-md">
            Something went wrong in this module. The data is safe, but the interface crashed.
          </p>
          <div className="bg-red-50 text-red-500 p-4 rounded-xl text-xs font-mono mb-8 max-w-lg overflow-auto border border-red-100">
              {this.state.error?.message}
          </div>
          <button 
            onClick={this.handleReset}
            className="bg-brand-dark text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg hover:scale-105"
          >
            Reboot System
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
