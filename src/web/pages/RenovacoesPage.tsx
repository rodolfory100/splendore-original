import { useMemo, useState } from "react";
import { fmt, initials } from "../lib/api";
import { updateAluna } from "../lib/api";
import type { RenovacaoAluna } from "../types";

interface Props {
  renovacoes: RenovacaoAluna[];
  config: any;
  onRefresh: () => void;
  onToast: (msg: string, type?: "success"|"danger"|"gold") => void;
}

type Filtro = "todos"|"vencido"|"critico"|"atencao"|"aviso"|"ok"|"sem_contrato";

const urgenciaLabel: Record<string, { label: string; color: string; bg: string }> = {
  vencido:       { label: "🔴 Vencido", color: "#c0444e", bg: "rgba(192,68,78,0.08)" },
  critico:       { label: "🔴 Crítico", color: "#c0444e", bg: "rgba(192,68,78,0.08)" },
  atencao:       { label: "🟡 Atenção", color: "#b8702a", bg: "rgba(184,112,42,0.08)" },
  aviso:         { label: "🟢 Aviso", color: "#3a6fa8", bg: "rgba(58,111,168,0.08)" },
  ok:            { label: "✅ Em dia", color: "#3d7a72", bg: "rgba(61,122,114,0.08)" },
  sem_contrato:  { label: "⚠️ Sem contrato", color: "#a8998a", bg: "rgba(168,153,138,0.08)" },
};

export function RenovacoesPage({ renovacoes, config, onRefresh, onToast }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [renovandoId, setRenovandoId] = useState<string|null>(null);
  const [renovModal, setRenovModal] = useState<RenovacaoAluna|null>(null);

  const counts = useMemo(() => ({
    vencido: renovacoes.filter(r => r.urgencia === "vencido").length,
    critico: renovacoes.filter(r => r.urgencia === "critico").length,
    atencao: renovacoes.filter(r => r.urgencia === "atencao").length,
    aviso:   renovacoes.filter(r => r.urgencia === "aviso").length,
    ok:      renovacoes.filter(r => r.urgencia === "ok").length,
    sem_contrato: renovacoes.filter(r => r.urgencia === "sem_contrato").length,
  }), [renovacoes]);

  const filtered = useMemo(() =>
    filtro === "todos" ? renovacoes : renovacoes.filter(r => r.urgencia === filtro),
    [renovacoes, filtro]);

  const renovar = async (a: RenovacaoAluna) => {
    const hoje = new Date();
    const fimContrato = new Date(hoje.getFullYear() + 1, hoje.getMonth(), hoje.getDate());
    setRenovandoId(a.id);
    try {
      await updateAluna(a.id, {
        ...a,
        contratoDe: hoje.toISOString().split("T")[0],
        contratoAte: fimContrato.toISOString().split("T")[0],
      });
      onToast(`✦ Contrato de ${a.nome} renovado por +12 meses!`, "success");
      // WhatsApp
      const wpp = (a.whatsapp||'').replace(/\D/g,'');
      const escola = config?.escola || "Splendore";
      const msg = encodeURIComponent(`Olá, ${a.responsavel}! 🩰\n\nConfirmamos a *renovação do contrato* de ${a.nome} para ${hoje.getFullYear() + 1}! 🎉\n\n• Início: ${hoje.toLocaleDateString('pt-BR')}\n• Fim: ${fimContrato.toLocaleDateString('pt-BR')}\n• Mensalidade: ${fmt(a.valor)}/mês\n\nObrigada pela confiança! ✦\n*${escola}*`);
      if (wpp && confirm("Enviar confirmação por WhatsApp?")) {
        window.open(`https://wa.me/55${wpp}?text=${msg}`, '_blank');
      }
      onRefresh();
    } catch (e: any) {
      onToast(e.message, "danger");
    } finally {
      setRenovandoId(null);
    }
  };

  const avisar = (a: RenovacaoAluna) => {
    const wpp = (a.whatsapp||'').replace(/\D/g,'');
    const escola = config?.escola || "Splendore";
    const msg = a.diasRestantes !== null
      ? `Olá, ${a.responsavel}! 🩰\n\nPassando para lembrá-lo(a) que o contrato de *${a.nome}* vence em *${Math.abs(a.diasRestantes)} ${a.diasRestantes < 0 ? "dias atrás" : "dias"}*.\n\nPara renovar a matrícula, entre em contato conosco! 💛\n\n*${escola}*`
      : `Olá, ${a.responsavel}! 🩰\n\nIdentificamos que *${a.nome}* ainda não tem contrato registrado. Por favor, entre em contato para regularizar. 😊\n\n*${escola}*`;
    window.open(`https://wa.me/55${wpp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="animate-fade-up">
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
        {[
          { key: "vencido", label: "Vencidos", color: "#c0444e" as const },
          { key: "critico", label: "Crítico (≤30d)", color: "#c0444e" as const },
          { key: "atencao", label: "Atenção (31-60d)", color: "gold" as const },
          { key: "sem_contrato", label: "Sem Contrato", color: "sky" as const },
        ].map(({ key, label, color }) => (
          <div key={key} onClick={() => setFiltro(key as Filtro)} style={{ background: "#fff", border: `1px solid ${filtro === key ? "rgba(184,146,58,0.4)" : "rgba(180,155,90,0.18)"}`, borderRadius: 10, padding: "16px 18px", cursor: "pointer", transition: "all 0.15s" }}>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#a8998a", fontWeight: 600, marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 700, color: urgenciaLabel[key]?.color || "#1e1a16" }}>
              {counts[key as keyof typeof counts]}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {(["todos","vencido","critico","atencao","aviso","ok","sem_contrato"] as Filtro[]).map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
            background: filtro === f ? "#3d7a72" : "#f0ede6",
            color: filtro === f ? "#fff" : "#6b5f4e",
            border: "none",
          }}>
            {f === "todos" ? `Todas (${renovacoes.length})` : `${urgenciaLabel[f]?.label} (${counts[f as keyof typeof counts] ?? 0})`}
          </button>
        ))}
        <button onClick={() => { const criticas = renovacoes.filter(r => r.urgencia === "critico" || r.urgencia === "vencido"); criticas.forEach(a => avisar(a)); }} style={{ marginLeft: "auto", padding: "6px 14px", background: "#b8923a", border: "none", borderRadius: 20, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
          📱 Avisar críticas
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid rgba(180,155,90,0.18)", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 5px rgba(0,0,0,0.05)" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="splendore-table">
            <thead>
              <tr><th>Aluna</th><th>Modalidade</th><th>Início Contrato</th><th>Fim Contrato</th><th>Dias Restantes</th><th>Mensalidade</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const u = urgenciaLabel[a.urgencia] || urgenciaLabel.ok;
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(61,122,114,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#3d7a72", flexShrink: 0 }}>{initials(a.nome)}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{a.nome}</div>
                          <div style={{ fontSize: 11, color: "#a8998a" }}>{a.responsavel}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`chip chip-${a.modalidade === "Ballet" ? "ballet" : a.modalidade === "Jazz" ? "jazz" : a.modalidade === "Danças Urbanas" ? "urbanas" : "outro"}`}>{a.modalidade}</span></td>
                    <td style={{ fontSize: 12, color: "#a8998a" }}>{a.contratoDe ? a.contratoDe.split('-').reverse().join('/') : "—"}</td>
                    <td style={{ fontSize: 12, color: "#a8998a" }}>{a.contratoAte ? a.contratoAte.split('-').reverse().join('/') : "—"}</td>
                    <td>
                      <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: u.color, fontWeight: 700 }}>
                        {a.diasRestantes !== null ? (a.diasRestantes < 0 ? `${Math.abs(a.diasRestantes)}d atrás` : `${a.diasRestantes}d`) : "—"}
                      </span>
                    </td>
                    <td style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16 }}>{fmt(a.valor)}</td>
                    <td><span style={{ padding: "3px 9px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: u.bg, color: u.color }}>{u.label}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => renovar(a)} disabled={renovandoId === a.id} style={{ padding: "5px 11px", background: "#b8923a", border: "none", borderRadius: 5, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                          {renovandoId === a.id ? "..." : "↻ Renovar"}
                        </button>
                        <button onClick={() => avisar(a)} style={{ padding: "5px 11px", background: "#faf8f4", border: "1.5px solid rgba(180,155,90,0.25)", borderRadius: 5, color: "#6b5f4e", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                          📱 Avisar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#a8998a", fontSize: 13 }}>Nenhum resultado para este filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
