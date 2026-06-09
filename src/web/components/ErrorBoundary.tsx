import { Component, type ReactNode } from "react";

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Hathor Error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          height: "100vh", gap: 16, padding: 32, background: "var(--bg)"
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Algo deu errado</div>
          <div style={{ fontSize: 13, color: "var(--text3)", maxWidth: 400, textAlign: "center" }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
