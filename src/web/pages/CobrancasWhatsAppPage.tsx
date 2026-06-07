import { useState, useMemo } from "react";
import { fmt, mesAtual } from "../lib/api";

interface Props {
  alunas: any[];
  pagamentos: any[];
  inadimplentes: any[];
  config: any;
  onToast: (msg: string, type?: string) => void;
}

const MESES_NOME = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function calcularRiscoChurn(aluna: any, pagamentos: any[]): {
  score: number; nivel: "alto" | "medio" | "baixo"; motivos: string[]
} {
  const pags = pagamentos.filter(p => p.aluna_id === aluna.id);
  const motivos: string[] = [];
  let score = 0;

  // Meses sem pagar consecutivos
  const hoje = new Date();
  let mesesSemPagar = 0;
  for (let i = 0; i < 3; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if (!pags.find(p => p.mes === mes && p.data)) mesesSemPagar++;
  }
  if (mesesSemPagar >= 3) { score += 40; motivos.push("3+ meses sem pagar"); }
  else if (mesesSemPagar >= 2) { score += 25; motivos.push("2 meses sem pagar"); }
  else if (mesesSemPagar >= 1) { score += 10; motivos.push("1 mês sem pagar"); }

  // Total de meses pagos vs esperado
  const mesesEsperados = Math.min(6, 
    Math.floor((hoje.getTime() - new Date(aluna.data_cadastro || "2026-01-01").getTime()) / (30*24*3600*1000))
  );
  const pagosPct = mesesEsperados > 0 ? pags.filter(p => p.data).length / mesesEsperados : 1;
  if (pagosPct < 0.5) { score += 20; motivos.push("Taxa de pagamento < 50%"); }
  else if (pagosPct < 0.75) { score += 10; motivos.push("Taxa de pagamento < 75%"); }

  // Valor baixo pode indicar bolsista em risco
  if (aluna.bolsista) { score += 5; motivos.push("Bolsista"); }

  // Suspenso
  if (aluna.suspenso) { score += 30; motivos.push("Conta suspensa"); }

  const nivel = score >= 40 ? "alto" : score >= 20 ? "medio" : "baixo";
  return { score: Math.min(100, score), nivel, motivos };
}

function gerarMsgCobranca(aluna: any, mes: string, valor: number, config: any): string {
  const mesNum = parseInt(mes.split("-")[1]) - 1;
  const nomeAluna = aluna.nome.split(" ")[0];
  const nomeMes = MESES_NOME[mesNum];
  const pix = config?.pixTelefone || "65984743940";
  const escola = config?.escola || "Ballet Splendore";
  
  return `Olá! Tudo bem? 🩰

Passando para informar que a mensalidade de *${nomeAluna}* referente a *${nomeMes}* no valor de *${fmt(valor)}* está em aberto.

Pagamento via PIX:
📱 Telefone: *${pix}*

Após o pagamento, envie o comprovante por aqui. Qualquer dúvida, estamos à disposição! 💜

_${escola}_`;
}

export function CobrancasWhatsAppPage({ alunas, pagamentos, inadimplentes, config, onToast }: Props) {
  const [aba, setAba] = useState<"cobranca"|"churn">("cobranca");
  const [busca, setBusca] = useState("");
  const [msgCustom, setMsgCustom] = useState<{[id:string]: string}>({});
  const [enviados, setEnviados] = useState<Set<string>>(new Set());

  const mes = mesAtual();

  // Análise de churn para todas as alunas ativas
  const analiseChurn = useMemo(() => {
    return alunas
      .filter(a => a.ativo && !a.bolsista)
      .map(a => ({
        ...a,
        churn: calcularRiscoChurn(a, pagamentos)
      }))
      .filter(a => a.churn.score > 0)
      .sort((a, b) => b.churn.score - a.churn.score);
  }, [alunas, pagamentos]);

  const altoRisco = analiseChurn.filter(a => a.churn.nivel === "alto");
  const medioRisco = analiseChurn.filter(a => a.churn.nivel === "medio");

  const inadFiltradas = inadimplentes.filter(a =>
    !busca || a.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const enviarWhatsApp = (aluna: any) => {
    const msg = msgCustom[aluna.id] || gerarMsgCobranca(aluna, mes, aluna.valor || 160, config);
    const tel = (aluna.whatsapp || "").replace(/\D/g, "");
    if (!tel) { onToast("WhatsApp não cadastrado", "danger"); return; }
    const url = `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    setEnviados(prev => new Set([...prev, aluna.id]));
    onToast(`WhatsApp aberto para ${aluna.nome.split(" ")[0]}`, "success");
  };

  const enviarTodos = () => {
    inadFiltradas.slice(0, 10).forEach((a, i) => {
      setTimeout(() => enviarWhatsApp(a), i * 1500);
    });
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: -0.5 }}>
          📱 Cobranças & Análise de Churn
        </div>
        <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>
          WhatsApp automático + IA preditiva de cancelamento
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Inadimplentes", value: inadimplentes.length, color: "#e53e3e" },
          { label: "Alto Risco Churn", value: altoRisco.length, color: "#d97706" },
          { label: "Médio Risco", value: medioRisco.length, color: "#0891b2" },
          { label: "Enviados Hoje", value: enviados.size, color: "#16a34a" },
        ].map(k => (
          <div key={k.label} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: k.color, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { id: "cobranca", label: "💬 Cobranças WhatsApp" },
          { id: "churn", label: "🧠 IA Churn Preditivo" },
        ].map(a => (
          <button key={a.id} onClick={() => setAba(a.id as any)} style={{
            padding: "8px 18px", borderRadius: 10, border: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            background: aba === a.id ? "var(--brand)" : "var(--surface)",
            color: aba === a.id ? "#fff" : "var(--text2)",
            transition: "all 0.15s"
          }}>{a.label}</button>
        ))}
      </div>

      {/* ABA COBRANÇA */}
      {aba === "cobranca" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar aluna..." style={{ flex: 1 }} />
            <button onClick={enviarTodos} style={{
              padding: "9px 18px", borderRadius: 10, border: "none",
              background: "#25D366", color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap"
            }}>
              📤 Enviar para todos ({Math.min(inadFiltradas.length, 10)})
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {inadFiltradas.map(aluna => {
              const msg = msgCustom[aluna.id] || gerarMsgCobranca(aluna, mes, aluna.valor || 160, config);
              const enviado = enviados.has(aluna.id);
              return (
                <div key={aluna.id} style={{
                  background: "var(--surface)", border: `1.5px solid ${enviado ? "#16a34a" : "var(--border)"}`,
                  borderRadius: 12, padding: 16,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{aluna.nome}</div>
                      <div style={{ fontSize: 12, color: "var(--text3)" }}>
                        {aluna.modalidade} · {aluna.whatsapp || "Sem WhatsApp"} · {fmt(aluna.valor || 160)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {enviado && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>✓ Enviado</span>}
                      <button onClick={() => enviarWhatsApp(aluna)} style={{
                        padding: "7px 16px", borderRadius: 8, border: "none",
                        background: "#25D366", color: "#fff", fontSize: 12,
                        fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
                      }}>
                        📱 WhatsApp
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={msg}
                    onChange={e => setMsgCustom(prev => ({ ...prev, [aluna.id]: e.target.value }))}
                    rows={4}
                    style={{ width: "100%", fontSize: 12, borderRadius: 8, padding: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                  />
                </div>
              );
            })}
            {inadFiltradas.length === 0 && (
              <div style={{ textAlign: "center", padding: 60, color: "var(--text3)" }}>
                🎉 Nenhuma inadimplente encontrada!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA CHURN */}
      {aba === "churn" && (
        <div>
          <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>🧠 Como funciona a IA de Churn</div>
            <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.7 }}>
              A IA analisa o histórico de pagamentos de cada aluna e calcula a probabilidade de cancelamento nos próximos 30 dias.
              Fatores: meses consecutivos sem pagar, taxa de adimplência histórica, status da conta e perfil de bolsista.
              <strong style={{ color: "var(--brand)" }}> Aja antes que elas saiam!</strong>
            </div>
          </div>

          {altoRisco.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#e53e3e", marginBottom: 10 }}>
                🔴 Alto Risco ({altoRisco.length} alunas)
              </div>
              {altoRisco.map(a => (
                <div key={a.id} style={{ background: "var(--surface)", border: "1.5px solid #fca5a5", borderRadius: 12, padding: 14, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.nome}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>
                        {a.churn.motivos.join(" · ")}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#e53e3e" }}>{a.churn.score}%</div>
                        <div style={{ fontSize: 10, color: "var(--text3)" }}>risco</div>
                      </div>
                      <button onClick={() => { setAba("cobranca"); setBusca(a.nome.split(" ")[0]); }}
                        style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#25D366", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        📱 Cobrar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {medioRisco.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#d97706", marginBottom: 10 }}>
                🟡 Médio Risco ({medioRisco.length} alunas)
              </div>
              {medioRisco.map(a => (
                <div key={a.id} style={{ background: "var(--surface)", border: "1.5px solid #fde68a", borderRadius: 12, padding: 14, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.nome}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>
                        {a.churn.motivos.join(" · ")}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#d97706" }}>{a.churn.score}%</div>
                        <div style={{ fontSize: 10, color: "var(--text3)" }}>risco</div>
                      </div>
                      <button onClick={() => { setAba("cobranca"); setBusca(a.nome.split(" ")[0]); }}
                        style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#25D366", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        📱 Cobrar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {altoRisco.length === 0 && medioRisco.length === 0 && (
            <div style={{ textAlign: "center", padding: 60, color: "var(--text3)" }}>
              🎉 Nenhuma aluna em risco de cancelamento detectada!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
