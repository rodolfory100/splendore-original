interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;         // hex color for top bar
  icon: React.ReactNode;
  iconBg: string;
  trend?: { value: string; up: boolean };
}

export function StatCard({ label, value, sub, accent, icon, iconBg, trend }: Props) {
  return (
    <div className="stat-card card-hover">
      <div className="stat-card-accent" style={{ background: accent }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        {trend && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 99, background: trend.up ? "#DCFCE7" : "#FEE2E2", color: trend.up ? "#16A34A" : "#DC2626" }}>
            {trend.up ? "↑" : "↓"} {trend.value}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", lineHeight: 1, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
