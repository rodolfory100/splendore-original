import { useState, useRef, useEffect } from "react";
import { chatIA, toggleBolsista, fmt, mesAtual } from "../lib/api";
import type { Aluna, Pagamento, Inadimplente } from "../types";

interface Msg {
  role: "user" | "ia" | "loading";
  content: string;
  acao?: any;
}

interface Props {
  alunas: Aluna[];
  pagamentos: Pagamento[];
  inadimplentes: Inadimplente[];
  config: any;
  onRefresh: () => void;
  onToast: (msg: string, type?: "success" | "danger" | "gold") => void;
}

const SUGESTOES = [
  "Listar inadimplentes do mês",
  "Qual a receita confirmada hoje?",
  "Quantas alunas por modalidade?",
  "Resumo geral da escola",
  "Gerar cobrança para todas inadimplentes",
];

const ACOES_RAPIDAS = [
  { label: "📊 Resumo geral", cmd: "Me dê um resumo completo da escola: total de alunas, receita, inadimplentes e bolsistas." },
  { label: "💰 Inadimplentes", cmd: "Liste todas as alunas inadimplentes com nome, valor e WhatsApp." },
  { label: "📬 Texto cobrança", cmd: "Gere mensagens de cobrança personalizadas para todas as inadimplentes." },
  { label: "🎓 Bolsistas", cmd: "Liste todas as alunas bolsistas." },
  { label: "📈 Receita do mês", cmd: `Qual foi a receita do mês ${mesAtual()}?` },
];

export function IAPage({ alunas, pagamentos, inadimplentes, config, onRefresh, onToast }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "ia",
      content: `Olá! Sou o **RunClaw**, assistente inteligente da **${config?.escola || "Splendore Escola de Dança"}**.\n\nTenho acesso completo ao sistema e posso:\n- Responder perguntas sobre alunas e pagamentos\n- Gerar relatórios e cobranças\n- Converter alunas em bolsistas\n- Executar ações administrativas\n\nComo posso ajudar hoje?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [msgs]);

  const enviar = async (cmd?: string) => {
    const texto = cmd || input.trim();
    if (!texto || sending) return;
    setInput("");
    setMsgs(prev => [...prev, { role: "user", content: texto }]);
    setSending(true);

    try {
      const histMsgs = msgs
        .filter(m => m.role !== "loading")
        .slice(-8)
        .map(m => ({ role: m.role === "ia" ? "assistant" : "user", content: m.content }));

      const result = await chatIA([...histMsgs, { role: "user", content: texto }]);
      setMsgs(prev => [...prev, { role: "ia", content: result.resposta, acao: result.acao }]);

      // Processar ação automaticamente se houver
      if (result.acao) {
        await processarAcao(result.acao, result);
      }
    } catch (e: any) {
      const errMsg = e.message || "Erro de conexão";
      if (errMsg.includes("API Key") || errMsg.includes("não configurada")) {
        setMsgs(prev => [...prev, {
          role: "ia",
          content: "⚠️ **API Key do OpenRouter não configurada.**\n\nVá em **Bot Telegram** no menu e adicione sua chave OpenRouter para usar o assistente com IA.\n\nAcesse openrouter.ai → Keys → Create Key (tem plano gratuito)."
        }]);
      } else {
        setMsgs(prev => [...prev, { role: "ia", content: `Erro: ${errMsg}` }]);
      }
    } finally {
      setSending(false);
    }
  };

  const processarAcao = async (acao: any, result: any) => {
    if (acao.acao === "cobranca" && acao.alunas?.length > 0) {
      const confirmar = window.confirm(`Abrir WhatsApp para cobrar ${acao.alunas.length} aluna(s)?`);
      if (confirmar) {
        for (const a of acao.alunas.slice(0, 5)) {
          const wpp = (a.whatsapp || '').replace(/\D/g, '');
          if (!wpp) continue;
          const msg = encodeURIComponent(
            `Olá, ${a.responsavel || a.nome}! 🌸\n\nA mensalidade de *${a.nome}* do mês ${mesAtual()} ainda está em aberto.\n\n💰 Valor: *${fmt(a.valor || 0)}*\n\nApós o pagamento, envie o comprovante. 🙏\n*${config?.escola || "Splendore Escola de Dança"}* 🩰`
          );
          window.open(`https://wa.me/55${wpp}?text=${msg}`, '_blank');
          await new Promise(r => setTimeout(r, 600));
        }
        onToast(`${Math.min(acao.alunas.length, 5)} cobranças abertas no WhatsApp`, "success");
      }
    } else if (acao.acao === "converter_bolsista" && acao.alunaId) {
      const confirmar = window.confirm(`Converter "${acao.nome}" para bolsista?`);
      if (confirmar) {
        await toggleBolsista(acao.alunaId, true);
        onRefresh();
        onToast(`${acao.nome} convertida para bolsista`, "gold");
      }
    }
  };

  const renderContent = (text: string) =>
    text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:#f1ede4;padding:1px 5px;border-radius:3px;font-size:12px">$1</code>')
      .replace(/^- (.*)/gm, '• $1')
      .replace(/\n/g, '<br>');

  const nomeIniciais = (n: string) => n.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();

  return (
    <div className="animate-fade-up" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", maxWidth: 840, gap: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 14, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: "linear-gradient(135deg,#1e2d2b,#3d7a72)", width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>✦</div>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: "#1e1a16" }}>
              RunClaw
              <span style={{ fontSize: 9, background: "#1e2d2b", color: "#d4af64", padding: "2px 7px", borderRadius: 8, fontWeight: 700, letterSpacing: 1, marginLeft: 8, verticalAlign: "middle" }}>MODO ADMIN</span>
            </div>
            <div style={{ fontSize: 11, color: "#a8998a" }}>Assistente inteligente com acesso completo ao sistema</div>
          </div>
        </div>

        {/* Ações rápidas */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          {ACOES_RAPIDAS.map(a => (
            <button key={a.label} onClick={() => enviar(a.cmd)} style={{
              padding: "5px 12px", background: "#faf8f4", border: "1px solid rgba(180,155,90,0.25)",
              borderRadius: 20, fontSize: 11, color: "#6b5f4e", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f0ece2")}
              onMouseLeave={e => (e.currentTarget.style.background = "#faf8f4")}
            >{a.label}</button>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div ref={chatRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, padding: "4px 0", marginBottom: 10 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", ...(m.role === "user" ? { flexDirection: "row-reverse" } : {}) }}>
            {m.role !== "user" && (
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#1e2d2b,#3d7a72)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>✦</div>
            )}
            {m.role === "user" && (
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#b8923a,#d4af64)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {config?.nomeAdmin ? nomeIniciais(config.nomeAdmin) : "AD"}
              </div>
            )}
            <div style={{
              maxWidth: "82%",
              background: m.role === "user" ? "linear-gradient(135deg,#1e2d2b,#2d4a48)" : "#faf8f4",
              borderRadius: m.role === "user" ? "12px 0 12px 12px" : "0 12px 12px 12px",
              padding: "11px 15px", fontSize: 13, lineHeight: 1.75,
              color: m.role === "user" ? "#f0ece2" : "#4a3f35",
              border: m.role === "user" ? "none" : "1px solid rgba(180,155,90,0.2)",
              boxShadow: m.role === "ia" ? "0 1px 4px rgba(0,0,0,0.04)" : "none",
            }}>
              <div dangerouslySetInnerHTML={{ __html: renderContent(m.content) }} />
              {/* Botão de ação */}
              {m.acao?.acao === "cobranca" && m.acao.alunas?.length > 0 && (
                <button onClick={() => processarAcao(m.acao, {})} style={{
                  marginTop: 10, padding: "7px 14px", background: "#25d366",
                  border: "none", borderRadius: 7, color: "#fff", fontSize: 12,
                  fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                }}>
                  📱 Abrir WhatsApp para cobrar {m.acao.alunas.length} aluna(s)
                </button>
              )}
              {m.acao?.acao === "converter_bolsista" && (
                <button onClick={() => processarAcao(m.acao, {})} style={{
                  marginTop: 10, padding: "7px 14px", background: "#3d7a72",
                  border: "none", borderRadius: 7, color: "#fff", fontSize: 12,
                  fontWeight: 700, cursor: "pointer",
                }}>
                  🎓 Confirmar conversão para bolsista
                </button>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#1e2d2b,#3d7a72)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>✦</div>
            <div style={{ background: "#faf8f4", borderRadius: "0 12px 12px 12px", padding: "14px 18px", display: "flex", gap: 5, border: "1px solid rgba(180,155,90,0.2)" }}>
              {[0, 1, 2].map(n => (
                <div key={n} style={{ width: 7, height: 7, borderRadius: "50%", background: "#b8923a", animation: `bounce 1s infinite ${n * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sugestões */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10, flexShrink: 0 }}>
        {SUGESTOES.map(s => (
          <button key={s} onClick={() => setInput(s)} style={{
            padding: "4px 10px", background: "transparent", border: "1px solid rgba(180,155,90,0.2)",
            borderRadius: 20, fontSize: 10, color: "#a8998a", cursor: "pointer",
          }}>{s}</button>
        ))}
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, display: "flex", gap: 10, background: "#fff", border: "1.5px solid rgba(180,155,90,0.35)", borderRadius: 12, padding: "10px 14px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && enviar()}
          placeholder='Ex: "Listar inadimplentes", "Converter Ana em bolsista", "Receita do mês"...'
          style={{ flex: 1, border: "none", outline: "none", fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: "#1e1a16", background: "transparent" }}
        />
        <button onClick={() => enviar()} disabled={sending || !input.trim()} style={{
          padding: "8px 20px", background: sending || !input.trim() ? "#e8e4dc" : "linear-gradient(135deg,#1e2d2b,#3d7a72)",
          border: "none", borderRadius: 8, color: sending || !input.trim() ? "#a8998a" : "#fff",
          fontSize: 13, fontWeight: 700, cursor: sending || !input.trim() ? "default" : "pointer",
          fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
        }}>
          {sending ? "···" : "Enviar →"}
        </button>
      </div>

      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}`}</style>
    </div>
  );
}
