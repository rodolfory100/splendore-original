import { useState, useEffect } from "react";
import { getEstoque, addItemEstoque, updateItemEstoque, deleteItemEstoque, getEmprestimos, addEmprestimo, devolverEmprestimo, fmt, genId } from "../lib/api";
import type { Aluna } from "../types";

interface Props {
  alunas: Aluna[];
  onToast: (msg: string, type?: "success"|"danger"|"gold") => void;
}

const CATEGORIAS = ["Fantasia", "Acessório", "Uniforme", "Material"];
const TAMANHOS = ["PP", "P", "M", "G", "GG", "2", "4", "6", "8", "10", "12", "14", "16"];

const lbl: React.CSSProperties = {
  fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: "var(--text2)", fontWeight: 700,
};
const inp: React.CSSProperties = {
  background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 7,
  padding: "9px 12px", color: "var(--text)", fontSize: 13, fontFamily: "inherit", width: "100%",
};

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: "8px 18px", background: active ? "var(--gold)" : "transparent", border: active ? "none" : "1.5px solid var(--border)", borderRadius: 8, color: active ? "#fff" : "var(--text2)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
      {label}
    </button>
  );
}

export function EstoquePage({ alunas, onToast }: Props) {
  const [tab, setTab] = useState<"itens"|"emprestimos">("itens");
  const [itens, setItens] = useState<any[]>([]);
  const [emprestimos, setEmprestimos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("");
  const [somenteDisponiveis, setSomenteDisponiveis] = useState(false);

  // Modal Item
  const [modalItem, setModalItem] = useState(false);
  const [editItemId, setEditItemId] = useState<string|null>(null);
  const [formItem, setFormItem] = useState({ nome: "", categoria: "Fantasia", tamanho: "", quantidade: "1", descricao: "", valor: "" });

  // Modal Empréstimo
  const [modalEmp, setModalEmp] = useState(false);
  const [formEmp, setFormEmp] = useState({ itemId: "", alunaId: "", dataEmprestimo: new Date().toISOString().split("T")[0], dataDevolucaoPrevista: "", observacao: "" });
  const [empSearch, setEmpSearch] = useState("");
  const [alunaSearch, setAlunaSearch] = useState("");

  const [saving, setSaving] = useState(false);
  const [mostrarDevolvidos, setMostrarDevolvidos] = useState(false);

  const loadItens = async () => {
    try { setItens(await getEstoque()); } catch { onToast("Erro ao carregar estoque", "danger"); }
  };
  const loadEmprestimos = async () => {
    try { setEmprestimos(await getEmprestimos()); } catch { onToast("Erro ao carregar empréstimos", "danger"); }
  };

  useEffect(() => {
    Promise.all([loadItens(), loadEmprestimos()]).finally(() => setLoading(false));
  }, []);

  const filteredItens = itens.filter(i => {
    const matchCat = !catFilter || i.categoria === catFilter;
    const matchDisp = !somenteDisponiveis || (i.quantidadeDisponivel || 0) > 0;
    const matchSearch = !empSearch || i.nome.toLowerCase().includes(empSearch.toLowerCase());
    return matchCat && matchDisp && matchSearch;
  });

  const filteredAlunas = alunas.filter(a => !alunaSearch || a.nome.toLowerCase().includes(alunaSearch.toLowerCase())).slice(0, 8);

  const openNewItem = () => {
    setEditItemId(null);
    setFormItem({ nome: "", categoria: "Fantasia", tamanho: "", quantidade: "1", descricao: "", valor: "" });
    setModalItem(true);
  };
  const openEditItem = (item: any) => {
    setEditItemId(item.id);
    setFormItem({ nome: item.nome, categoria: item.categoria || "Fantasia", tamanho: item.tamanho || "", quantidade: String(item.quantidade || 1), descricao: item.descricao || "", valor: String(item.valor || "") });
    setModalItem(true);
  };

  const handleSaveItem = async () => {
    if (!formItem.nome) { onToast("Nome obrigatório", "danger"); return; }
    setSaving(true);
    try {
      const qty = parseInt(formItem.quantidade) || 1;
      const data = { ...formItem, quantidade: qty, quantidadeDisponivel: qty, valor: formItem.valor ? parseFloat(formItem.valor) : null };
      if (editItemId) {
        await updateItemEstoque(editItemId, { ...formItem, quantidade: qty, valor: data.valor });
        onToast("Item atualizado!", "success");
      } else {
        await addItemEstoque({ ...data, id: genId() });
        onToast("Item cadastrado!", "success");
      }
      setModalItem(false);
      await loadItens();
    } catch (e: any) { onToast(e.message, "danger"); }
    finally { setSaving(false); }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Remover este item do estoque?")) return;
    try {
      await deleteItemEstoque(id);
      onToast("Item removido", "success");
      await loadItens();
    } catch (e: any) { onToast(e.message, "danger"); }
  };

  const openEmprestimo = (item?: any) => {
    setFormEmp({ itemId: item?.id || "", alunaId: "", dataEmprestimo: new Date().toISOString().split("T")[0], dataDevolucaoPrevista: "", observacao: "" });
    setAlunaSearch("");
    setModalEmp(true);
  };

  const handleSaveEmp = async () => {
    if (!formEmp.itemId || !formEmp.alunaId) { onToast("Selecione item e aluna", "danger"); return; }
    setSaving(true);
    try {
      await addEmprestimo({ ...formEmp, id: genId() });
      onToast("Empréstimo registrado!", "success");
      setModalEmp(false);
      await Promise.all([loadItens(), loadEmprestimos()]);
    } catch (e: any) { onToast(e.message, "danger"); }
    finally { setSaving(false); }
  };

  const handleDevolver = async (id: string) => {
    if (!confirm("Confirmar devolução?")) return;
    try {
      await devolverEmprestimo(id);
      onToast("Devolução registrada!", "success");
      await Promise.all([loadItens(), loadEmprestimos()]);
    } catch (e: any) { onToast(e.message, "danger"); }
  };

  const empFiltrados = emprestimos.filter(e => mostrarDevolvidos ? true : !e.devolvido);

  const getNomeAluna = (id: string) => alunas.find(a => a.id === id)?.nome || id;
  const getNomeItem = (id: string) => itens.find(i => i.id === id)?.nome || id;

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>Carregando...</div>;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>👗 Estoque & Fantasias</div>
          <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>Controle de fantasias, uniformes e empréstimos</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {tab === "itens" && (
            <button onClick={openNewItem} style={{ padding: "9px 18px", background: "var(--gold)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              + Item
            </button>
          )}
          {tab === "emprestimos" && (
            <button onClick={() => openEmprestimo()} style={{ padding: "9px 18px", background: "var(--gold)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              + Empréstimo
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <TabBtn label={`Itens (${itens.length})`} active={tab === "itens"} onClick={() => setTab("itens")} />
        <TabBtn label={`Empréstimos (${emprestimos.filter(e => !e.devolvido).length} ativos)`} active={tab === "emprestimos"} onClick={() => setTab("emprestimos")} />
      </div>

      {/* ── TAB: ITENS ──────────────────────────────────── */}
      {tab === "itens" && (
        <>
          {/* Filtros */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <input
              value={empSearch}
              onChange={e => setEmpSearch(e.target.value)}
              placeholder="Buscar item..."
              style={{ ...inp, width: 200 }}
            />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ ...inp, width: "auto" }}>
              <option value="">Todas as categorias</option>
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text2)", cursor: "pointer" }}>
              <input type="checkbox" checked={somenteDisponiveis} onChange={e => setSomenteDisponiveis(e.target.checked)} />
              Somente disponíveis
            </label>
          </div>

          {filteredItens.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text2)" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>👗</div>
              <div style={{ fontWeight: 700 }}>Nenhum item encontrado</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Cadastre fantasias, uniformes, acessórios e materiais</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {filteredItens.map(item => {
                const disponivel = item.quantidadeDisponivel ?? item.quantidade ?? 0;
                const total = item.quantidade ?? 0;
                return (
                  <div key={item.id} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{item.nome}</div>
                        <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>{item.categoria}{item.tamanho ? ` · ${item.tamanho}` : ""}</div>
                      </div>
                      <div style={{
                        padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: disponivel > 0 ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)",
                        color: disponivel > 0 ? "#16a34a" : "#dc2626",
                      }}>
                        {disponivel}/{total}
                      </div>
                    </div>
                    {item.descricao && <div style={{ fontSize: 11, color: "var(--text2)", fontStyle: "italic" }}>{item.descricao}</div>}
                    {item.valor && <div style={{ fontSize: 12, color: "var(--text2)" }}>Valor: {fmt(item.valor)}</div>}
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <button
                        onClick={() => openEmprestimo(item)}
                        disabled={disponivel < 1}
                        style={{ flex: 1, padding: "6px 0", background: disponivel > 0 ? "rgba(180,155,90,0.12)" : "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: disponivel > 0 ? "pointer" : "not-allowed", color: disponivel > 0 ? "var(--gold-dark)" : "var(--text2)" }}
                      >
                        Emprestar
                      </button>
                      <button onClick={() => openEditItem(item)} style={{ padding: "6px 10px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>✎</button>
                      <button onClick={() => handleDeleteItem(item.id)} style={{ padding: "6px 10px", background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6, fontSize: 11, cursor: "pointer", color: "#dc2626" }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB: EMPRÉSTIMOS ──────────────────────────── */}
      {tab === "emprestimos" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text2)", cursor: "pointer" }}>
              <input type="checkbox" checked={mostrarDevolvidos} onChange={e => setMostrarDevolvidos(e.target.checked)} />
              Mostrar devolvidos
            </label>
          </div>
          {empFiltrados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text2)" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
              <div style={{ fontWeight: 700 }}>Nenhum empréstimo ativo</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {empFiltrados.map(emp => (
                <div key={emp.id} style={{
                  background: "var(--surface)", border: `1.5px solid ${emp.devolvido ? "var(--border)" : "rgba(180,155,90,0.3)"}`,
                  borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
                  opacity: emp.devolvido ? 0.6 : 1,
                }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{getNomeItem(emp.itemId)}</div>
                    <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>
                      {getNomeAluna(emp.alunaId)} · Emprestado em {emp.dataEmprestimo}
                    </div>
                    {emp.dataDevolucaoPrevista && !emp.devolvido && (
                      <div style={{ fontSize: 11, color: new Date(emp.dataDevolucaoPrevista) < new Date() ? "#dc2626" : "var(--text2)" }}>
                        Devolver até: {emp.dataDevolucaoPrevista}
                        {new Date(emp.dataDevolucaoPrevista) < new Date() ? " ⚠️ Atrasado" : ""}
                      </div>
                    )}
                    {emp.devolvido && <div style={{ fontSize: 11, color: "#16a34a" }}>✓ Devolvido em {emp.dataDevolucaoReal}</div>}
                    {emp.observacao && <div style={{ fontSize: 11, color: "var(--text2)", fontStyle: "italic" }}>{emp.observacao}</div>}
                  </div>
                  {!emp.devolvido && (
                    <button
                      onClick={() => handleDevolver(emp.id)}
                      style={{ padding: "7px 14px", background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.3)", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#16a34a", cursor: "pointer" }}
                    >
                      ✓ Devolver
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal Item */}
      {modalItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 28, width: 440, maxWidth: "90vw" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 20 }}>{editItemId ? "Editar Item" : "Novo Item"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={lbl}>Nome *</label>
                <input value={formItem.nome} onChange={e => setFormItem(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Fantasia Lago dos Cisnes" style={inp} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Categoria</label>
                  <select value={formItem.categoria} onChange={e => setFormItem(f => ({ ...f, categoria: e.target.value }))} style={inp}>
                    {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Tamanho</label>
                  <select value={formItem.tamanho} onChange={e => setFormItem(f => ({ ...f, tamanho: e.target.value }))} style={inp}>
                    <option value="">—</option>
                    {TAMANHOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Quantidade</label>
                  <input value={formItem.quantidade} onChange={e => setFormItem(f => ({ ...f, quantidade: e.target.value }))} type="number" min="1" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Valor (R$)</label>
                  <input value={formItem.valor} onChange={e => setFormItem(f => ({ ...f, valor: e.target.value }))} type="number" placeholder="Opcional" style={inp} />
                </div>
              </div>
              <div>
                <label style={lbl}>Descrição</label>
                <input value={formItem.descricao} onChange={e => setFormItem(f => ({ ...f, descricao: e.target.value }))} placeholder="Opcional" style={inp} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={() => setModalItem(false)} style={{ flex: 1, padding: "10px 0", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleSaveItem} disabled={saving} style={{ flex: 1, padding: "10px 0", background: "var(--gold)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Empréstimo */}
      {modalEmp && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 28, width: 440, maxWidth: "90vw" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 20 }}>Novo Empréstimo</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={lbl}>Item *</label>
                <select value={formEmp.itemId} onChange={e => setFormEmp(f => ({ ...f, itemId: e.target.value }))} style={inp}>
                  <option value="">— Selecione o item —</option>
                  {itens.filter(i => (i.quantidadeDisponivel || 0) > 0).map(i => (
                    <option key={i.id} value={i.id}>{i.nome} ({i.quantidadeDisponivel} disp.)</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Aluna *</label>
                <input value={alunaSearch} onChange={e => setAlunaSearch(e.target.value)} placeholder="Buscar aluna..." style={inp} />
                {alunaSearch && (
                  <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, marginTop: 4 }}>
                    {filteredAlunas.map(a => (
                      <div key={a.id} onClick={() => { setFormEmp(f => ({ ...f, alunaId: a.id })); setAlunaSearch(a.nome); }} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border)", background: formEmp.alunaId === a.id ? "rgba(180,155,90,0.1)" : "transparent" }}>
                        {a.nome}
                      </div>
                    ))}
                  </div>
                )}
                {formEmp.alunaId && !alunaSearch.length && (
                  <div style={{ fontSize: 11, color: "#16a34a", marginTop: 4 }}>✓ {getNomeAluna(formEmp.alunaId)}</div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Data Empréstimo</label>
                  <input value={formEmp.dataEmprestimo} onChange={e => setFormEmp(f => ({ ...f, dataEmprestimo: e.target.value }))} type="date" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Devolver até</label>
                  <input value={formEmp.dataDevolucaoPrevista} onChange={e => setFormEmp(f => ({ ...f, dataDevolucaoPrevista: e.target.value }))} type="date" style={inp} />
                </div>
              </div>
              <div>
                <label style={lbl}>Observação</label>
                <input value={formEmp.observacao} onChange={e => setFormEmp(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional" style={inp} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={() => setModalEmp(false)} style={{ flex: 1, padding: "10px 0", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleSaveEmp} disabled={saving} style={{ flex: 1, padding: "10px 0", background: "var(--gold)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
