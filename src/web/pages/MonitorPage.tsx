import { useState, useEffect, useRef } from "react";
import { getCameras, getAlertas, resolverAlerta, addAlerta, genId } from "../lib/api";
import type { Aluna, Turma } from "../types";

interface Props {
  turmas: Turma[];
  alunas: Aluna[];
  onToast: (msg: string, type?: "success" | "danger" | "gold") => void;
}

export function MonitorPage({ turmas, alunas, onToast }: Props) {
  const [cameras, setCameras] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loadingCams, setLoadingCams] = useState(true);
  const [snapshotTick, setSnapshotTick] = useState(0);
  const [fullscreen, setFullscreen] = useState<any>(null);
  const pollingRef = useRef<any>(null);

  // Carrega câmeras
  useEffect(() => {
    getCameras()
      .then(data => setCameras(data.filter((c: any) => c.ativa !== false)))
      .catch(() => onToast("Erro ao carregar câmeras", "danger"))
      .finally(() => setLoadingCams(false));
  }, []);

  // Polling alertas a cada 5s
  const fetchAlertas = async () => {
    try {
      const data = await getAlertas(false);
      setAlertas(data);
    } catch { /* silencioso */ }
  };

  useEffect(() => {
    fetchAlertas();
    pollingRef.current = setInterval(fetchAlertas, 5000);
    return () => clearInterval(pollingRef.current);
  }, []);

  // Snapshot refresh a cada 3s
  useEffect(() => {
    const t = setInterval(() => setSnapshotTick(n => n + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const handleResolverAlerta = async (id: string) => {
    try {
      await resolverAlerta(id);
      setAlertas(prev => prev.filter(a => a.id !== id));
    } catch (e: any) { onToast(e.message, "danger"); }
  };

  const handleTestarAlerta = async () => {
    try {
      await addAlerta({ id: genId(), tipo: "geral", mensagem: "Teste de alerta do monitor — " + new Date().toLocaleTimeString("pt-BR") });
      await fetchAlertas();
      onToast("Alerta de teste criado", "gold");
    } catch (e: any) { onToast(e.message, "danger"); }
  };

  const tipoColor = (tipo: string) => {
    if (tipo === "pagamento") return "#ef4444";
    if (tipo === "presenca") return "#f59e0b";
    if (tipo === "contrato") return "#6366f1";
    return "#d4af64";
  };

  return (
    <div style={{ padding: "20px", minHeight: "calc(100vh - 80px)", background: "var(--bg)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>📷 Monitor</div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
              {cameras.length} câmera{cameras.length !== 1 ? "s" : ""} ·{" "}
              {alertas.length > 0
                ? <span style={{ color: "#ef4444", fontWeight: 700 }}>{alertas.length} alerta{alertas.length > 1 ? "s" : ""} ativo{alertas.length > 1 ? "s" : ""}</span>
                : <span style={{ color: "#16a34a" }}>sem alertas</span>}
            </div>
          </div>
          <button
            onClick={handleTestarAlerta}
            style={{ padding: "7px 14px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, cursor: "pointer", color: "var(--text2)" }}
          >
            Testar Alerta
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: alertas.length > 0 ? "1fr 320px" : "1fr", gap: 20, alignItems: "start" }}>

          {/* ── Grid câmeras ─────────────────────────────────── */}
          <div>
            {loadingCams ? (
              <div style={{ textAlign: "center", padding: 60, color: "var(--text2)" }}>Carregando câmeras...</div>
            ) : cameras.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text2)", background: "var(--surface)", borderRadius: 12, border: "1.5px solid var(--border)" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Nenhuma câmera configurada</div>
                <div style={{ fontSize: 12 }}>Vá em <strong>Câmeras</strong> no menu para cadastrar feeds</div>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: cameras.length === 1 ? "1fr" : cameras.length <= 2 ? "1fr 1fr" : "repeat(2, 1fr)",
                gap: 12,
              }}>
                {cameras.map(cam => (
                  <div
                    key={cam.id}
                    style={{
                      background: "#0a1412",
                      borderRadius: 10,
                      overflow: "hidden",
                      border: "1.5px solid #1a2e2a",
                      cursor: "pointer",
                      position: "relative",
                    }}
                    onClick={() => setFullscreen(cam)}
                  >
                    {/* Video/Snapshot */}
                    <div style={{ position: "relative", paddingBottom: "56.25%", background: "#050f0d" }}>
                      {cam.snapshotUrl ? (
                        <img
                          src={`${cam.snapshotUrl}?t=${snapshotTick}`}
                          alt={cam.nome}
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : cam.url ? (
                        <iframe
                          src={cam.url}
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                          allowFullScreen
                        />
                      ) : (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ textAlign: "center", color: "#d4af64" }}>
                            <div style={{ fontSize: 28 }}>📷</div>
                            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.6 }}>Sem feed</div>
                          </div>
                        </div>
                      )}
                      {/* Live badge */}
                      <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.7)", borderRadius: 4, padding: "2px 7px", fontSize: 10, color: "#ff4444", fontWeight: 700, letterSpacing: 1 }}>
                        ● LIVE
                      </div>
                      {/* Expand icon */}
                      <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", borderRadius: 4, padding: "3px 6px", fontSize: 11, color: "#fff" }}>⛶</div>
                    </div>
                    {/* Label */}
                    <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: "#e8e0d0" }}>{cam.nome}</div>
                        {cam.local && <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>{cam.local}</div>}
                      </div>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#16a34a", boxShadow: "0 0 6px #16a34a" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Painel de alertas ────────────────────────────── */}
          {alertas.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#ef4444", letterSpacing: 0.5 }}>
                  🔔 ALERTAS ({alertas.length})
                </div>
                <div style={{ fontSize: 10, color: "var(--text2)" }}>polling 5s</div>
              </div>
              <div style={{ maxHeight: 500, overflowY: "auto" }}>
                {alertas.map(a => (
                  <div key={a.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: `${tipoColor(a.tipo)}20`, color: tipoColor(a.tipo), textTransform: "uppercase", letterSpacing: 0.5 }}>
                            {a.tipo}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.4 }}>{a.mensagem}</div>
                        <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 3 }}>
                          {new Date(a.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <button
                        onClick={() => handleResolverAlerta(a.id)}
                        style={{ padding: "4px 8px", background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.3)", borderRadius: 5, fontSize: 11, color: "#16a34a", cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        ✓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setFullscreen(null)}
        >
          <div style={{ width: "90vw", maxWidth: 1100, background: "#000", borderRadius: 12, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "10px 16px", background: "#0a1412", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ color: "#d4af64", fontWeight: 700, fontSize: 14 }}>{fullscreen.nome}</span>
                {fullscreen.local && <span style={{ color: "#666", fontSize: 12, marginLeft: 8 }}>{fullscreen.local}</span>}
              </div>
              <button onClick={() => setFullscreen(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <div style={{ position: "relative", paddingBottom: "56.25%" }}>
              {fullscreen.snapshotUrl ? (
                <img
                  src={`${fullscreen.snapshotUrl}?t=${snapshotTick}`}
                  alt={fullscreen.nome}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <iframe
                  src={fullscreen.url}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                  allowFullScreen
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
