import { useState, useRef, useEffect } from "react";
import { fmt, mesAtual } from "../lib/api";

interface Props {
  alunas: any[];
  pagamentos: any[];
  inadimplentes: any[];
  config: any;
  onToast: (msg: string, type?: string) => void;
}

const SUGESTOES = [
  "Quantas alunas estão devendo este mês?",
  "Qual a receita total de 2026?",
  "Liste as 5 alunas com maior risco de cancelamento",
  "Gere uma mensagem de cobrança simpática para enviar por WhatsApp",
  "Qual modalidade tem mais alunas?",
  "Resuma a situação financeira da escola",
];

export function IAPage({ alunas, pagamentos, inadimplentes, config, onToast }: Props) {
  const [msgs, setMsgs] = useState<{role:string;content:string}[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const mes = mesAtual();
  const receitaMes = pagamentos.filter(p => p.mes === mes).reduce((s, p) => s + (p.valor || 0), 0);
  const totalAlunas = alunas.filter(a => a.ativo).length;

  const contexto = {
    escola: config?.escola || "Ballet Splendore",
    mes_atual: mes,
    total_alunas_ativas: totalAlunas,
    total_inadimplentes: inadimplentes.length,
    receita_mes_atual: receitaMes,
    inadimplentes: inadimplentes.slice(0, 30).map(a => ({
      nome: a.nome,
      whatsapp: a.whatsapp,
      modalidade: a.modalidade,
      valor: a.valor,
      vencimento: a.vencimento
    })),
    modalidades: [...new Set(alunas.map(a => a.modalidade))],
    total_pagamentos_2026: pagamentos.filter(p => p.mes?.startsWith("2026")).length,
    receita_2026: pagamentos.filter(p => p.mes?.startsWith("2026")).reduce((s, p) => s + (p.valor || 0), 0),
  };

  const enviar = async (texto?: string) => {
    const pergunta = texto || input.trim();
    if (!pergunta) return;
    setInput("");
    const novasMsgs = [...msgs, { role: "user", content: pergunta }];
    setMsgs(novasMsgs);
    setLoading(true);
    try {
      const r = await fetch("/api/ia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("spl_token")}` },
        body: JSON.stringify({ messages: novasMsgs, contexto })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setMsgs([...novasMsgs, { role: "assistant", content: data.resposta }]);
    } catch(e: any) {
      onToast(e.message, "danger");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>
      <div style={{ paddingTop: 24, paddingBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: -0.5 }}>✨ IA Assistente</div>
        <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>Claude — com dados reais do Ballet Splendore</div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {[
            { label: `${totalAlunas} ativas`, color: "#4F46E5" },
            { label: `${inadimplentes.length} inadimplentes`, color: "#e53e3e" },
            { label: `${fmt(receitaMes)} este mês`, color: "#38a169" },
          ].map(b => (
            <span key={b.label} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: b.color + "18", color: b.color }}>{b.label}</span>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 16 }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🩰</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Olá! Sou a IA do Ballet Splendore</div>
            <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 24 }}>Pergunte sobre alunas, finanças, inadimplência ou peça sugestões</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 500, margin: "0 auto" }}>
              {SUGESTOES.map(s => (
                <button key={s} onClick={() => enviar(s)} style={{ padding: "10px 16px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text2)", fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--brand)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "85%", padding: "12px 16px", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: m.role === "user" ? "var(--brand)" : "var(--surface)",
              color: m.role === "user" ? "#fff" : "var(--text)",
              fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
            }}>
              {m.role === "assistant" && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand)", marginBottom: 6 }}>✨ IA Splendore</div>}
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "var(--surface)", fontSize: 14, color: "var(--text3)" }}>
              ✨ Pensando...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ paddingBottom: 24, paddingTop: 8 }}>
        <div style={{ display: "flex", gap: 10, background: "var(--surface)", borderRadius: 16, padding: "8px 8px 8px 16px", border: "1.5px solid var(--border)" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && enviar()}
            placeholder="Pergunte sobre as alunas, finanças, cobrança..."
            style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, color: "var(--text)", outline: "none", fontFamily: "inherit" }}
          />
          <button onClick={() => enviar()} disabled={loading || !input.trim()} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: loading || !input.trim() ? "var(--bg2)" : "var(--brand)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: loading || !input.trim() ? "default" : "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
            {loading ? "..." : "Enviar"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "center", marginTop: 8 }}>Claude claude-opus-4-5 · Dados em tempo real da escola</div>
      </div>
    </div>
  );
}
