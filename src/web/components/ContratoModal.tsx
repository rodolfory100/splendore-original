import { useState } from "react";
import { fmt, mesAtual } from "../lib/api";
import type { Aluna } from "../types";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const FORMAS = ["Dinheiro","Pix","Cartão Débito","Cartão Crédito","Transferência","Boleto"];

interface Props {
  aluna: Aluna;
  onClose: () => void;
  onSuccess: () => void;
  onToast: (msg: string, type?: string) => void;
}

export function ContratoModal({ aluna, onClose, onSuccess, onToast }: Props) {
  const hoje = new Date();
  const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}`;
  const [mesInicio, setMesInicio] = useState(mesAtualStr);
  const [valorDesconto, setValorDesconto] = useState(String(aluna.valor || 160));
  const [valorCheio, setValorCheio] = useState(String((aluna as any).valorCheio || 180));
  const [diaVencimento, setDiaVencimento] = useState(aluna.vencimento || "10");
  const [formaPagamento1, setFormaPagamento1] = useState("Pix");
  const [salvando, setSalvando] = useState(false);

  const [ano, mesN] = mesInicio.split("-").map(Number);
  const parcelas = Array.from({length: 12}, (_, i) => {
    const d = new Date(ano, mesN - 1 + i, 1);
    return {
      num: i + 1,
      mes: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,
      nomeMes: MESES[d.getMonth()],
      ano: d.getFullYear(),
      pago: i === 0,
    };
  });

  const gerarContrato = async () => {
    setSalvando(true);
    try {
      const r = await fetch("/api/contratos/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("spl_token")}` },
        body: JSON.stringify({ alunaId: aluna.id, mesInicio, valorDesconto: parseFloat(valorDesconto), valorCheio: parseFloat(valorCheio), diaVencimento: parseInt(diaVencimento), formaPagamento1 })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      onToast(`Contrato gerado! 12 parcelas criadas para ${aluna.nome.split(" ")[0]}`, "success");
      onSuccess();
    } catch(e: any) {
      onToast(e.message, "danger");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 640 }}>
        <button onClick={onClose} style={{ position:"absolute", top:16, right:16, width:28, height:28, borderRadius:"50%", background:"var(--bg2)", border:"none", cursor:"pointer", fontSize:13 }}>✕</button>
        
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", letterSpacing: -0.3 }}>📋 Gerar Contrato</div>
          <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>{aluna.nome} — {aluna.modalidade}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 5 }}>Mês de Início</label>
            <select value={mesInicio} onChange={e => setMesInicio(e.target.value)}>
              {Array.from({length: 12}, (_, i) => {
                const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
                const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
                return <option key={val} value={val}>{MESES[d.getMonth()]} {d.getFullYear()}</option>;
              })}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 5 }}>Dia de Vencimento</label>
            <select value={diaVencimento} onChange={e => setDiaVencimento(e.target.value)}>
              {["5","10","15","20","25"].map(d => <option key={d} value={d}>Dia {d}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 5 }}>💰 Valor com Desconto (até o vencimento)</label>
            <input type="number" value={valorDesconto} onChange={e => setValorDesconto(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 5 }}>💸 Valor Cheio (após vencimento)</label>
            <input type="number" value={valorCheio} onChange={e => setValorCheio(e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 5 }}>Forma de Pagamento — 1ª Parcela (paga na hora)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FORMAS.map(f => (
              <button key={f} onClick={() => setFormaPagamento1(f)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: formaPagamento1 === f ? "var(--brand)" : "var(--bg2)", color: formaPagamento1 === f ? "#fff" : "var(--text2)", transition: "all 0.15s" }}>{f}</button>
            ))}
          </div>
        </div>

        <div style={{ background: "var(--bg)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", marginBottom: 10 }}>Parcelas que serão geradas:</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
            {parcelas.map(p => (
              <div key={p.num} style={{ background: p.pago ? "var(--green-bg)" : "var(--surface)", border: `1px solid ${p.pago ? "var(--green)" : "var(--border)"}`, borderRadius: 8, padding: "6px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: p.pago ? "var(--green)" : "var(--text3)" }}>{p.num}ª {p.pago ? "✓ PAGA" : ""}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>{p.nomeMes.slice(0,3)}/{p.ano.toString().slice(2)}</div>
                <div style={{ fontSize: 11, color: p.pago ? "var(--green)" : "var(--brand)", fontWeight: 700 }}>{fmt(p.pago ? parseFloat(valorDesconto||"0") : parseFloat(valorDesconto||"0"))}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 10, textAlign: "center" }}>
            Total do contrato: <strong style={{ color: "var(--text)" }}>{fmt(parseFloat(valorDesconto||"0") * 12)}</strong> · Valor cheio se atrasar: {fmt(parseFloat(valorCheio||"0"))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button onClick={gerarContrato} disabled={salvando} className="btn btn-primary" style={{ minWidth: 160 }}>
            {salvando ? "Gerando..." : "✓ Gerar Contrato (12 parcelas)"}
          </button>
        </div>
      </div>
    </div>
  );
}
