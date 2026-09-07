import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

// Catches render-time crashes anywhere below it in the tree. Without this,
// a throwing component unmounts silently and the user is left staring at a
// blank page with no indication anything went wrong (the failure mode we
// hit with the Profile page and the post-setup missing-chrome bug).
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled error in app tree:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-white">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">
            Something went wrong
          </h1>
          <p className="mt-1.5 text-sm text-gray-500 max-w-sm">
            This page ran into an unexpected error. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center gap-2 px-4 h-9 rounded-full bg-[#0085FF] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
