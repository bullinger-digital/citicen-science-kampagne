import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    // Check if the error is thrown
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div>
          <h2>Es ist ein Fehler aufgetreten</h2>
          <button
            className=" bg-emerald-400 p-2"
            onClick={() => this.setState({ hasError: false })}
          >
            Erneut versuchen
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
