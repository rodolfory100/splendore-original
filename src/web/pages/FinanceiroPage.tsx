import { useState, useEffect } from "react";
import { getDespesas, addDespesa, updateDespesa, deleteDespesa, getDRE, getFluxoCaixa, fmt, mesAtual, genId } from "../lib/api";

interface Props {
  onToast: (msg: string, type?: "success"|"danger"|"gold") => void;
}

const CATEGORIAS = ["Aluguel", "Salários", "Material", "Manutenção", "Marketing", "Impostos", "Geral"];

const lbl: React.CSSProperties = {
  fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: "var(--text2)", fontWeight: 700,
};
const inp: React.CSSProperties = {
  background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 7,
  padding: "9px 12px", color: "var(--text)", fontSize: 13, fontFamily: "inherit", width: "100%",
};

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 18px", background: active ? "var(--gold)" : "transparent",
        border: active ? "none" : "1.5px solid var(--border)", borderRadius: 8,
        color: active ? "#fff" : "var(--text2)", fontWeight: 700, fontSize: 13, cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

export function FinanceiroPage({ onToast }: Props) {
  const [tab, setTab] = useState<"despesas"|"dre"|"fluxo">("despesas");
  const [mes, setMes] = useState(mesAtual());
  const [despesas, setDespesas] = useState<any[]>([]);
  const [dre, setDre] = useState<any>(null);
  const [fluxo, setFluxo] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState({ descricao: "", valor: "", data: new Date().toISOString().split("T")[0], categoria: "Geral", formaPagamento: "", observacao: "" });
  const [saving, setSaving] = useState(false);

  const loadDespesas = async () => {
    setLoading(true);
    try {
      const data = await getDespesas(mes);
      setDespesas(data);
    } catch { onToast("Erro ao carregar despesas", "danger"); }
    finally { setLoading(false); }
  };

  const loadDRE = async () => {
    setLoading(true);
    try {
      const data = await getDRE(mes);
      setDre(data);
    } catch { onToast("Erro ao carregar DRE", "danger"); }
    finally { setLoading(false); }
  };

  const loadFluxo = async () => {
    setLoading(true);
    try {
      const data = await getFluxoCaixa();
      setFluxo(data);
    } catch { onToast("Erro ao carregar fluxo", "danger"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === "despesas") loadDespesas();
    else if (tab === "dre") loadDRE();
    else loadFluxo();
  }, [tab, mes]);

  const openNew = () => {
    setEditId(null);
    setForm({ descricao: "", valor: "", data: new Date().toISOString().split("T")[0], categoria: "Geral", formaPagamento: "", observacao: "" });
    setModal(true);
  };
  const openEdit = (d: any) => {
    setEditId(d.id);
    setForm({ descricao: d.descricao, valor: String(d.valor), data: d.data, categoria: d.categoria || "Geral", formaPagamento: d.formaPagamento || "", observacao: d.observacao || "" });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.descricao || !form.valor || !form.data) { onToast("Preencha todos os campos obrigatórios", "danger"); return; }
    setSaving(true);
    try {
      const data = { ...form, valor: parseFloat(form.valor) };
      if (editId) {
        await updateDespesa(editId, data);
        onToast("Despesa atualizada!", "success");
      } else {
        await addDespesa({ ...data, id: genId() });
        onToast("Despesa registrada!", "success");
      }
      setModal(false);
      await loadDespesas();
    } catch (e: any) { onToast(e.message, "danger"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta despesa?")) return;
    try {
      await deleteDespesa(id);
      onToast("Despesa removida", "success");
      await loadDespesas();
    } catch (e: any) { onToast(e.message, "danger"); }
  };

  const totalDespesas = despesas.reduce((s, d) => s + (d.valor || 0), 0);

  return (
    <div style={{ padding: "24px 20px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>💰 Financeiro</div>
          <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>DRE, Despesas e Fluxo de Caixa</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {tab !== "fluxo" && (
            <input
              type="month"
              value={mes}
              onChange={e => setMes(e.target.value)}
              style={{ ...inp, width: "auto", padding: "7px 10px" }}
            />
          )}
          {tab === "despesas" && (
            <button
              onClick={openNew}
              style={{ padding: "9px 18px", background: "var(--gold)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              + Despesa
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <TabBtn label="Despesas" active={tab === "despesas"} onClick={() => setTab("despesas")} />
        <TabBtn label="DRE" active={tab === "dre"} onClick={() => setTab("dre")} />
        <TabBtn label="Fluxo de Caixa" active={tab === "fluxo"} onClick={() => setTab("fluxo")} />
      </div>

      {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>Carregando...</div>}

      {/* ── TAB: DESPESAS ─────────────────────────────────────────── */}
      {!loading && tab === "despesas" && (
        <>
          {/* Resumo por categoria */}
          {despesas.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
              {CATEGORIAS.filter(c => despesas.some(d => d.categoria === c)).map(cat => {
                const total = despesas.filter(d => d.categoria === cat).reduce((s, d) => s + (d.valor || 0), 0);
                return (
                  <div key={cat} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: "var(--text2)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{cat}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>{fmt(total)}</div>
                  </div>
                );
              })}
              <div style={{ background: "rgba(220,38,38,0.07)", border: "1.5px solid rgba(220,38,38,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: "#dc2626", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Total</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#dc2626", marginTop: 4 }}>{fmt(totalDespesas)}</div>
              </div>
            </div>
          )}

          {despesas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text2)" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>💸</div>
              <div style={{ fontWeight: 700 }}>Nenhuma despesa em {mes}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Registre saídas financeiras como aluguel, salários, material etc.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {despesas.map(d => (
                <div key={d.id} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{d.descricao}</div>
                    <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>
                      {d.categoria} · {d.data} {d.formaPagamento ? `· ${d.formaPagamento}` : ""}
                    </div>
                    {d.observacao && <div style={{ fontSize: 11, color: "var(--text2)", fontStyle: "italic" }}>{d.observacao}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#dc2626" }}>{fmt(d.valor)}</div>
                    <button onClick={() => openEdit(d)} style={{ padding: "5px 10px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>✎</button>
                    <button onClick={() => handleDelete(d.id)} style={{ padding: "5px 10px", background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#dc2626" }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TAB: DRE ──────────────────────────────────────────────── */}
      {!loading && tab === "dre" && dre && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {[
              { label: "Receita Bruta", value: dre.receitaBruta, color: "#16a34a" },
              { label: "Total Despesas", value: dre.totalDespesas, color: "#dc2626" },
              { label: "Resultado", value: dre.resultado, color: dre.resultado >= 0 ? "#16a34a" : "#dc2626" },
              { label: "Margem", value: null, extra: `${dre.margemPct?.toFixed(1) || 0}%`, color: dre.resultado >= 0 ? "#16a34a" : "#dc2626" },
            ].map(item => (
              <div key={item.label} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ fontSize: 10, color: "var(--text2)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>
                  {item.extra || fmt(item.value || 0)}
                </div>
              </div>
            ))}
          </div>

          {/* Despesas por categoria */}
          {dre.despesasPorCategoria && Object.keys(dre.despesasPorCategoria).length > 0 && (
            <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 20, marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--text2)", marginBottom: 14 }}>Despesas por Categoria</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(dre.despesasPorCategoria).map(([cat, val]: any) => (
                  <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 13, color: "var(--text)" }}>{cat}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{fmt(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detalhes */}
          <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--text2)", marginBottom: 14 }}>Detalhamento</div>
            {[
              ["Mensalidades Recebidas", dre.mensalidadesRecebidas, "#16a34a"],
              ["Pagamentos Avulsos", dre.pagamentosAvulsos, "#16a34a"],
              ["Inadimplência Estimada", dre.inadimplenciaEstimada, "#dc2626"],
            ].map(([label, val, color]: any) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13 }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>{fmt(val || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: FLUXO DE CAIXA ──────────────────────────────────── */}
      {!loading && tab === "fluxo" && (
        <div>
          {fluxo.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "var(--text2)" }}>Sem dados de fluxo</div>
          ) : (
            <>
              {/* Gráfico simples de barras */}
              <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "20px", marginBottom: 20, overflowX: "auto" }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--text2)", marginBottom: 16 }}>Últimos 12 meses</div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", minWidth: 600, height: 160 }}>
                  {fluxo.map(m => {
                    const max = Math.max(...fluxo.map(x => Math.max(x.receita, x.despesas, 1)));
                    const hR = Math.max(4, (m.receita / max) * 130);
                    const hD = Math.max(4, (m.despesas / max) * 130);
                    return (
                      <div key={m.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 140 }}>
                          <div style={{ width: 14, height: hR, background: "#16a34a", borderRadius: "3px 3px 0 0", title: `Receita: ${fmt(m.receita)}` }} title={`R: ${fmt(m.receita)}`} />
                          <div style={{ width: 14, height: hD, background: "#dc2626", borderRadius: "3px 3px 0 0" }} title={`D: ${fmt(m.despesas)}`} />
                        </div>
                        <div style={{ fontSize: 9, color: "var(--text2)", textAlign: "center" }}>{m.mes.slice(5)}/{m.mes.slice(2,4)}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: "var(--text2)" }}>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#16a34a", borderRadius: 2, marginRight: 4 }} />Receita</span>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#dc2626", borderRadius: 2, marginRight: 4 }} />Despesas</span>
                </div>
              </div>

              {/* Tabela */}
              <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg2)" }}>
                      {["Mês", "Receita", "Despesas", "Resultado"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: h === "Mês" ? "left" : "right", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--text2)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fluxo.map(m => (
                      <tr key={m.mes} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600 }}>{m.mes}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#16a34a", fontWeight: 600 }}>{fmt(m.receita)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#dc2626", fontWeight: 600 }}>{fmt(m.despesas)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: m.resultado >= 0 ? "#16a34a" : "#dc2626" }}>{fmt(m.resultado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal despesa */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 28, width: 440, maxWidth: "90vw" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 20 }}>
              {editId ? "Editar Despesa" : "Nova Despesa"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={lbl}>Descrição *</label>
                <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Aluguel do studio" style={inp} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Valor (R$) *</label>
                  <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} type="number" placeholder="0,00" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Data *</label>
                  <input value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} type="date" style={inp} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Categoria</label>
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={inp}>
                    {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Forma de Pagamento</label>
                  <input value={form.formaPagamento} onChange={e => setForm(f => ({ ...f, formaPagamento: e.target.value }))} placeholder="Pix, Transferência..." style={inp} />
                </div>
              </div>
              <div>
                <label style={lbl}>Observação</label>
                <input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional" style={inp} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={() => setModal(false)} style={{ flex: 1, padding: "10px 0", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "10px 0", background: "var(--gold)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
