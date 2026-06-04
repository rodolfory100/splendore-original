import { useEffect, useState } from "react";

export interface ToastMsg { id: string; msg: string; type?: "success" | "danger" | "gold"; }

export function ToastContainer({ toasts, onRemove }: { toasts: ToastMsg[]; onRemove: (id: string) => void }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 999, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={onRemove} />)}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: ToastMsg; onRemove: (id: string) => void }) {
  const [vis, setVis] = useState(false);
  useEffect(() => {
    setTimeout(() => setVis(true), 10);
    const t = setTimeout(() => { setVis(false); setTimeout(() => onRemove(toast.id), 300); }, 3200);
    return () => clearTimeout(t);
  }, []);

  const icons: Record<string, string> = { success: "✓", danger: "✕", gold: "✦" };
  const colors: Record<string, string> = { success: "#16A34A", danger: "#DC2626", gold: "#C9A86A" };
  const type = toast.type || "gold";

  return (
    <div className={`toast toast-${type}`} style={{
      transform: vis ? "translateX(0)" : "translateX(120%)",
      opacity: vis ? 1 : 0,
    }}>
      <span style={{ color: colors[type], fontWeight: 700, fontSize: 15 }}>{icons[type]}</span>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{toast.msg}</span>
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const show = (msg: string, type: "success" | "danger" | "gold" = "gold") => {
    const id = Date.now().toString();
    setToasts(p => [...p, { id, msg, type }]);
  };
  const remove = (id: string) => setToasts(p => p.filter(t => t.id !== id));
  return { toasts, show, remove };
}
