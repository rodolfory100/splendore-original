import { useState, useEffect } from "react";
import { getCameras, upsertCamera, updateCamera, desativarCamera, genId } from "../lib/api";

interface Props {
  onToast: (msg: string, type?: "success"|"danger"|"gold") => void;
}

const lbl: React.CSSProperties = {
  fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: "var(--text2)", fontWeight: 700,
};

const inp: React.CSSProperties = {
  background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 7,
  padding: "9px 12px", color: "var(--text)", fontSize: 13, fontFamily: "inherit", width: "100%",
};

export function CamerasPage({ onToast }: Props) {
  const [cameras, setCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState({ nome: "", url: "", snapshotUrl: "", local: "" });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  const load = async () => {
    try {
      const data = await getCameras();
      setCameras(data.filter((c: any) => c.ativa !== false));
    } catch { onToast("Erro ao carregar câmeras", "danger"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditId(null); setForm({ nome: "", url: "", snapshotUrl: "", local: "" }); setModal(true); };
  const openEdit = (cam: any) => { setEditId(cam.id); setForm({ nome: cam.nome, url: cam.url, snapshotUrl: cam.snapshotUrl || "", local: cam.local || "" }); setModal(true); };

  const handleSave = async () => {
    if (!form.nome || !form.url) { onToast("Nome e URL são obrigatórios", "danger"); return; }
    setSaving(true);
    try {
      if (editId) {
        await updateCamera(editId, form);
        onToast("Câmera atualizada!", "success");
      } else {
        await upsertCamera({ ...form, id: genId(), ativa: true });
        onToast("Câmera adicionada!", "success");
      }
      setModal(false); await load();
    } catch (e: any) { onToast(e.message, "danger"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (cam: any) => {
    if (!confirm(`Remover câmera "${cam.nome}"?`)) return;
    try {
      await desativarCamera(cam.id);
      onToast("Câmera removida", "success");
      await load();
    } catch (e: any) { onToast(e.message, "danger"); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>Carregando...</div>;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>📷 Câmeras</div>
          <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
            Gerencie os feeds de câmera da escola
          </div>
        </div>
        <button
          onClick={openNew}
          style={{ padding: "9px 18px", background: "var(--gold)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          + Adicionar Câmera
        </button>
      </div>

      {/* Grid de câmeras */}
      {cameras.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text2)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Nenhuma câmera cadastrada</div>
          <div style={{ fontSize: 12 }}>Adicione feeds de câmera (RTSP, HLS, IP Camera URL)</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {cameras.map(cam => (
            <div
              key={cam.id}
              style={{
                background: "var(--surface)", borderRadius: 12, border: "1.5px solid var(--border)",
                overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
              {/* Preview area */}
              <div
                style={{
                  height: 150, background: "#0e1a18", display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", position: "relative",
                }}
                onClick={() => setPreview(cam)}
              >
                {cam.url.includes('.m3u8') || cam.url.includes('http') ? (
                  <div style={{ textAlign: "center", color: "#d4af64" }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>▶</div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>Clique para ver feed</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "#888", textAlign: "center" }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>📷</div>
                    {cam.url.slice(0, 30)}...
                  </div>
                )}
              </div>
              {/* Info */}
              <div style={{ padding: "12px 14px" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 2 }}>{cam.nome}</div>
                {cam.local && <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 8 }}>{cam.local}</div>}
                <div style={{ fontSize: 10, color: "var(--text2)", wordBreak: "break-all", marginBottom: 10, opacity: 0.7 }}>
                  {cam.url.slice(0, 50)}{cam.url.length > 50 ? '...' : ''}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openEdit(cam)} style={{ flex: 1, padding: "6px 0", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "var(--text)" }}>
                    Editar
                  </button>
                  <button onClick={() => handleDelete(cam)} style={{ padding: "6px 10px", background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#dc2626" }}>
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal adicionar/editar */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 28, width: 420, maxWidth: "90vw" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 20 }}>
              {editId ? "Editar Câmera" : "Adicionar Câmera"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={lbl}>Nome da câmera *</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Sala Ballet 1" style={inp} />
              </div>
              <div>
                <label style={lbl}>URL do feed *</label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="rtsp://... ou http://..." style={inp} />
                <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 4 }}>RTSP, HLS (.m3u8), IP Camera URL, ou embed URL</div>
              </div>
              <div>
                <label style={lbl}>URL Snapshot (imagem estática)</label>
                <input value={form.snapshotUrl} onChange={e => setForm(f => ({ ...f, snapshotUrl: e.target.value }))} placeholder="http://camera-ip/snapshot.jpg" style={inp} />
                <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 4 }}>URL de imagem estática para refresh automático (opcional)</div>
              </div>
              <div>
                <label style={lbl}>Local / Descrição</label>
                <input value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} placeholder="Ex: Sala 1 — Ballet" style={inp} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={() => setModal(false)} style={{ flex: 1, padding: "10px 0", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "10px 0", background: "var(--gold)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setPreview(null)}>
          <div style={{ background: "#000", borderRadius: 12, overflow: "hidden", width: "80vw", maxWidth: 900 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "12px 16px", background: "#0e1a18", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#d4af64", fontWeight: 700 }}>{preview.nome}</span>
              <button onClick={() => setPreview(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              <iframe
                src={preview.url}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
