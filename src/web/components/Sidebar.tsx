import React from "react";

interface NavItem {
  id: string; label: string; icon: React.ReactNode;
  badge?: string | number; badgeColor?: string; badgeId?: string;
}
interface NavSection { section: string }
type NavEntry = NavItem | NavSection;

// SVG Icons inline
const Icons: Record<string, React.ReactNode> = {
  sparkles: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>,
  home: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  users: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  calendar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  bank: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>,
  credit: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>,
  chart: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>,
  refresh: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>,
  slash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" x2="19.07" y1="4.93" y2="19.07"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  megaphone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>,
  archive: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>,
  settings: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
  import: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>,
};

const NAV: NavEntry[] = [
  { section: "Principal" },
  { id: "ia_assistente", label: "IA Assistente", icon: Icons.sparkles, badge: "NOVO", badgeColor: "#C9A86A" },
  { id: "dashboard",    label: "Visão Geral",     icon: Icons.home },
  { section: "Alunos" },
  { id: "alunos",    label: "Alunas",          icon: Icons.users },
  { id: "turmas",    label: "Turmas & Horários", icon: Icons.calendar },
  { id: "presenca",  label: "Presença",         icon: Icons.check },
  { section: "Financeiro" },
  { id: "cobrancas",     label: "Cobranças WhatsApp", icon: Icons.bell,   badgeId: "badge-inad" },
  { id: "cobrancas_efi", label: "Boletos & Pix Efí",  icon: Icons.bank },
  { id: "mensalidades",  label: "Mensalidades",        icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg> },
  { id: "pagamentos",    label: "Pagamentos",         icon: Icons.credit },
  { id: "financeiro",    label: "Financeiro & DRE",   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, badge: "NOVO", badgeColor: "#16a34a" },
  { id: "relatorios",    label: "Relatórios",          icon: Icons.chart },
  { section: "Gestão" },
  { id: "renovacoes",  label: "Renovações",       icon: Icons.refresh, badgeId: "badge-renov" },
  { id: "suspensos",   label: "Sem Rematrícula",  icon: Icons.slash,   badgeId: "badge-susp" },
  { id: "avisos",      label: "Avisos em Massa",  icon: Icons.megaphone },
  { id: "arquivo_morto", label: "Arquivo Morto",  icon: Icons.archive },
  { id: "estoque", label: "Estoque & Fantasias", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>, badge: "NOVO", badgeColor: "#7c3aed" },
  { section: "Sistema" },
  { id: "cameras", label: "Câmeras", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg> },
  { id: "__monitor__", label: "Monitor de Câmeras", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.362a1 1 0 0 1-1.447.889L15 14"/><rect x="1" y="6" width="14" height="12" rx="2"/></svg>, badge: "NOVO", badgeColor: "#E8498A" },
  { id: "telegram",   label: "Bot Telegram",   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg> },
  { id: "importacao", label: "Importar Dados", icon: Icons.import },
  { id: "admin",      label: "Configurações",  icon: Icons.settings },
];

interface Props {
  currentPage: string;
  onNavigate: (page: string) => void;
  config: any;
  badges: Record<string, number>;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleMobile: () => void;
}

export function Sidebar({ currentPage, onNavigate, config, badges, mobileOpen, onToggleMobile }: Props) {
  const nome = config?.nomeAdmin || "Diretora";
  const escola = config?.escola || "Splendore";

  return (
    <>
      {mobileOpen && (
        <div
          onClick={onToggleMobile}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 90, backdropFilter: "blur(2px)" }}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        {/* Logo */}
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #C9A86A, #A88340)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>🩰</div>
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, color: "#F8FAFC", letterSpacing: 0.5 }}>
                Splendore
              </div>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: 1, textTransform: "uppercase", marginTop: 1 }}>
                Escola de Dança
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {NAV.map((item, i) => {
            if ("section" in item && !("id" in item)) {
              return (
                <div key={i} style={{ padding: "14px 10px 5px", fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#334155" }}>
                  {(item as any).section}
                </div>
              );
            }
            const nav = item as NavItem;
            const isActive = currentPage === nav.id || (nav.id === "__monitor__" && currentPage === "monitor");
            const badgeCount = nav.badgeId ? badges[nav.badgeId] : 0;

            return (
              <button
                key={nav.id}
                onClick={() => { if (nav.id === "__monitor__") { onNavigate("monitor"); } else { onNavigate(nav.id); } }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 10px", borderRadius: 8, border: "none",
                  cursor: "pointer", textAlign: "left",
                  background: isActive ? "rgba(201,168,106,0.15)" : "transparent",
                  color: isActive ? "#C9A86A" : "#94A3B8",
                  fontSize: 13, fontWeight: isActive ? 600 : 500,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  transition: "all 0.15s",
                  marginBottom: 1,
                }}
                onMouseEnter={e => { if (!isActive) { const el = e.currentTarget; el.style.background = "rgba(255,255,255,0.04)"; el.style.color = "#F1F5F9"; } }}
                onMouseLeave={e => { if (!isActive) { const el = e.currentTarget; el.style.background = "transparent"; el.style.color = "#94A3B8"; } }}
              >
                <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }}>{nav.icon}</span>
                <span style={{ flex: 1 }}>{nav.label}</span>
                {nav.badge && (
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, padding: "2px 6px", borderRadius: 4, background: nav.badgeColor || "#C9A86A", color: "#0F172A" }}>
                    {nav.badge}
                  </span>
                )}
                {badgeCount > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: "#DC2626", color: "#fff", minWidth: 20, textAlign: "center" }}>
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#C9A86A,#A88340)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#0F172A", flexShrink: 0 }}>
              {nome[0]?.toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#F1F5F9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</div>
              <div style={{ fontSize: 11, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{escola}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
