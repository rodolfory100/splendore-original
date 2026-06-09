import { useState, useEffect } from "react";
import { getCobrancas, efiGerarBoleto, efiGerarPix, efiVerificar, fmt, initials, mesAtual } from "../lib/api";
import type { Inadimplente } from "../types";

interface Props {
  inadimplentes: Inadimplente[];
  config: any;
  onRefresh: () => void;
  onToast: (msg: string, type?: "success" | "danger" | "gold") => void;
}

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  pendente:  { color: "#b8702a", bg: "rgba(184,112,42,0.1)",  label: "⏳ Pendente"  },
  pago:      { color: "#3d7a72", bg: "rgba(61,122,114,0.1)",  label: "✅ Pago"       },
  cancelado: { color: "#c0444e", bg: "rgba(192,68,78,0.1)",   label: "✕ Cancelado"  },
  expirado:  { color: "#a8998a", bg: "rgba(168,153,138,0.1)", label: "⏰ Expirado"   },
};

export function CobrancasEfiPage({ inadimplentes, config, onRefresh, onToast, onNavigate }: Props) {
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [loadingCobrancas, setLoadingCobrancas] = useState(true);
  const [gerando, setGerando] = useState<string | null>(null);
  const [modalAluna, setModalAluna] = useState<Inadimplente | null>(null);
  const [tipoCob, setTipoCob] = useState<"boleto" | "pix">("pix");
  const [valorCob, setValorCob] = useState("");
  const [aba, setAba] = useState<"gerar" | "historico">("gerar");
  const [pixModal, setPixModal] = useState<any>(null);

  const carregar = async () => {
    try {
      const d = await getCobrancas();
      setCobrancas(d);
    } catch {}
    setLoadingCobrancas(false);
  };

  useEffect(() => { carregar(); }, []);

  const temEfi = !!(config?.efiClientId && config?.efiClientSecret);
  const mes = mesAtual();

  const handleGerar = async () => {
    if (!modalAluna) return;
    setGerando(modalAluna.id);
    try {
      const valor = parseFloat(valorCob) || modalAluna.valor || 160;
      let res;
      if (tipoCob === "boleto") {
        res = await efiGerarBoleto({ alunaId: modalAluna.id, mes, valor });
      } else {
        res = await efiGerarPix({ alunaId: modalAluna.id, mes, valor });
      }

      if (!res.ok) {
        onToast(res.error || "Erro ao gerar cobrança", "danger");
        return;
      }

      if (tipoCob === "boleto" && res.linkBoleto) {
        onToast("✦ Boleto gerado! Abrindo link...", "success");
        window.open(res.linkBoleto, "_blank");
        // Enviar via WhatsApp
        const wpp = (modalAluna.whatsapp || "").replace(/\D/g, "");
        if (wpp) {
          const msg = encodeURIComponent(
            `Olá, ${modalAluna.responsavel || modalAluna.nome}! 🩰\n\n` +
            `Segue o boleto de mensalidade de *${modalAluna.nome}*:\n\n` +
            `💰 Valor: *${fmt(valor)}*\n📅 Vencimento: ${res.vencimento}\n\n` +
            `🔗 Link do boleto:\n${res.linkBoleto}\n\n` +
            `*Hathor Escola de Dança* ✨`
          );
          setTimeout(() => window.open(`https://wa.me/55${wpp}?text=${msg}`, "_blank"), 1000);
        }
      } else if (tipoCob === "pix") {
        setPixModal({ ...res, aluna: modalAluna });
        onToast("✦ Pix gerado!", "success");
      }

      setModalAluna(null);
      carregar();
    } catch (e: any) {
      onToast(e.message, "danger");
    } finally {
      setGerando(null);
    }
  };

  const handleVerificar = async (id: string) => {
    try {
      const r = await efiVerificar(id);
      onToast(`Status: ${r.status}`, r.status === "pago" ? "success" : "gold");
      carregar();
    } catch (e: any) {
      onToast(e.message, "danger");
    }
  };

  return (
    <div className="animate-fade-up">
      {/* Aviso sem credenciais */}
      {!temEfi && (
        <div style={{ background: "rgba(192,68,78,0.06)", border: "1.5px solid rgba(192,68,78,0.2)", borderRadius: 10, padding: "18px 22px", marginBottom: 22, display: "flex", gap: 14, alignItems: "flex-start" }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🔑</span>
          <div>
            <div style={{ fontWeight: 700, color: "#c0444e", fontSize: 14, marginBottom: 4 }}>Efí Bank não configurada</div>
            <div style={{ fontSize: 13, color: "#6b5f4e", lineHeight: 1.7 }}>
              Para gerar boletos e cobranças Pix, configure suas credenciais da Efí Bank em{" "}
              <strong>Administração → Efí Bank</strong>.<br />
              <span style={{ fontSize: 12, color: "#a8998a" }}>
                Acesse efipay.com.br → API → Minhas Aplicações → Client ID e Client Secret
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Abas */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { id: "gerar" as const, label: `Gerar Cobrança`, count: inadimplentes.length },
          { id: "historico" as const, label: `Histórico`, count: cobrancas.length },
        ].map(({ id, label, count }) => (
          <button key={id} onClick={() => setAba(id)} style={{
            padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
            background: aba === id ? "#b8923a" : "#f0ede6",
            color: aba === id ? "#fff" : "#6b5f4e",
          }}>
            {label}
            <span style={{ marginLeft: 8, padding: "1px 8px", borderRadius: 20, background: aba === id ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.08)", fontSize: 11 }}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ABA: GERAR */}
      {aba === "gerar" && (
        <div style={{ background: "#fff", border: "1px solid rgba(180,155,90,0.18)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(180,155,90,0.18)", background: "#faf8f4" }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 700 }}>Inadimplentes — Gerar Cobrança</div>
            <div style={{ fontSize: 11, color: "#a8998a", marginTop: 2 }}>Clique em "Cobrar" para gerar boleto ou Pix de cobrança para cada aluna</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="splendore-table">
              <thead><tr><th>Aluna</th><th>Responsável</th><th>WhatsApp</th><th>Mensalidade</th><th>CPF</th><th>Ações</th></tr></thead>
              <tbody>
                {inadimplentes.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(192,68,78,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#c0444e", flexShrink: 0 }}>{initials(a.nome)}</div>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{a.nome}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: "#6b5f4e" }}>{a.responsavel}</td>
                    <td style={{ fontSize: 12 }}>{a.whatsapp}</td>
                    <td style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16 }}>{fmt(a.valor)}</td>
                    <td>
                      <span style={{ fontSize: 11, color: a.cpfResponsavel ? "#3d7a72" : "#c0444e", fontWeight: 600 }}>
                        {a.cpfResponsavel ? "✓ OK" : "✗ Faltando"}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => { setModalAluna(a); setValorCob(String(a.valor)); setTipoCob("pix"); }}
                        style={{ padding: "5px 12px", background: temEfi ? "#4F46E5" : "#6C63FF", border: "none", borderRadius: 5, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                      >
                        🧾 Cobrar
                      </button>
                    </td>
                  </tr>
                ))}
                {!inadimplentes.length && (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#a8998a" }}>
                    ✦ Todas as alunas em dia!
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA: HISTÓRICO */}
      {aba === "historico" && (
        <div style={{ background: "#fff", border: "1px solid rgba(180,155,90,0.18)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(180,155,90,0.18)", background: "#faf8f4" }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 700 }}>Histórico de Cobranças</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="splendore-table">
              <thead><tr><th>Aluna</th><th>Mês</th><th>Tipo</th><th>Valor</th><th>Venc.</th><th>Status</th><th>Link</th><th>Ações</th></tr></thead>
              <tbody>
                {cobrancas.map(c => {
                  const st = STATUS_STYLE[c.status] || STATUS_STYLE.pendente;
                  return (
                    <tr key={c.id}>
                      <td style={{ fontSize: 12 }}>{c.alunaId}</td>
                      <td style={{ fontSize: 12, color: "#a8998a" }}>{c.mes}</td>
                      <td><span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: c.tipo === "boleto" ? "rgba(58,111,168,0.1)" : "rgba(61,122,114,0.1)", color: c.tipo === "boleto" ? "#3a6fa8" : "#3d7a72" }}>{c.tipo === "boleto" ? "🧾 Boleto" : "🔑 Pix"}</span></td>
                      <td style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16 }}>{fmt(c.valor)}</td>
                      <td style={{ fontSize: 12, color: "#a8998a" }}>{c.vencimento}</td>
                      <td><span style={{ padding: "3px 9px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span></td>
                      <td>
                        {c.linkBoleto && <a href={c.linkBoleto} target="_blank" style={{ fontSize: 11, color: "#3a6fa8" }}>Ver boleto</a>}
                        {c.pixCopiaECola && <span style={{ fontSize: 10, color: "#3d7a72", cursor: "pointer" }} onClick={() => { navigator.clipboard?.writeText(c.pixCopiaECola); onToast("Pix copiado!", "success"); }}>📋 Copiar Pix</span>}
                      </td>
                      <td>
                        {c.status === "pendente" && (
                          <button onClick={() => handleVerificar(c.id)} style={{ padding: "4px 10px", background: "#faf8f4", border: "1px solid rgba(180,155,90,0.3)", borderRadius: 5, fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>↻ Verificar</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!cobrancas.length && (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#a8998a" }}>Nenhuma cobrança gerada ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Gerar cobrança */}
      {modalAluna && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(30,26,22,0.5)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setModalAluna(null); }}>
          <div style={{ background: "#fff", border: "1px solid rgba(180,155,90,0.35)", borderRadius: 14, padding: 28, width: 480, maxWidth: "96vw", position: "relative", animation: "fadeUp 0.25s ease both", boxShadow: "0 16px 48px rgba(0,0,0,0.14)" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(to right,#b8923a,#4e9b91)", borderRadius: "14px 14px 0 0" }} />
            <button onClick={() => setModalAluna(null)} style={{ position: "absolute", top: 16, right: 16, width: 28, height: 28, borderRadius: "50%", background: "#f0ede6", border: "none", cursor: "pointer", fontSize: 13 }}>✕</button>

            <div style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: "#3d7a72", marginBottom: 4 }}>Cobrança Efí Bank</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Gerar Cobrança</div>
            <div style={{ fontSize: 13, color: "#6b5f4e", marginBottom: 20 }}>
              <strong>{modalAluna.nome}</strong> · {modalAluna.responsavel}
            </div>

            {/* Tipo */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#a8998a", fontWeight: 600, display: "block", marginBottom: 8 }}>Tipo de Cobrança</label>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { id: "pix" as const, icon: "🔑", label: "Pix (QR Code)", sub: "Não precisa de CPF" },
                  { id: "boleto" as const, icon: "🧾", label: "Boleto", sub: "Requer CPF cadastrado" },
                ].map(({ id, icon, label, sub }) => (
                  <button key={id} onClick={() => setTipoCob(id)} style={{
                    flex: 1, padding: "14px 12px", borderRadius: 10, cursor: "pointer",
                    border: `2px solid ${tipoCob === id ? "#b8923a" : "rgba(180,155,90,0.25)"}`,
                    background: tipoCob === id ? "rgba(184,146,58,0.07)" : "#faf8f4",
                    textAlign: "center", fontFamily: "'DM Sans', sans-serif",
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: tipoCob === id ? "#b8923a" : "#1e1a16" }}>{label}</div>
                    <div style={{ fontSize: 10, color: "#a8998a", marginTop: 3 }}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* CPF warning para boleto */}
            {tipoCob === "boleto" && !modalAluna.cpfResponsavel && (
              <div style={{ background: "rgba(192,68,78,0.07)", border: "1px solid rgba(192,68,78,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#c0444e" }}>
                ⚠️ Esta aluna não tem CPF cadastrado. Cadastre o CPF na ficha dela antes de gerar boleto, ou use Pix.
              </div>
            )}

            {/* Valor */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#a8998a", fontWeight: 600, display: "block", marginBottom: 6 }}>Valor (R$)</label>
              <input
                type="number"
                value={valorCob}
                onChange={e => setValorCob(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", background: "#faf8f4", border: "1.5px solid rgba(180,155,90,0.25)", borderRadius: 6, color: "#1e1a16", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid rgba(180,155,90,0.18)" }}>
              <button onClick={() => setModalAluna(null)} style={{ padding: "10px 16px", background: "#f0ede6", border: "1.5px solid rgba(180,155,90,0.3)", borderRadius: 6, color: "#6b5f4e", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                Cancelar
              </button>
              <button
                onClick={!temEfi ? () => { setModalAluna(null); if(onNavigate) onNavigate("admin"); onToast("Configure a Efi Bank em Administração → Efi Bank", "gold"); } : handleGerar}
                disabled={temEfi && (!!gerando || (tipoCob === "boleto" && !modalAluna.cpfResponsavel))}
                style={{ padding: "10px 22px", background: gerando ? "#e8e4dc" : "#b8923a", border: "none", borderRadius: 6, color: gerando ? "#a8998a" : "#fff", fontSize: 12, fontWeight: 700, cursor: gerando ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif" }}
              >
                {gerando ? "Gerando..." : `✦ Gerar ${tipoCob === "boleto" ? "Boleto" : "Pix"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Pix QR Code */}
      {pixModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(30,26,22,0.6)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setPixModal(null); }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 32, width: 400, maxWidth: "96vw", textAlign: "center", animation: "fadeUp 0.25s ease both" }}>
            <div style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: "#3d7a72", marginBottom: 4 }}>Cobrança Pix</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Pix Gerado!</div>
            <div style={{ fontSize: 13, color: "#6b5f4e", marginBottom: 20 }}>{pixModal.aluna?.nome} · {fmt(pixModal.valor)}</div>

            {pixModal.qrCodeBase64 && (
              <img src={pixModal.qrCodeBase64} alt="QR Code Pix" style={{ width: 200, height: 200, borderRadius: 8, border: "1px solid rgba(180,155,90,0.2)", marginBottom: 16 }} />
            )}

            {pixModal.pixCopiaECola && (
              <div style={{ background: "#faf8f4", borderRadius: 8, padding: "12px 14px", fontSize: 11, color: "#6b5f4e", wordBreak: "break-all", marginBottom: 16, border: "1px solid rgba(180,155,90,0.2)", textAlign: "left" }}>
                {pixModal.pixCopiaECola}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
              {pixModal.pixCopiaECola && (
                <button onClick={() => { navigator.clipboard?.writeText(pixModal.pixCopiaECola); onToast("Pix Copia e Cola copiado!", "success"); }} style={{ padding: "12px", background: "rgba(61,122,114,0.1)", border: "1.5px solid rgba(61,122,114,0.3)", borderRadius: 8, color: "#3d7a72", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  📋 Copiar Pix Copia e Cola
                </button>
              )}
              {pixModal.aluna?.whatsapp && pixModal.pixCopiaECola && (
                <button onClick={() => {
                  const wpp = pixModal.aluna.whatsapp.replace(/\D/g,'');
                  const msg = encodeURIComponent(`Olá, ${pixModal.aluna.responsavel || pixModal.aluna.nome}! 🩰\n\nSegue o Pix para pagamento da mensalidade de *${pixModal.aluna.nome}*:\n\n💰 Valor: *${fmt(pixModal.valor)}*\n\n🔑 *Pix Copia e Cola:*\n${pixModal.pixCopiaECola}\n\nVencimento: ${pixModal.vencimento}\n\n*Hathor Escola de Dança* ✨`);
                  window.open(`https://wa.me/55${wpp}?text=${msg}`, '_blank');
                }} style={{ padding: "12px", background: "#3d7a72", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  📱 Enviar por WhatsApp
                </button>
              )}
              <button onClick={() => setPixModal(null)} style={{ padding: "10px", background: "#f0ede6", border: "1px solid rgba(180,155,90,0.3)", borderRadius: 8, color: "#6b5f4e", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
