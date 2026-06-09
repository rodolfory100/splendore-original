import { useState, useEffect } from "react";
import { getSemRematricula, restaurarAluna, efiGerarBoleto, efiGerarPix } from "../lib/api";
import { fmt, initials } from "../lib/api";

interface Props {
  config: any;
  onRefresh: () => void;
  onToast: (msg: string, type?: "success" | "danger" | "gold") => void;
}

const chipClass = (m: string) =>
  m === "Ballet" ? "chip-ballet" : m === "Jazz" ? "chip-jazz" : m === "Danças Urbanas" ? "chip-urbanas" : "chip-outro";

export function SemRematriculaPage({ config, onRefresh, onToast }: Props) {
  const [dados, setDados] = useState<{ arquivoMorto: any[]; suspeitasSemRemat: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"inativas" | "suspeitas">("inativas");
  const [gerandoId, setGerandoId] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const d = await getSemRematricula();
      setDados(d);
    } catch (e: any) {
      onToast(e.message, "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const handleRestaurar = async (id: string, nome: string) => {
    if (!confirm(`Reativar ${nome}?\n\nEla voltará como aluna ativa.`)) return;
    try {
      await restaurarAluna(id);
      onToast(`✦ ${nome} reativada!`, "success");
      carregar();
      onRefresh();
    } catch (e: any) {
      onToast(e.message, "danger");
    }
  };

  const convidarWhatsApp = (a: any) => {
    const escola = config?.escola || "Hathor Escola de Dança";
    const wpp = (a.whatsapp || "").replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá, ${a.responsavel || a.nome}! 🌸\n\nSentimos sua falta na *${escola}*!\n\n` +
      `A *${a.nome}* ainda tem uma vaga reservada para ela. Que tal voltarmos em 2026? 🩰\n\n` +
      `Ficamos à disposição para conversar sobre condições especiais de rematrícula.\n\n` +
      `Com carinho,\n*${escola}* ✨`
    );
    if (wpp) window.open(`https://wa.me/55${wpp}?text=${msg}`, "_blank");
    else onToast("WhatsApp não cadastrado", "danger");
  };

  const convidarTodas = (lista: any[]) => {
    if (!lista.length) return;
    if (!confirm(`Enviar convite de rematrícula para ${lista.length} aluna(s)?`)) return;
    let i = 0;
    const next = () => {
      if (i >= lista.length) { onToast(`${lista.length} convites enviados!`, "success"); return; }
      convidarWhatsApp(lista[i++]);
      setTimeout(next, 1200);
    };
    next();
  };

  const gerarCobrancaReativacao = async (a: any) => {
    if (!a.alunaId) { onToast("Aluna sem ID no sistema", "danger"); return; }
    setGerandoId(a.alunaId);
    try {
      const hoje = new Date();
      const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
      const res = await efiGerarBoleto({ alunaId: a.alunaId, mes, valor: a.valor || 160 });
      if (res.ok) {
        onToast("✦ Boleto gerado!", "success");
        if (res.linkBoleto) window.open(res.linkBoleto, "_blank");
      } else {
        onToast(res.error || "Erro ao gerar boleto", "danger");
      }
    } catch (e: any) {
      onToast(e.message, "danger");
    } finally {
      setGerandoId(null);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: "#a8998a" }}>
      <div style={{ width: 20, height: 20, border: "2px solid rgba(180,155,90,0.3)", borderTopColor: "#b8923a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      Carregando...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const inativas = dados?.arquivoMorto || [];
  const suspeitas = dados?.suspeitasSemRemat || [];
  const listaAtual = aba === "inativas" ? inativas : suspeitas;

  return (
    <div className="animate-fade-up">
      {/* Banner */}
      <div style={{ background: "rgba(184,112,42,0.06)", border: "1.5px solid rgba(184,112,42,0.22)", borderRadius: 10, padding: "18px 22px", marginBottom: 22, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 26 }}>⚠️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 700, color: "#b8702a" }}>
            Alunas Sem Rematrícula
          </div>
          <div style={{ fontSize: 12, color: "#a8998a", marginTop: 3 }}>
            Alunas que saíram ou estão com contrato vencido. Entre em contato para reconquistar.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => convidarTodas(listaAtual)} style={{ padding: "9px 16px", background: "#b8923a", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            📱 Convidar todas
          </button>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { id: "inativas" as const, label: `Arquivo Morto`, count: inativas.length, color: "#c0444e" },
          { id: "suspeitas" as const, label: `Contrato Vencido`, count: suspeitas.length, color: "#b8702a" },
        ].map(({ id, label, count, color }) => (
          <button key={id} onClick={() => setAba(id)} style={{
            padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
            background: aba === id ? color : "#f0ede6",
            color: aba === id ? "#fff" : "#6b5f4e",
          }}>
            {label}
            <span style={{ marginLeft: 8, padding: "1px 8px", borderRadius: 20, background: aba === id ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.08)", fontSize: 11 }}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ background: "#fff", border: "1px solid rgba(180,155,90,0.18)", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 5px rgba(0,0,0,0.05)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(180,155,90,0.18)", background: "#faf8f4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 700 }}>
              {aba === "inativas" ? "Cadastros no Arquivo Morto" : "Contratos Vencidos Sem Pagamento Recente"}
            </div>
            <div style={{ fontSize: 11, color: "#a8998a", marginTop: 2 }}>
              {aba === "inativas"
                ? "Alunas desligadas — podem ser reativadas"
                : "Ativas no sistema mas sem pagamento há mais de 30 dias após vencimento do contrato"}
            </div>
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: "#b8702a" }}>
            {listaAtual.length}
          </div>
        </div>

        {!listaAtual.length ? (
          <div style={{ textAlign: "center", padding: 48, color: "#a8998a" }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, opacity: 0.2, marginBottom: 10 }}>⊘</div>
            <div style={{ fontSize: 13 }}>Nenhuma aluna nesta categoria.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="splendore-table">
              <thead>
                <tr>
                  <th>Aluna</th>
                  <th>Responsável</th>
                  <th>WhatsApp</th>
                  <th>Modalidade</th>
                  <th>Mensalidade</th>
                  <th>{aba === "inativas" ? "Desligada em" : "Contrato até"}</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {listaAtual.map((a, i) => (
                  <tr key={a.id || i}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(184,112,42,0.1)", border: "1.5px solid rgba(184,112,42,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#b8702a", flexShrink: 0 }}>
                          {initials(a.nome)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{a.nome}</div>
                          {a.motivo && <div style={{ fontSize: 10, color: "#a8998a" }}>{a.motivo}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: "#6b5f4e" }}>{a.responsavel || "—"}</td>
                    <td>
                      {a.whatsapp ? (
                        <a href={`https://wa.me/55${(a.whatsapp).replace(/\D/g, "")}`} target="_blank"
                          style={{ color: "#3d7a72", fontSize: 12, textDecoration: "none" }}>{a.whatsapp}</a>
                      ) : "—"}
                    </td>
                    <td>
                      <span className={`chip ${chipClass(a.modalidade || "Ballet")}`}>{a.modalidade || "Ballet"}</span>
                    </td>
                    <td style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16 }}>
                      {a.valor ? fmt(a.valor) : "—"}
                    </td>
                    <td style={{ fontSize: 12, color: "#a8998a" }}>
                      {(a.arquivadaEm || a.contratoAte || "—")}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <button onClick={() => convidarWhatsApp(a)} style={{ padding: "5px 10px", background: "rgba(61,122,114,0.08)", border: "1.5px solid rgba(61,122,114,0.2)", borderRadius: 5, color: "#3d7a72", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                          📱 Convidar
                        </button>
                        {aba === "inativas" && (
                          <>
                            <button onClick={() => handleRestaurar(a.id, a.nome)} style={{ padding: "5px 10px", background: "#b8923a", border: "none", borderRadius: 5, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                              ↩ Reativar
                            </button>
                            {a.alunaId && (
                              <button onClick={() => gerarCobrancaReativacao(a)} disabled={gerandoId === a.alunaId} style={{ padding: "5px 10px", background: "rgba(58,111,168,0.08)", border: "1.5px solid rgba(58,111,168,0.2)", borderRadius: 5, color: "#3a6fa8", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                                {gerandoId === a.alunaId ? "..." : "🧾 Boleto"}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resumo receita potencial */}
      {listaAtual.length > 0 && (
        <div style={{ marginTop: 16, background: "rgba(184,146,58,0.05)", border: "1px solid rgba(184,146,58,0.2)", borderRadius: 8, padding: "14px 18px", display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#a8998a", marginBottom: 4 }}>Alunas perdidas</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 700, color: "#b8702a" }}>{listaAtual.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#a8998a", marginBottom: 4 }}>Receita mensal perdida</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 700, color: "#c0444e" }}>
              {fmt(listaAtual.reduce((s, a) => s + (a.valor || 160), 0))}
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "#6b5f4e", lineHeight: 1.6 }}>
              💡 <strong>Estratégia:</strong> Um contato carinhoso pelo WhatsApp pode reconquistar até 30% dessas alunas. Use o botão <em>"Convidar todas"</em> para enviar uma mensagem personalizada de uma vez.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
