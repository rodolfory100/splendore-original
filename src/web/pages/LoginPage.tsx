import { useState } from "react";
import { authLogin } from "../lib/api";

export function LoginPage({ onLogin }: { onLogin: (t: string) => void }) {
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [show, setShow] = useState(false);

  const handleLogin = async () => {
    if (!senha) return;
    setLoading(true); setErro("");
    try {
      const res = await authLogin(senha);
      if (res.ok && res.token) { localStorage.setItem("spl_token", res.token); onLogin(res.token); }
      else setErro("Senha incorreta. Tente novamente.");
    } catch (e: any) { setErro("Erro de conexão. Tente novamente."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Left panel */}
      <div style={{ flex: 1, background: "#0F172A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 48, position: "relative", overflow: "hidden" }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,106,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,106,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 380, width: "100%", position: "relative" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#C9A86A,#A88340)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🩰</div>
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 700, color: "#F8FAFC" }}>Splendore</div>
              <div style={{ fontSize: 11, color: "#475569", letterSpacing: 1.2, textTransform: "uppercase" }}>Sistema de Gestão</div>
            </div>
          </div>

          <h1 style={{ fontSize: 32, fontWeight: 800, color: "#F8FAFC", lineHeight: 1.2, marginBottom: 12 }}>
            Bem-vinda de<br />volta! 👋
          </h1>
          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, marginBottom: 40 }}>
            Gerencie sua escola de dança com inteligência. Alunas, pagamentos e cobranças em um só lugar.
          </p>

          {/* Stats */}
          <div style={{ display: "flex", gap: 20 }}>
            {[
              { label: "Alunas", value: "143" },
              { label: "Turmas", value: "7" },
              { label: "Meses", value: "14+" },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#C9A86A" }}>{value}</div>
                <div style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ width: 440, background: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <div style={{ width: "100%", maxWidth: 360 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>Entrar no sistema</h2>
          <p style={{ fontSize: 13, color: "#64748B", marginBottom: 32 }}>Área administrativa — acesso restrito</p>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8, letterSpacing: 0.3 }}>Senha de acesso</label>
            <div style={{ position: "relative" }}>
              <input
                type={show ? "text" : "password"}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                autoFocus
                style={{ paddingRight: 44 }}
              />
              <button
                onClick={() => setShow(s => !s)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 14 }}
              >{show ? "🙈" : "👁"}</button>
            </div>
          </div>

          {erro && (
            <div style={{ padding: "10px 14px", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, fontSize: 12, color: "#DC2626", marginBottom: 16, display: "flex", gap: 8 }}>
              <span>⚠️</span>{erro}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !senha}
            className="btn btn-primary"
            style={{ width: "100%", padding: "12px", fontSize: 14, marginBottom: 24, opacity: loading || !senha ? 0.7 : 1 }}
          >
            {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Verificando...</> : "Entrar →"}
          </button>

          <div style={{ padding: "16px", background: "#fff", border: "1px solid #E8ECF2", borderRadius: 10, fontSize: 12, color: "#64748B", lineHeight: 1.7 }}>
            <strong style={{ color: "#0F172A" }}>Senha padrão:</strong> splendore2026<br/>
            Altere em Configurações após o primeiro acesso.
          </div>
        </div>
      </div>
    </div>
  );
}
