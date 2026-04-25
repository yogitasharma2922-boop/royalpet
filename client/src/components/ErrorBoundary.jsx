import React, { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    console.error("UI crashed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 520, background: "#fff", border: "1px solid #e0dbd4", borderRadius: 12, padding: 24 }}>
            <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ marginBottom: 16, color: "#4a5a6a" }}>The interface hit an unexpected error. Refresh the page to continue.</p>
            {this.state.error && (
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#900", marginBottom: 12 }}>{String(this.state.error)}</pre>
            )}
            <button
              onClick={() => { try { localStorage.removeItem("rpc_db"); } catch {} window.location.reload(); }}
              style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e0dbd4", background: "#0d1f2d", color: "#fff", cursor: "pointer", fontSize: 12 }}
            >
              Reset Local Data & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
