import { useState, useMemo } from "react";
import { fmt, mesAtual, nomeDoMes, initials } from "../lib/api";
import { deletePagamento } from "../lib/api";
import type { Pagamento, Aluna } from "../types";

interface Props {
  pagamentos: Pagamento[];
  alunas: Aluna[];
  config?: any;
  onRefresh: () => void;
  onToast: (msg: string, type?: "success"|"danger"|"gold") => void;
  onOpenPagamento: () => void;
}

export function PagamentosPage({ pagamentos, alunas, config, onRefresh, onToast, onOpenPagamento }: Props) {
  const [filtroMes, setFiltroMes] = useState("");
  const [busca, setBusca] = useState("");

  const sorted = useMemo(() => {
    let list = [...pagamentos].sort((a, b) => b.data?.localeCompare(a.data ?? '') ?? 0);
    if (filtroMes) list = list.filter(p => p.mes === filtroMes);
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter(p => {
        const a = alunas.find(x => x.id === p.alunaId);
        return a?.nome.toLowerCase().includes(q);
      });
    }
    return list;
  }, [pagamentos, filtroMes, busca]);

  const handleDelete = async (p: Pagamento) => {
    const a = alunas.find(x => x.id === p.alunaId);
    if (!confirm(`Desfazer baixa de ${a?.nome || ""}?\n\nEla voltará como inadimplente.`)) return;
    try {
      await deletePagamento(p.id);
      onToast(`↩ Baixa desfeita — ${a?.nome}`, "danger");
      onRefresh();
    } catch (e: any) {
      onToast(e.message, "danger");
    }
  };

  const totalMes = sorted.reduce((s, p) => s + (p.valor || 0), 0);

  return (
    <div className="animate-fade-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700 }}>
          Histórico de Pagamentos
          {totalMes > 0 && <span style={{ fontSize: 14, color: "#3d7a72", marginLeft: 12, fontWeight: 400 }}>{fmt(totalMes)}</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar aluna..."
            style={{ padding: "8px 12px", background: "#fff", border: "1.5px solid rgba(180,155,90,0.25)", borderRadius: 6, color: "#1e1a16", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", width: 180 }}
          />
          <input
            value={filtroMes}
            onChange={e => setFiltroMes(e.target.value)}
            type="month"
            style={{ padding: "8px 12px", background: "#fff", border: "1.5px solid rgba(180,155,90,0.25)", borderRadius: 6, color: "#1e1a16", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
          />
          <button onClick={onOpenPagamento} style={{ padding: "8px 18px", background: "#b8923a", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            + Registrar
          </button>
        </div>
      </div>

      <div style={{ background: "rgba(61,122,114,0.05)", border: "1px solid rgba(61,122,114,0.16)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#6b5f4e", display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <span>💡</span>
        <span>Quando um responsável enviar comprovante de Pix, registre aqui para dar baixa automática na inadimplência.</span>
      </div>

      <div style={{ background: "#fff", border: "1px solid rgba(180,155,90,0.18)", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 5px rgba(0,0,0,0.05)" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="splendore-table">
            <thead>
              <tr><th>Aluna</th><th>Mês Ref.</th><th>Data Pagto</th><th>Valor</th><th>Forma</th><th>Obs.</th><th></th></tr>
            </thead>
            <tbody>
              {sorted.map(p => {
                const a = alunas.find(x => x.id === p.alunaId);
                const wpp = a?.whatsapp?.replace(/\D/g,'');
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(61,122,114,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#3d7a72", flexShrink: 0 }}>
                          {a ? initials(a.nome) : "?"}
                        </div>
                        <span style={{ fontSize: 13 }}>{a ? a.nome : "Aluna removida"}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: "#a8998a" }}>{nomeDoMes(p.mes)}</td>
                    <td style={{ fontSize: 12, color: "#a8998a" }}>{p.data ? p.data.split('-').reverse().join('/') : "—"}</td>
                    <td style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, color: "#3d7a72" }}>{fmt(p.valor)}</td>
                    <td>
                      <span className="badge badge-gold" style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                        {p.forma || "Pix"}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "#a8998a" }}>{p.observacao || "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {wpp && (
                          <button
                            title="Enviar comprovante por WhatsApp"
                            onClick={() => {
                              const msg = encodeURIComponent(
                                `🩰 *COMPROVANTE DE PAGAMENTO*\n*${config?.escola || 'Hathor Escola de Dança'}*\n\n` +
                                `Aluna: *${a?.nome || '—'}*\n` +
                                `Responsável: ${a?.responsavel || '—'}\n` +
                                `Mês: *${nomeDoMes(p.mes)}*\n` +
                                `Data: ${p.data ? p.data.split('-').reverse().join('/') : '—'}\n` +
                                `Valor: *R$ ${p.valor.toFixed(2).replace('.',',')}*\n` +
                                `Forma: ${p.forma || 'Pix'}\n` +
                                `${p.observacao ? `Obs: ${p.observacao}\n` : ''}` +
                                `\n✓ Pagamento confirmado. Obrigada! 🌸`
                              );
                              window.open(`https://wa.me/55${wpp}?text=${msg}`, '_blank');
                            }}
                            style={{ padding: "4px 8px", background: "rgba(37,211,102,0.08)", border: "1.5px solid rgba(37,211,102,0.3)", borderRadius: 5, color: "#16a34a", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                          >📋 Comprovante</button>
                        )}
                        {wpp && (
                          <button
                            title="Reimprimir comprovante"
                            onClick={() => {
                              const html = `<html><head><title>Comprovante</title><style>body{font-family:Georgia,serif;max-width:400px;margin:40px auto;padding:20px;border:2px solid #b8923a;border-radius:8px}h2{color:#b8923a;text-align:center;font-size:18px;margin-bottom:4px}.sub{text-align:center;font-size:11px;color:#888;margin-bottom:20px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:13px}.label{color:#666}.value{font-weight:700}.total{font-size:20px;color:#3d7a72;font-weight:900;text-align:center;padding:16px 0}.footer{text-align:center;font-size:11px;color:#888;margin-top:16px}</style></head><body><h2>${config?.escola || 'Hathor Escola de Dança'}</h2><div class="sub">${config?.cidade || ''} ${config?.cnpj ? '· CNPJ: ' + config.cnpj : ''}</div><div class="row"><span class="label">Aluna</span><span class="value">${a?.nome || '—'}</span></div><div class="row"><span class="label">Responsável</span><span class="value">${a?.responsavel || '—'}</span></div><div class="row"><span class="label">Mês</span><span class="value">${nomeDoMes(p.mes)}</span></div><div class="row"><span class="label">Data</span><span class="value">${p.data ? p.data.split('-').reverse().join('/') : '—'}</span></div><div class="row"><span class="label">Forma</span><span class="value">${p.forma || 'Pix'}</span></div><div class="total">R$ ${p.valor.toFixed(2).replace('.',',')}</div><div class="footer">✓ Pagamento confirmado · ${new Date().toLocaleDateString('pt-BR')}</div></body></html>`;
                              const w = window.open('', '_blank', 'width=500,height=700');
                              if (w) { w.document.write(html); w.document.close(); w.print(); }
                            }}
                            style={{ padding: "4px 8px", background: "rgba(180,155,90,0.08)", border: "1.5px solid rgba(180,155,90,0.3)", borderRadius: 5, color: "#b8923a", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                          >🖨️ Reimprimir</button>
                        )}
                        <button
                          onClick={() => handleDelete(p)}
                          style={{ padding: "4px 8px", background: "rgba(192,68,78,0.07)", border: "1.5px solid rgba(192,68,78,0.2)", borderRadius: 5, color: "#c0444e", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                          title="Desfazer baixa"
                        >↩ Desfazer</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!sorted.length && (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#a8998a", fontSize: 13 }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, opacity: 0.2, marginBottom: 8 }}>◆</div>
                  Nenhum pagamento encontrado.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
