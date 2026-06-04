import { useState } from "react";

interface Props {
  onRefresh: () => void;
  onToast: (msg: string, type?: "success" | "danger" | "gold") => void;
  onNavigate: (page: string) => void;
}

type Status = "idle" | "loading" | "done" | "error";

export function ImportacaoPage({ onRefresh, onToast, onNavigate }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<{ msg: string; type: "ok" | "err" | "info" }[]>([]);
  const [resultado, setResultado] = useState<any>(null);

  const addLog = (msg: string, type: "ok" | "err" | "info" = "info") =>
    setLog(prev => [...prev, { msg, type }]);

  const importar = async () => {
    setStatus("loading");
    setLog([]);

    try {
      // 1. Buscar JSON do próprio site (mesmo origin = sem bloqueio CORS)
      addLog("📂 Carregando arquivo de dados...", "info");
      const res = await fetch("/dados_importacao.json");
      if (!res.ok) throw new Error("Arquivo não encontrado. Certifique que o site foi publicado.");
      const dados = await res.json();

      addLog(`✓ Dados carregados: ${dados.fonte || "DataFitness + Apuração CSV"}`, "ok");
      addLog(`📊 ${dados.alunas?.length || 0} alunas · ${dados.pagamentos?.length || 0} pagamentos · ${dados.turmas?.length || 0} turmas`, "info");
      addLog("⏳ Enviando para o banco de dados...", "info");

      // 2. Enviar via /api/importar (mesmo origin, sem bloqueio)
      const r = await fetch("/api/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });

      if (!r.ok) {
        const err = await r.text();
        throw new Error(`Erro na importação: ${err}`);
      }

      const result = await r.json();
      addLog(`✅ Alunas importadas: ${result.importados || dados.alunas?.length}`, "ok");

      // 3. Importar pagamentos separado (podem ser muitos)
      addLog("💰 Importando pagamentos...", "info");
      let pagOk = 0, pagDup = 0, pagErr = 0;

      // Enviar em lotes de 50 para não travar
      const pags = dados.pagamentos || [];
      for (let i = 0; i < pags.length; i += 50) {
        const lote = pags.slice(i, i + 50);
        for (const p of lote) {
          try {
            const rp = await fetch("/api/pagamentos", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(p),
            });
            if (rp.ok) pagOk++;
            else if (rp.status === 409) pagDup++;
            else pagErr++;
          } catch {
            pagErr++;
          }
        }
        addLog(`  ${Math.min(i + 50, pags.length)}/${pags.length} pagamentos...`, "info");
      }

      addLog(`✅ Pagamentos: ${pagOk} novos · ${pagDup} duplicatas · ${pagErr} erros`, pagErr > 10 ? "err" : "ok");
      addLog("🎉 Importação concluída!", "ok");

      setResultado(dados);
      setStatus("done");
      onRefresh();

    } catch (e: any) {
      addLog(`❌ ${e.message}`, "err");
      setStatus("error");
    }
  };

  const logColors = { ok: "#16A34A", err: "#DC2626", info: "#64748B" };
  const logIcons  = { ok: "✓", err: "✕", info: "›" };

  return (
    <div className="animate-fade-up" style={{ maxWidth: 680 }}>
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">Importar Dados</div>
          <div className="section-sub">Carrega alunas, pagamentos e turmas do DataFitness para este sistema</div>
        </div>
      </div>

      {/* Resumo do que será importado */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 24, marginBottom: 20, boxShadow: "var(--shadow-sm)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📦</span> O que será importado
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            { icon: "🩰", label: "Alunas ativas", value: "143" },
            { icon: "📁", label: "Arquivo morto", value: "9" },
            { icon: "💰", label: "Pagamentos", value: "495" },
            { icon: "🎭", label: "Turmas", value: "7" },
            { icon: "📱", label: "Com WhatsApp", value: "143/143" },
            { icon: "🔑", label: "CPF (portal)", value: "142/143" },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{ background: "var(--bg)", borderRadius: "var(--r-md)", padding: "12px 14px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{value}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--gold-bg)", borderRadius: "var(--r-sm)", border: "1px solid rgba(201,168,106,0.3)", fontSize: 12, color: "#92610A", lineHeight: 1.6 }}>
          <strong>Fontes cruzadas:</strong> DataFitness (Database.mdb) + Apuração de pagamentos (CSV) — 
          níveis de turma extraídos automaticamente dos históricos de boletos.
        </div>
      </div>

      {/* Botão ou Status */}
      {status === "idle" && (
        <button
          onClick={importar}
          className="btn btn-primary"
          style={{ width: "100%", padding: 16, fontSize: 15, fontWeight: 700 }}
        >
          ✦ Importar Todos os Dados Agora
        </button>
      )}

      {/* Log */}
      {(status === "loading" || status === "done" || status === "error") && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20, boxShadow: "var(--shadow-sm)" }}>
          {status === "loading" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div className="spinner" />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Importando dados...</span>
            </div>
          )}

          <div style={{ fontFamily: "monospace", fontSize: 12, background: "var(--bg)", borderRadius: "var(--r-sm)", padding: 14, maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {log.map((l, i) => (
              <div key={i} style={{ color: logColors[l.type], display: "flex", gap: 8 }}>
                <span style={{ fontWeight: 700, flexShrink: 0 }}>{logIcons[l.type]}</span>
                <span>{l.msg}</span>
              </div>
            ))}
          </div>

          {/* Sucesso */}
          {status === "done" && resultado && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--green-bg)", borderRadius: "var(--r-md)", border: "1px solid #86EFAC", marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>🎉</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--green)" }}>Importação concluída!</div>
                  <div style={{ fontSize: 12, color: "#166534" }}>Todos os dados da Splendore estão no sistema.</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onNavigate("dashboard")}>
                  Ver Dashboard →
                </button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => onNavigate("alunos")}>
                  Ver Alunas
                </button>
              </div>
            </div>
          )}

          {/* Erro */}
          {status === "error" && (
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => { setStatus("idle"); setLog([]); }}>
                Tentar novamente
              </button>
            </div>
          )}
        </div>
      )}

      {/* Aviso */}
      <div style={{ marginTop: 16, padding: "14px 16px", background: "var(--blue-bg)", borderRadius: "var(--r-md)", border: "1px solid #93C5FD", fontSize: 12, color: "#1E40AF", lineHeight: 1.7 }}>
        <strong>ℹ️ Importante:</strong> Esta importação é segura — dados existentes não serão substituídos.
        Após importar, registre os pagamentos em dinheiro clicando em <strong>💰 Pagar</strong> na tela de Alunas.
      </div>
    </div>
  );
}
