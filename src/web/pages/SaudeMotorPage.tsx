import { useState, useEffect } from "react";
import { fmt } from "../lib/api";

interface Props { onToast: (msg: string, type?: string) => void; }

export function SaudeMotorPage({ onToast }: Props) {
  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ultimaAtt, setUltimaAtt] = useState("");

  const carregar = async () => {
    try {
      const r = await fetch("/api/motor/saude", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("spl_token")}` }
      });
      const d = await r.json();
      setDados(d);
      setUltimaAtt(new Date().toLocaleTimeString("pt-BR"));
    } catch { onToast("Erro ao carregar saúde do motor", "danger"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 30000); // Auto-refresh 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>Carregando...</div>;
  if (!dados) return null;

  const motor = dados.motor || {};
  const statusColor = dados.status === "healthy" ? "#16a34a" : dados.status === "warning" ? "#d97706" : "#e53e3e";
  const statusLabel = dados.status === "healthy" ? "✅ Saudável" : dados.status === "warning" ? "⚠️ Atenção" : "🔴 Crítico";

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: -0.5 }}>
            🏥 Saúde do Motor de Cobrança
          </div>
          <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>
            Atualizado às {ultimaAtt} · Auto-refresh 30s
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ padding: "8px 20px", borderRadius: 20, background: statusColor + "20", border: `2px solid ${statusColor}`, fontSize: 14, fontWeight: 800, color: statusColor }}>
            {statusLabel}
          </div>
          <button onClick={carregar} style={{ padding: "8px 16px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text2)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            ↻ Atualizar
          </button>
        </div>
      </div>

      {/* KPIs principais */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Taxa de Sucesso", value: `${motor.taxa_sucesso_pct || 0}%`, color: (motor.taxa_sucesso_pct || 0) >= 95 ? "#16a34a" : (motor.taxa_sucesso_pct || 0) >= 80 ? "#d97706" : "#e53e3e", icon: "✅" },
          { label: "Processadas", value: motor.total_sucesso || 0, color: "#16a34a", icon: "✓" },
          { label: "Falhas", value: motor.total_falhou || 0, color: (motor.total_falhou || 0) > 0 ? "#e53e3e" : "#16a34a", icon: "✗" },
          { label: "Na Fila", value: motor.fila_pendente || 0, color: "#4F46E5", icon: "⏳" },
          { label: "Valor Processado", value: fmt(motor.valor_processado || 0), color: "#16a34a", icon: "💰" },
        ].map(k => (
          <div key={k.label} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{k.icon} {k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Alertas ativos */}
      {dados.alertas_ativos?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#e53e3e", marginBottom: 10 }}>🚨 Alertas Ativos</div>
          {dados.alertas_ativos.map((a: any) => (
            <div key={a.id} style={{ background: "var(--surface)", border: "1.5px solid #fca5a5", borderRadius: 12, padding: 14, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 13 }}>{a.tipo}</div>
                <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 2 }}>{a.mensagem}</div>
              </div>
              <button onClick={async () => {
                await fetch(`/api/motor/alertas/${a.id}/resolver`, { method: "PUT", headers: { "Authorization": `Bearer ${localStorage.getItem("spl_token")}` } });
                carregar();
              }} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                ✓ Resolver
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Problemas detectados */}
      {dados.problemas_detectados?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#d97706", marginBottom: 10 }}>⚠️ Problemas Detectados</div>
          {dados.problemas_detectados.map((p: any, i: number) => (
            <div key={i} style={{ background: "var(--surface)", border: "1.5px solid #fde68a", borderRadius: 10, padding: 12, marginBottom: 6, fontSize: 13 }}>
              <strong>{p.tipo}</strong> — Valor: {p.valor} · Severidade: <span style={{ color: p.severidade === "critical" ? "#e53e3e" : "#d97706", fontWeight: 700 }}>{p.severidade}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Métricas detalhadas */}
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 16 }}>📊 Métricas do Motor</div>
          {[
            { label: "Processando agora", value: motor.fila_processando || 0 },
            { label: "Falhas definitivas (3x)", value: motor.falhas_definitivas || 0 },
            { label: "Falhas última hora", value: motor.falhas_ultima_hora || 0 },
            { label: "Média tentativas (sucesso)", value: (motor.media_tentativas_sucesso || 0).toFixed(1) },
          ].map(m => (
            <div key={m.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span style={{ color: "var(--text3)" }}>{m.label}</span>
              <span style={{ fontWeight: 700, color: "var(--text)" }}>{m.value}</span>
            </div>
          ))}
        </div>

        {/* Cache status */}
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 16 }}>⚡ Cache de Perfil de Risco</div>
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: "#4F46E5" }}>{dados.cache?.perfis_ativos || 0}</div>
            <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>perfis em cache (válidos 24h)</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 8 }}>
              Total registros: {dados.cache?.total_registros || 0}
            </div>
            <button onClick={async () => {
              await fetch("/api/motor/cache/limpar", { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("spl_token")}` } });
              onToast("Cache limpo!", "success");
              carregar();
            }} style={{ marginTop: 16, padding: "8px 20px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text2)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              🗑️ Limpar cache expirado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
