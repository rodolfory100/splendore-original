import { useState } from "react";
import { fmt, mesAtual, nomeDoMes } from "../lib/api";
import type { Inadimplente, Aluna } from "../types";

interface Props {
  alunas: Aluna[];
  inadimplentes: Inadimplente[];
  onToast: (msg: string, type?: string) => void;
}

const ESCOLA = {
  nome: "Ballet Splendore",
  cnpj: "32.934.664/0001-14",
  pix1: "65984743940",
  pix2: "balletsplendore@gmail.com",
  telefone: "65992283358",
  whatsapp: "5565992283358",
  responsavel: "Yasmin Mendonça Marques",
};

const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export function BoletosInternosPage({ alunas, inadimplentes, onToast }: Props) {
  const [busca, setBusca] = useState("");
  const [alunasel, setAlunasel] = useState<Aluna | null>(null);
  const [messel, setMessel] = useState(mesAtual());
  const [preview, setPreview] = useState(false);

  const hoje = new Date();
  const alunasFiltradas = alunas.filter(a =>
    !a.bolsista && a.ativo &&
    (busca === "" || a.nome.toLowerCase().includes(busca.toLowerCase()) || (a.responsavel||"").toLowerCase().includes(busca.toLowerCase()))
  );

  const [ano, mesN] = messel.split("-");
  const nomeMes = MESES_NOMES[parseInt(mesN) - 1];
  const vencimento = alunasel ? `${alunasel.vencimento || "10"}/${mesN}/${ano}` : "";

  const enviarWhatsApp = (aluna: Aluna) => {
    const wpp = (aluna.whatsapp || "").replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá, ${aluna.responsavel || aluna.nome}! 🌸\n\n` +
      `Segue o boleto de mensalidade da *Ballet Splendore*:\n\n` +
      `👩‍🎓 Aluna: *${aluna.nome}*\n` +
      `📅 Referência: *${nomeMes}/${ano}*\n` +
      `💰 Valor: *${fmt(aluna.valor || 0)}*\n` +
      `📆 Vencimento: *Dia ${aluna.vencimento || "10"}*\n\n` +
      `💳 *Formas de pagamento:*\n` +
      `• Pix: *${ESCOLA.pix1}* (Telefone)\n` +
      `• Pix: *${ESCOLA.pix2}* (Email)\n` +
      `• Pagamento presencial na escola\n\n` +
      `Em caso de dúvidas, entre em contato conosco.\n` +
      `Ballet Splendore 🩰\n` +
      `📞 ${ESCOLA.telefone}`
    );
    if (wpp) window.open(`https://wa.me/55${wpp}?text=${msg}`, "_blank");
    else onToast("WhatsApp não cadastrado para esta aluna", "danger");
  };

  const imprimirBoleto = (aluna: Aluna) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Boleto Interno — ${aluna.nome}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 20px; color: #1a1a1a; background: #fff; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #4F46E5; padding-bottom: 16px; margin-bottom: 20px; }
  .escola-nome { font-size: 24px; font-weight: 900; color: #4F46E5; letter-spacing: -0.5px; }
  .escola-sub { font-size: 12px; color: #666; margin-top: 2px; }
  .escola-info { text-align: right; font-size: 11px; color: #444; line-height: 1.6; }
  .title { font-size: 16px; font-weight: 700; color: #4F46E5; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .field { background: #F5F5FF; border-radius: 8px; padding: 10px 14px; }
  .field-label { font-size: 10px; font-weight: 700; color: #6B6999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .field-value { font-size: 14px; font-weight: 600; color: #1a1a1a; }
  .valor-box { background: #4F46E5; color: #fff; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
  .valor-label { font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px; }
  .valor-num { font-size: 32px; font-weight: 900; letter-spacing: -1px; }
  .pix-box { border: 2px solid #4F46E5; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px; }
  .pix-title { font-size: 13px; font-weight: 700; color: #4F46E5; margin-bottom: 8px; }
  .pix-row { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; border-bottom: 1px solid #eee; }
  .pix-row:last-child { border: none; }
  .pix-key { color: #666; }
  .pix-val { font-weight: 700; color: #1a1a1a; }
  .footer { border-top: 2px solid #eee; padding-top: 12px; font-size: 10px; color: #888; display: flex; justify-content: space-between; }
  .obs { background: #FEF3C7; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 11px; color: #92400E; }
  @media print { body { padding: 10px; } button { display: none; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="escola-nome">🩰 ${ESCOLA.nome}</div>
    <div class="escola-sub">Escola de Dança</div>
  </div>
  <div class="escola-info">
    CNPJ: ${ESCOLA.cnpj}<br>
    Tel: ${ESCOLA.telefone}<br>
    Resp: ${ESCOLA.responsavel}
  </div>
</div>

<div class="title">📋 Boleto de Mensalidade</div>

<div class="grid">
  <div class="field">
    <div class="field-label">Aluna</div>
    <div class="field-value">${aluna.nome}</div>
  </div>
  <div class="field">
    <div class="field-label">Responsável</div>
    <div class="field-value">${aluna.responsavel || aluna.nome}</div>
  </div>
  <div class="field">
    <div class="field-label">Modalidade</div>
    <div class="field-value">${aluna.modalidade} — ${aluna.nivel || ""}</div>
  </div>
  <div class="field">
    <div class="field-label">Referência</div>
    <div class="field-value">${nomeMes}/${ano}</div>
  </div>
  <div class="field">
    <div class="field-label">Vencimento</div>
    <div class="field-value">Dia ${aluna.vencimento || "10"}/${mesN}/${ano}</div>
  </div>
  <div class="field">
    <div class="field-label">Data de Emissão</div>
    <div class="field-value">${new Date().toLocaleDateString("pt-BR")}</div>
  </div>
</div>

<div class="valor-box">
  <div>
    <div class="valor-label">Valor da Mensalidade</div>
    <div style="font-size:11px; opacity:0.7; margin-top:4px">Referente a ${nomeMes}/${ano}</div>
  </div>
  <div class="valor-num">R$ ${(aluna.valor || 0).toFixed(2).replace(".", ",")}</div>
</div>

<div class="pix-box">
  <div class="pix-title">💳 Formas de Pagamento</div>
  <div class="pix-row"><span class="pix-key">Pix (Telefone)</span><span class="pix-val">${ESCOLA.pix1}</span></div>
  <div class="pix-row"><span class="pix-key">Pix (Email)</span><span class="pix-val">${ESCOLA.pix2}</span></div>
  <div class="pix-row"><span class="pix-key">Pagamento presencial</span><span class="pix-val">Na escola</span></div>
</div>

<div class="obs">
  ⚠️ Após o pagamento, envie o comprovante via WhatsApp: <strong>${ESCOLA.telefone}</strong>
</div>

<div style="text-align:center; margin-bottom:16px">
  <button onclick="window.print()" style="padding:12px 32px; background:#4F46E5; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">🖨️ Imprimir Boleto</button>
</div>

<div class="footer">
  <span>${ESCOLA.nome} — CNPJ ${ESCOLA.cnpj}</span>
  <span>Emitido em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</span>
</div>
</body>
</html>
    `);
    win.document.close();
    win.focus();
  };

  return (
    <div className="animate-fade-up">
      <div className="section-header">
        <div>
          <div className="section-title">Boletos Internos</div>
          <div className="section-sub">Gere recibos e envie por WhatsApp — sem integração bancária</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontSize: 12, color: "var(--text3)", fontWeight: 600 }}>Mês de referência:</label>
          <select value={messel} onChange={e => setMessel(e.target.value)} style={{ width: 160 }}>
            {Array.from({length: 12}, (_, i) => {
              const d = new Date(hoje.getFullYear(), i, 1);
              const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
              return <option key={val} value={val}>{MESES_NOMES[i]} {d.getFullYear()}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Info box */}
      <div style={{ background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)", border: "1px solid #C7D2FE", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ fontSize: 24 }}>📋</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#4F46E5", marginBottom: 4 }}>Boleto Interno — Sem código de barras</div>
          <div style={{ fontSize: 12, color: "#4C4A7A" }}>Gera um recibo com dados para pagamento via Pix ou presencial. Para boleto bancário com código de barras, use <strong>Boletos & Pix Efi</strong>.</div>
        </div>
      </div>

      {/* Busca */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <input
            placeholder="Buscar aluna ou responsável..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ maxWidth: 400 }}
          />
        </div>

        <table className="splendore-table">
          <thead>
            <tr>
              <th>Aluna</th>
              <th>Modalidade</th>
              <th>Mensalidade</th>
              <th>Vencimento</th>
              <th>WhatsApp</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {alunasFiltradas.slice(0, 50).map(a => (
              <tr key={a.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#6C63FF,#4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {a.nome.split(" ").map((n:string) => n[0]).slice(0,2).join("")}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{a.nome.split(" ").slice(0,3).join(" ")}</div>
                      <div style={{ fontSize: 10, color: "var(--text3)" }}>{a.responsavel}</div>
                    </div>
                  </div>
                </td>
                <td><span style={{ fontSize: 12 }}>{a.modalidade}</span></td>
                <td><span style={{ fontWeight: 700, color: "#4F46E5", fontSize: 14 }}>{fmt(a.valor || 0)}</span></td>
                <td><span style={{ fontSize: 12 }}>Dia {a.vencimento || "10"}</span></td>
                <td><span style={{ fontSize: 12, color: "var(--text3)" }}>{a.whatsapp || "—"}</span></td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => imprimirBoleto(a)}
                      style={{ padding: "5px 12px", background: "linear-gradient(135deg,#4F46E5,#6C63FF)", border: "none", borderRadius: 6, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                    >🖨️ Imprimir</button>
                    <button
                      onClick={() => enviarWhatsApp(a)}
                      style={{ padding: "5px 12px", background: "linear-gradient(135deg,#25D366,#128C7E)", border: "none", borderRadius: 6, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                    >💬 WhatsApp</button>
                  </div>
                </td>
              </tr>
            ))}
            {alunasFiltradas.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--text3)" }}>Nenhuma aluna encontrada</td></tr>
            )}
          </tbody>
        </table>
        {alunasFiltradas.length > 50 && (
          <div style={{ padding: "10px 16px", textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
            Mostrando 50 de {alunasFiltradas.length} alunas. Use a busca para filtrar.
          </div>
        )}
      </div>
    </div>
  );
}
