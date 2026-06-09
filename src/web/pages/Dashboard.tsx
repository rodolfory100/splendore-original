import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { fmt, mesAtual, initials, nomeDoMes } from "../lib/api";
import type { Aluna, Pagamento, Inadimplente } from "../types";

interface Props {
  alunas: Aluna[];
  pagamentos: Pagamento[];
  inadimplentes: Inadimplente[];
  onNavigate: (p: string) => void;
}

// Hook: número contando animado
function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(target * ease));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const Ic = {
  users:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  alert:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  check:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  bolt:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  heart:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  trend:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  target:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
};

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export function Dashboard({ alunas, pagamentos, inadimplentes, onNavigate }: Props) {
  const mes = mesAtual();
  const [ano, mesN] = mes.split("-");
  const nomeMes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][parseInt(mesN)-1];
  const hoje = new Date();

  const kpis = useMemo(() => {
    const pagantes  = alunas.filter(a => !(a as any).bolsista);
    const bolsistas = alunas.filter(a => (a as any).bolsista);
    const ativas    = alunas.filter(a => a.ativo && !a.suspenso);
    const suspensas = alunas.filter(a => a.suspenso);
    const mrr = pagantes.reduce((s, a) => s + (a.valor || 0), 0);
    const pagsReais = (p: Pagamento) => (p as any).status !== "pendente" && (p as any).status !== "atrasado" && (p as any).forma !== "Pendente";
    const recMes = pagamentos.filter(p => p.mes === mes && pagsReais(p)).reduce((s, p) => s + (p.valor || 0), 0);
    const mesAnt = (() => { const d = new Date(hoje.getFullYear(), hoje.getMonth()-1, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })();
    const recAnt = pagamentos.filter(p => p.mes === mesAnt && pagsReais(p)).reduce((s, p) => s + (p.valor || 0), 0);
    const momPct = recAnt > 0 ? Math.round(((recMes - recAnt) / recAnt) * 100) : 0;
    const taxa = pagantes.length ? Math.round(((pagantes.length - inadimplentes.length) / pagantes.length) * 100) : 100;
    const aReceber = inadimplentes.reduce((s, a) => s + (a.valor || 0), 0);
    const recAno = pagamentos.filter(p => (p.mes || "").startsWith(ano) && pagsReais(p)).reduce((s, p) => s + (p.valor || 0), 0);
    const ticket = (pagantes.length - inadimplentes.length) > 0 ? recMes / (pagantes.length - inadimplentes.length) : 0;
    const ltvMedio = ticket * 12;
    const hist3 = [0,1,2].map(i => { const d = new Date(hoje.getFullYear(), hoje.getMonth()-i, 1); const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; return pagamentos.filter(p => p.mes === m && pagsReais(p)).reduce((s,p) => s+(p.valor||0), 0); });
    const previsao = Math.round((hist3[0]*0.5 + hist3[1]*0.3 + hist3[2]*0.2) * 100) / 100;
    const meta = mrr;
    const pctMeta = meta > 0 ? Math.min(Math.round((recMes / meta) * 100), 100) : 0;
    return { total: alunas.length, ativas: ativas.length, pagantes: pagantes.length, bolsistas: bolsistas.length, suspensas: suspensas.length, mrr, recMes, recAnt, momPct, taxa, aReceber, recAno, ticket, ltvMedio, previsao, meta, pctMeta, inadimplentes: inadimplentes.length };
  }, [alunas, pagamentos, inadimplentes, mes, ano, hoje]);

  const alertas = useMemo(() => {
    const list: Array<{ nivel: "critico"|"atencao"|"info"; titulo: string; detalhe: string; acao?: string; label?: string }> = [];
    const dHoje = hoje.getDate();
    const vctoProximo = inadimplentes.filter(a => { const v = parseInt((a as any).vencimento || "10"); const diff = v - dHoje; return diff >= 0 && diff <= 2; });
    if (vctoProximo.length > 0) list.push({ nivel: "critico", titulo: `${vctoProximo.length} vencendo hoje/amanhã`, detalhe: vctoProximo.slice(0,3).map(a => a.nome.split(" ")[0]).join(", ") + (vctoProximo.length > 3 ? ` +${vctoProximo.length-3}` : ""), acao: "cobrancas", label: "Cobrar →" });
    const cronicos = inadimplentes.filter(a => ((a as any).quantidadeMeses || 1) >= 2);
    if (cronicos.length > 0) list.push({ nivel: "critico", titulo: `${cronicos.length} inadimplentes há 2+ meses`, detalhe: `Total acumulado: ${fmt(cronicos.reduce((s,a) => s+(a.valor||0)*((a as any).quantidadeMeses||1), 0))}`, acao: "cobrancas", label: "Ver →" });
    if (kpis.pctMeta < 50 && hoje.getDate() > 15) list.push({ nivel: "atencao", titulo: `Meta mensal em risco — ${kpis.pctMeta}% atingido`, detalhe: `Faltam ${fmt(kpis.meta - kpis.recMes)} para 100%`, acao: "cobrancas", label: "Cobrar →" });
    if (kpis.momPct < -10) list.push({ nivel: "atencao", titulo: `Receita caiu ${Math.abs(kpis.momPct)}% vs mês anterior`, detalhe: `${fmt(kpis.recAnt)} → ${fmt(kpis.recMes)}`, acao: "relatorios", label: "Analisar →" });
    if (kpis.suspensas > 0) list.push({ nivel: "info", titulo: `${kpis.suspensas} aluna${kpis.suspensas>1?"s":""} suspensa${kpis.suspensas>1?"s":""}`, detalhe: "Verificar situação e possível rematrícula", acao: "suspensos", label: "Ver →" });
    return list;
  }, [inadimplentes, kpis, hoje]);

  const churnRisk = useMemo(() => inadimplentes.filter(a => ((a as any).quantidadeMeses || 1) >= 2).slice(0, 5).map(a => ({ ...a, risco: ((a as any).quantidadeMeses || 1) >= 3 ? "alto" : "medio", meses: (a as any).quantidadeMeses || 1 })), [inadimplentes]);

  const historico = useMemo(() => Array.from({ length: 12 }, (_, i) => { const d = new Date(hoje.getFullYear(), hoje.getMonth() - 11 + i, 1); const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; const val = pagamentos.filter(p => p.mes === m && (p as any).status !== "pendente" && (p as any).forma !== "Pendente").reduce((s, p) => s + (p.valor || 0), 0); return { m, abrev: MESES[d.getMonth()], val, isCurrent: m === mes, isFuture: d > hoje }; }), [pagamentos, mes, hoje]);
  const maxVal = Math.max(...historico.map(h => h.val), kpis.previsao, 1);

  const modStats = useMemo(() => { const map: Record<string, { total: number; inad: number }> = {}; alunas.forEach(a => { if (!map[a.modalidade]) map[a.modalidade] = { total: 0, inad: 0 }; map[a.modalidade].total++; }); inadimplentes.forEach(a => { if (map[a.modalidade]) map[a.modalidade].inad++; }); return Object.entries(map).sort((a, b) => b[1].total - a[1].total); }, [alunas, inadimplentes]);

  const ultimosPags = useMemo(() => [...pagamentos].filter(p => (p as any).status !== "pendente" && (p as any).forma !== "Pendente").sort((a, b) => (b.data || "").localeCompare(a.data || "")).slice(0, 6), [pagamentos]);

  const modColors: Record<string, string> = { Ballet: "#C9A86A", Jazz: "#DC2626", "Danças Urbanas": "#2563EB", "Dança Contemporânea": "#7C3AED", "Dança do Ventre": "#D97706" };

  const healthScore = useMemo(() => { let score = 100; score -= Math.min(inadimplentes.length * 3, 30); const cronicos = inadimplentes.filter(a => ((a as any).quantidadeMeses || 1) >= 2).length; score -= Math.min(cronicos * 5, 25); if (kpis.momPct < -10) score -= 10; if (kpis.momPct < -20) score -= 10; if (kpis.pctMeta < 50) score -= 10; return Math.max(score, 0); }, [inadimplentes, kpis]);
  const healthColor = healthScore >= 80 ? "#16A34A" : healthScore >= 60 ? "#D97706" : "#DC2626";
  const healthLabel = healthScore >= 80 ? "Saudável" : healthScore >= 60 ? "Atenção" : "Crítico";

  const animMrr = useCountUp(kpis.mrr);
  const animRec = useCountUp(kpis.recMes);
  const animRec2 = useCountUp(kpis.aReceber);
  const animTotal = useCountUp(kpis.total);

  return (
    <motion.div variants={container} initial="hidden" animate="show">

      {/* HEADER */}
      <motion.div variants={fadeUp} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: -0.3 }}>Visão Geral</div>
          <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 3 }}>{nomeMes} {ano} · {kpis.ativas} ativas · {kpis.pagantes} pagantes · {kpis.bolsistas} bolsistas</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Health Score</div>
            <div style={{ fontSize: 11, color: healthColor, fontWeight: 700 }}>{healthLabel}</div>
          </div>
          <motion.div initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.8, ease: "easeOut" }} style={{ position: "relative", width: 52, height: 52 }}>
            <svg width="52" height="52" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="22" fill="none" stroke="var(--bg2)" strokeWidth="5"/>
              <motion.circle cx="26" cy="26" r="22" fill="none" stroke={healthColor} strokeWidth="5"
                strokeLinecap="round" transform="rotate(-90 26 26)"
                initial={{ strokeDasharray: "0 138.2" }}
                animate={{ strokeDasharray: `${(healthScore / 100) * 138.2} 138.2` }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: healthColor }}>{healthScore}</div>
          </motion.div>
        </div>
      </motion.div>

      {/* ALERTAS */}
      <AnimatePresence>
        {alertas.length > 0 && (
          <motion.div variants={fadeUp} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {alertas.map((a, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                style={{ background: a.nivel === "critico" ? "rgba(220,38,38,0.06)" : a.nivel === "atencao" ? "rgba(217,119,6,0.07)" : "rgba(37,99,235,0.06)", border: `1.5px solid ${a.nivel === "critico" ? "rgba(220,38,38,0.2)" : a.nivel === "atencao" ? "rgba(217,119,6,0.25)" : "rgba(37,99,235,0.2)"}`, borderRadius: 11, padding: "11px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 18, flexShrink: 0 }}>{a.nivel === "critico" ? "🔴" : a.nivel === "atencao" ? "⚠️" : "ℹ️"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: a.nivel === "critico" ? "var(--red)" : a.nivel === "atencao" ? "var(--amber)" : "var(--blue)" }}>{a.titulo}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>{a.detalhe}</div>
                </div>
                {a.acao && <button onClick={() => onNavigate(a.acao!)} className="btn btn-sm" style={{ background: "transparent", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", color: a.nivel === "critico" ? "var(--red)" : a.nivel === "atencao" ? "var(--amber)" : "var(--blue)", border: `1px solid ${a.nivel === "critico" ? "rgba(220,38,38,0.3)" : a.nivel === "atencao" ? "rgba(217,119,6,0.3)" : "rgba(37,99,235,0.3)"}` }}>{a.label}</button>}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI CARDS — com número animado */}
      <motion.div variants={fadeUp} style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 14 }}>
        <KpiCard label="MRR Potencial" value={fmt(animMrr)} sub={`${kpis.pagantes} pagantes`} color="#fff" bgColor="linear-gradient(135deg,#6C63FF,#4F46E5)" icon={Ic.bolt} trend={kpis.momPct} trendLabel="vs mês anterior" />
        <KpiCard label={`Recebido — ${nomeMes}`} value={fmt(animRec)} sub={`${kpis.pctMeta}% da meta`} color="#fff" bgColor="linear-gradient(135deg,#10B981,#059669)" icon={Ic.check} trend={kpis.momPct} trendLabel="crescimento MoM" />
        <KpiCard label="Em aberto" value={fmt(animRec2)} sub={`${kpis.inadimplentes} aluna${kpis.inadimplentes !== 1 ? "s" : ""} · taxa ${kpis.taxa}%`} color="#fff" bgColor={kpis.inadimplentes > 0 ? "linear-gradient(135deg,#EF4444,#DC2626)" : "linear-gradient(135deg,#10B981,#059669)"} icon={Ic.alert} />
        <KpiCard label="Total de Alunas" value={String(animTotal)} sub={`${kpis.ativas} ativas · ${kpis.bolsistas} bolsistas`} color="#fff" bgColor="linear-gradient(135deg,#3B82F6,#1D4ED8)" icon={Ic.users} />
      </motion.div>

      {/* SEGUNDA LINHA */}
      <motion.div variants={fadeUp} style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 14 }}>
        <div className="panel" style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Receita {ano}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#7C3AED", letterSpacing: -0.5 }}>{fmt(kpis.recAno)}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>Média {fmt(kpis.recAno / Math.max(hoje.getMonth() + 1, 1))}/mês</div>
        </div>
        <div className="panel" style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Meta Mensal</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: kpis.pctMeta >= 80 ? "var(--green)" : kpis.pctMeta >= 50 ? "var(--amber)" : "var(--red)", marginBottom: 6 }}>{kpis.pctMeta}%</div>
          <div style={{ height: 5, background: "var(--border)", borderRadius: 99, overflow: "hidden", marginBottom: 4 }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${kpis.pctMeta}%` }} transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
              style={{ height: "100%", background: kpis.pctMeta >= 80 ? "var(--green)" : kpis.pctMeta >= 50 ? "var(--amber)" : "var(--red)", borderRadius: 99 }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)" }}>{fmt(kpis.recMes)} / {fmt(kpis.meta)}</div>
        </div>
        <div className="panel" style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Previsão Próx. Mês</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#0891B2", letterSpacing: -0.5 }}>{fmt(kpis.previsao)}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>Baseado nos últimos 3 meses</div>
        </div>
        <div className="panel" style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>LTV Médio Est.</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#D97706", letterSpacing: -0.5 }}>{fmt(kpis.ltvMedio)}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>Ticket {fmt(kpis.ticket)} × 12m</div>
        </div>
      </motion.div>

      {/* GRÁFICO + CHURN */}
      <motion.div variants={fadeUp} style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
        <div className="panel">
          <div className="panel-header">
            <div><div className="panel-title">Receita — 12 Meses</div><div className="panel-sub">Realizado + previsão próximo mês</div></div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text3)" }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--gold)", display: "inline-block" }} /> Realizado</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text3)" }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#0891B2", display: "inline-block" }} /> Previsão</span>
            </div>
          </div>
          <div style={{ padding: "16px 16px 8px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 110 }}>
              {historico.map((h, idx) => {
                const isFuturePrev = idx === historico.length - 1 && h.val === 0 && kpis.previsao > 0;
                const displayVal = isFuturePrev ? kpis.previsao : h.val;
                const pct = Math.round((displayVal / maxVal) * 100);
                return (
                  <div key={h.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: h.isCurrent ? "var(--gold)" : isFuturePrev ? "#0891B2" : "var(--text3)", lineHeight: 1 }}>{displayVal > 0 ? `${(displayVal/1000).toFixed(1)}k` : ""}</div>
                    <div style={{ width: "100%", flex: 1, display: "flex", alignItems: "flex-end" }}>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(pct, 3)}%` }}
                        transition={{ duration: 0.6, delay: idx * 0.05, ease: "easeOut" }}
                        style={{ width: "100%", background: isFuturePrev ? "#0891B2" : h.isCurrent ? "linear-gradient(180deg,#C9A86A,#A88340)" : "linear-gradient(180deg,#E2E8F0,#CBD5E1)", borderRadius: "4px 4px 0 0", border: isFuturePrev ? "1.5px dashed #0891B2" : "none", opacity: isFuturePrev ? 0.7 : 1 }}
                      />
                    </div>
                    <div style={{ fontSize: 9, fontWeight: h.isCurrent ? 700 : 400, color: h.isCurrent ? "var(--gold)" : isFuturePrev ? "#0891B2" : "var(--text3)" }}>{h.abrev}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><div><div className="panel-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>{Ic.heart} <span>Risco de Churn</span></div><div className="panel-sub">Inadimplentes há 2+ meses</div></div></div>
          <div style={{ padding: "8px 0" }}>
            {churnRisk.length === 0 ? (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ padding: "24px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 13, color: "var(--text3)" }}>Nenhuma aluna em risco!</div>
              </motion.div>
            ) : churnRisk.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: a.risco === "alto" ? "var(--red-bg)" : "rgba(217,119,6,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: a.risco === "alto" ? "var(--red)" : "var(--amber)", flexShrink: 0 }}>{a.meses}m</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome.split(" ").slice(0,2).join(" ")}</div>
                  <div style={{ fontSize: 10, color: "var(--text3)" }}>{a.modalidade}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--red)" }}>{fmt((a as any).totalDebito || a.valor)}</div>
                  <button onClick={() => { const wpp = (a.whatsapp || "").replace(/\D/g,""); const msg = encodeURIComponent(`Olá, ${a.responsavel}! 🌸\n\nSentimos sua falta na Hathor! 🩰\n\nSua mensalidade está em aberto há ${a.meses} mese${a.meses>1?"s":""}. Podemos ajudar?\n\nTotal: *${fmt((a as any).totalDebito || a.valor)}*\n\nEntre em contato para regularizar 💛`); if (wpp) window.open(`https://wa.me/55${wpp}?text=${msg}`, "_blank"); }} style={{ fontSize: 10, background: "none", border: "none", cursor: "pointer", color: "#25D366", fontWeight: 700, padding: 0, marginTop: 2 }}>💬 Contatar</button>
                </div>
              </motion.div>
            ))}
            {churnRisk.length > 0 && <div style={{ padding: "8px 16px" }}><button onClick={() => onNavigate("cobrancas")} className="btn btn-sm" style={{ width: "100%", color: "var(--red)", background: "var(--red-bg)", border: "none", fontWeight: 700, fontSize: 12 }}>Ver todos os inadimplentes →</button></div>}
          </div>
        </div>
      </motion.div>

      {/* TERCEIRA LINHA */}
      <motion.div variants={fadeUp} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr", gap: 14, marginBottom: 14 }}>
        <div className="panel">
          <div className="panel-header"><div className="panel-title">Modalidades</div></div>
          <div style={{ padding: "12px 16px" }}>
            {modStats.map(([mod, stats], i) => {
              const pct = Math.round((stats.total / kpis.total) * 100);
              const color = modColors[mod] || "#64748B";
              const taxaMod = stats.total > 0 ? Math.round(((stats.total - stats.inad) / stats.total) * 100) : 100;
              return (
                <div key={mod} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{mod}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{stats.total}</span>
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: taxaMod >= 80 ? "var(--green-bg)" : "var(--red-bg)", color: taxaMod >= 80 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{taxaMod}%</span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: "var(--bg2)", borderRadius: 99, overflow: "hidden" }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.3 + i * 0.08, ease: "easeOut" }}
                      style={{ height: "100%", background: color, borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 6, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)" }}>ADIMPLÊNCIA GERAL</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: kpis.taxa >= 70 ? "var(--green)" : kpis.taxa >= 50 ? "var(--amber)" : "var(--red)" }}>{kpis.taxa}%</span>
              </div>
              <div style={{ height: 6, background: "var(--bg2)", borderRadius: 99, overflow: "hidden" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${kpis.taxa}%` }} transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
                  style={{ height: "100%", background: kpis.taxa >= 70 ? "var(--green)" : kpis.taxa >= 50 ? "var(--amber)" : "var(--red)", borderRadius: 99 }} />
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div><div className="panel-title">Últimos Pagamentos</div><div className="panel-sub">Confirmados recentemente</div></div>
            <button className="btn btn-sm btn-secondary" onClick={() => onNavigate("pagamentos")}>Ver todos →</button>
          </div>
          <table className="splendore-table">
            <thead><tr><th>Aluna</th><th>Mês</th><th>Forma</th><th>Valor</th></tr></thead>
            <tbody>
              {ultimosPags.map((p, i) => {
                const al = alunas.find(a => a.id === p.alunaId);
                return (
                  <motion.tr key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.05 }}>
                    <td><div style={{ display: "flex", alignItems: "center", gap: 7 }}><div className="avatar avatar-sm" style={{ background: "var(--green-bg)", color: "var(--green)", fontSize: 10, overflow: "hidden", padding: 0 }}>{al && (al as any).fotoUrl ? <img src={`/api/portal/foto/${al.id}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as any).style.display = "none"; }} /> : al ? initials(al.nome) : "?"}</div><span style={{ fontSize: 12, fontWeight: 600 }}>{al ? al.nome.split(" ")[0] : "—"}</span></div></td>
                    <td><span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 99, background: "var(--bg2)", color: "var(--text2)", fontWeight: 600 }}>{nomeDoMes(p.mes)}</span></td>
                    <td><span style={{ fontSize: 11, color: "var(--text3)" }}>{(p as any).forma || "Pix"}</span></td>
                    <td><span style={{ fontWeight: 700, color: "var(--green)", fontSize: 12 }}>{fmt(p.valor)}</span></td>
                  </motion.tr>
                );
              })}
              {!ultimosPags.length && <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--text3)", fontSize: 13 }}>Nenhum pagamento registrado</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-header"><div className="panel-title">Ações Rápidas</div></div>
          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
            {[
              { icon: "💰", label: "Registrar pagamento", sub: "Dar baixa manual", action: "pagamentos", color: "#16A34A" },
              { icon: "📱", label: "Cobrar inadimplentes", sub: `${kpis.inadimplentes} em aberto`, action: "cobrancas", color: "#DC2626" },
              { icon: "👤", label: "Nova aluna", sub: "Cadastrar aluna", action: "alunos", color: "#C9A86A" },
              { icon: "📊", label: "Ver relatórios", sub: "Financeiro detalhado", action: "relatorios", color: "#7C3AED" },
              { icon: "📋", label: "Mensalidades", sub: "Grid completo por aluna", action: "mensalidades", color: "#0891B2" },
              { icon: "🤖", label: "Assistente IA", sub: "Perguntar à IA", action: "ia_assistente", color: "#D97706" },
            ].map((item, i) => (
              <motion.button key={item.action} onClick={() => onNavigate(item.action)}
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }}
                whileHover={{ scale: 1.02, x: 3 }} whileTap={{ scale: 0.97 }}
                style={{ padding: "9px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--text2)", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <div>
                  <div>{item.label}</div>
                  <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 400, marginTop: 1 }}>{item.sub}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* INADIMPLENTES */}
      {inadimplentes.length > 0 && (
        <motion.div variants={fadeUp} className="panel">
          <div className="panel-header">
            <div><div className="panel-title">Inadimplentes — {nomeMes}</div><div className="panel-sub">{inadimplentes.length} alunas · {fmt(kpis.aReceber)} em aberto</div></div>
            <button className="btn btn-danger btn-sm" onClick={() => onNavigate("cobrancas")}>Cobrar todas →</button>
          </div>
          <table className="splendore-table">
            <thead><tr><th>Aluna</th><th>Modalidade</th><th>Atraso</th><th>Débito total</th><th>Ação</th></tr></thead>
            <tbody>
              {inadimplentes.slice(0, 8).map((a, i) => (
                <motion.tr key={a.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.04 }}>
                  <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div className="avatar avatar-sm" style={{ background: "var(--red-bg)", color: "var(--red)", fontSize: 10, overflow: "hidden", padding: 0 }}>{(a as any).fotoUrl ? <img src={`/api/portal/foto/${a.id}`} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => { (e.target as any).style.display = "none"; }} /> : initials(a.nome)}</div><div><div style={{ fontSize: 13, fontWeight: 600 }}>{a.nome.split(" ").slice(0,2).join(" ")}</div><div style={{ fontSize: 10, color: "var(--text3)" }}>Vcto dia {(a as any).vencimento || 10}</div></div></div></td>
                  <td><span style={{ fontSize: 12 }}>{a.modalidade}</span></td>
                  <td><span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, fontWeight: 700, background: ((a as any).quantidadeMeses || 1) >= 2 ? "var(--red-bg)" : "rgba(217,119,6,0.1)", color: ((a as any).quantidadeMeses || 1) >= 2 ? "var(--red)" : "var(--amber)" }}>{(a as any).quantidadeMeses || 1} {(a as any).quantidadeMeses === 1 ? "mês" : "meses"}</span></td>
                  <td><span style={{ fontWeight: 700, color: "var(--red)", fontSize: 13 }}>{fmt((a as any).totalDebito || a.valor)}</span></td>
                  <td><div style={{ display: "flex", gap: 5 }}><button className="btn btn-xs" style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#16A34A" }} onClick={() => { const wpp = (a.whatsapp || "").replace(/\D/g,""); const msg = encodeURIComponent(`Olá, ${a.responsavel}! 🌸\n\nPassando para lembrar que a mensalidade de *${a.nome}* está em aberto.\n💰 Valor: *${fmt(a.valor)}*\n\nHathor Escola de Dança 🩰`); if (wpp) window.open(`https://wa.me/55${wpp}?text=${msg}`, "_blank"); }}>📱</button><button className="btn btn-xs btn-secondary" onClick={() => onNavigate("mensalidades")}>Ver</button></div></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {inadimplentes.length > 8 && <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", textAlign: "center" }}><button className="btn btn-ghost btn-sm" onClick={() => onNavigate("cobrancas")} style={{ color: "var(--gold-dark)", fontWeight: 700 }}>+ {inadimplentes.length - 8} mais → Ver todas as cobranças</button></div>}
        </motion.div>
      )}
    </motion.div>
  );
}

function KpiCard({ label, value, sub, color, icon, trend, trendLabel, bgColor }: { label: string; value: string; sub: string; color: string; icon: React.ReactNode; trend?: number; trendLabel?: string; bgColor?: string }) {
  const trendPositive = (trend ?? 0) >= 0;
  const isColored = !!bgColor;
  return (
    <motion.div variants={fadeUp} whileHover={{ y: -3, scale: 1.01, transition: { duration: 0.15 } }}
      style={{
        padding: "18px 20px", cursor: "default",
        background: bgColor || "var(--surface)",
        borderRadius: "var(--r-lg)",
        border: isColored ? "none" : "1px solid var(--border)",
        boxShadow: isColored ? `0 8px 24px ${bgColor}55` : "var(--shadow-sm)",
        position: "relative", overflow: "hidden",
      }}>
      {isColored && (
        <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: isColored ? "rgba(255,255,255,0.75)" : "var(--text3)", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: isColored ? "rgba(255,255,255,0.2)" : `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: isColored ? "#fff" : color, flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: isColored ? "#fff" : "var(--text)", letterSpacing: -0.8, marginBottom: 6 }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, color: isColored ? "rgba(255,255,255,0.7)" : "var(--text3)" }}>{sub}</div>
        {trend !== undefined && (
          <div style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 11, fontWeight: 700,
            color: isColored ? "#fff" : (trendPositive ? "var(--green)" : "var(--red)"),
            background: isColored ? "rgba(255,255,255,0.2)" : (trendPositive ? "var(--green-bg)" : "var(--red-bg)"),
            padding: "2px 7px", borderRadius: 99 }}>
            {trendPositive ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"/></svg> : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      {trendLabel && trend !== undefined && <div style={{ fontSize: 9, color: isColored ? "rgba(255,255,255,0.6)" : "var(--text3)", marginTop: 2 }}>{trendLabel}</div>}
    </motion.div>
  );
}
