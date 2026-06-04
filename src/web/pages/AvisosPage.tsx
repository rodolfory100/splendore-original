import { useState } from "react";
import { saveAviso, deleteAviso } from "../lib/api";
import type { Aviso, Aluna } from "../types";

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

interface Props {
  avisos: Aviso[];
  alunas: Aluna[];
  config: any;
  onRefresh: () => void;
  onToast: (msg: string, type?: "success"|"danger"|"gold") => void;
}

export function AvisosPage({ avisos, alunas, config, onRefresh, onToast }: Props) {
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("geral");
  const [saving, setSaving] = useState(false);

  const handleSalvar = async () => {
    if (!texto.trim()) { onToast("Digite o aviso", "danger"); return; }
    setSaving(true);
    try {
      await saveAviso({ id: genId(), mensagem: texto.trim(), tipo });
      setTexto("");
      onToast("Aviso publicado!", "success");
      onRefresh();
    } catch (e: any) {
      onToast(e.message, "danger");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este aviso?")) return;
    try {
      await deleteAviso(id);
      onToast("Aviso removido.", "gold");
      onRefresh();
    } catch (e: any) {
      onToast(e.message, "danger");
    }
  };

  const enviarWhatsApp = (mensagem: string) => {
    const escola = config?.escola || "Splendore Escola de Dança";
    const wppEscola = (config?.whatsapp || '').replace(/\D/g,'');
    const msg = `📢 *Aviso — ${escola}*\n\n${mensagem}`;
    const url = wppEscola
      ? `https://wa.me/55${wppEscola}?text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const tipoLabel: Record<string, { icon: string; color: string; bg: string }> = {
    geral: { icon: "📢", color: "#6b5f4e", bg: "rgba(107,95,78,0.08)" },
    urgente: { icon: "🚨", color: "#c0444e", bg: "rgba(192,68,78,0.08)" },
    evento: { icon: "🎉", color: "#b8923a", bg: "rgba(184,146,58,0.08)" },
  };

  return (
    <div className="animate-fade-up" style={{ maxWidth: 720 }}>
      {/* Criar aviso */}
      <div style={{ background: "#fff", border: "1px solid rgba(180,155,90,0.18)", borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: "0 1px 5px rgba(0,0,0,0.05)" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Publicar Novo Aviso</div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#a8998a", fontWeight: 600, display: "block", marginBottom: 6 }}>Tipo</label>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(tipoLabel).map(([k, v]) => (
              <button key={k} onClick={() => setTipo(k)} style={{
                padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                background: tipo === k ? v.bg : "#f0ede6",
                color: tipo === k ? v.color : "#6b5f4e",
                fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                outline: tipo === k ? `1.5px solid ${v.color}40` : "none",
              }}>{v.icon} {k.charAt(0).toUpperCase()+k.slice(1)}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#a8998a", fontWeight: 600, display: "block", marginBottom: 6 }}>Mensagem</label>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={4}
            placeholder="Digite o aviso para as famílias..."
            style={{ width: "100%", background: "#faf8f4", border: "1.5px solid rgba(180,155,90,0.25)", borderRadius: 6, padding: "10px 12px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: "#1e1a16", outline: "none", resize: "vertical" }}
          />
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={() => enviarWhatsApp(texto)} style={{ padding: "9px 16px", background: "rgba(61,122,114,0.1)", border: "1.5px solid rgba(61,122,114,0.25)", borderRadius: 6, color: "#3d7a72", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            📱 Só WhatsApp
          </button>
          <button onClick={handleSalvar} disabled={saving} style={{ padding: "9px 20px", background: "#b8923a", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            {saving ? "Publicando..." : "Publicar Aviso"}
          </button>
        </div>
      </div>

      {/* Lista de avisos */}
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Avisos Publicados</div>
      {avisos.map(a => {
        const t = tipoLabel[a.tipo || "geral"] || tipoLabel.geral;
        const data = a.createdAt ? new Date(a.createdAt).toLocaleDateString('pt-BR') : "";
        return (
          <div key={a.id} style={{ background: "#fff", border: `1px solid ${t.color}22`, borderRadius: 10, padding: "16px 20px", marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                <span style={{ fontSize: 10, padding: "2px 8px", background: t.bg, color: t.color, borderRadius: 20, fontWeight: 600, letterSpacing: 0.5 }}>
                  {(a.tipo || "geral").toUpperCase()}
                </span>
                <span style={{ fontSize: 11, color: "#a8998a" }}>{data}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => enviarWhatsApp(a.mensagem)} style={{ padding: "4px 10px", background: "rgba(61,122,114,0.08)", border: "1px solid rgba(61,122,114,0.2)", borderRadius: 5, color: "#3d7a72", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>📱</button>
                <button onClick={() => handleDelete(a.id)} style={{ padding: "4px 10px", background: "rgba(192,68,78,0.07)", border: "1px solid rgba(192,68,78,0.2)", borderRadius: 5, color: "#c0444e", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>✕</button>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#6b5f4e", lineHeight: 1.6, whiteSpace: "pre-line" }}>{a.mensagem}</div>
          </div>
        );
      })}
      {!avisos.length && (
        <div style={{ textAlign: "center", padding: 40, color: "#a8998a", fontSize: 13 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, opacity: 0.2, marginBottom: 8 }}>📢</div>
          Nenhum aviso publicado ainda.
        </div>
      )}
    </div>
  );
}
