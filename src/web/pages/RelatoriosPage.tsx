import { useMemo, useState, useCallback, useEffect } from "react";
import { fmt, mesAtual, getRelatorioFinanceiro, getAnalytics } from "../lib/api";
import type { Aluna, Pagamento, Inadimplente } from "../types";

interface Props {
  alunas: Aluna[];
  pagamentos: Pagamento[];
  inadimplentes: Inadimplente[];
  config: any;
}

const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

type Aba = 'executivo' | 'financeiro' | 'alunas' | 'modalidades';

export function RelatoriosPage({ alunas, pagamentos, inadimplentes, config }: Props) {
  const mes = mesAtual();
  const [aba, setAba] = useState<Aba>('executivo');
  const [mesSel, setMesSel] = useState(mes);
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();

  const nomeMes = useCallback((m: string) => {
    const [y, mn] = m.split('-');
    return (MESES_FULL[parseInt(mn)-1] || mn) + '/' + y;
  }, []);

  useEffect(() => {
    setLoading(true);
    getAnalytics()
      .then(d => setAnalytics(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Dados locais calculados ─────────────────────────────────────────────
  const pagsReais = (p: Pagamento) =>
    (p as any).status !== 'pendente' &&
    (p as any).status !== 'atrasado' &&
    (p as any).forma !== 'Pendente';

  const stats = useMemo(() => {
    const pagsMes = pagamentos.filter(p => p.mes === mesSel && pagsReais(p));
    const rec = pagsMes.reduce((s, p) => s + (p.valor || 0), 0);
    const bolsistas = alunas.filter(a => (a as any).bolsista);
    const pagantes = alunas.filter(a => !(a as any).bolsista);
    const pot = pagantes.reduce((s, a) => s + (a.valor || 0), 0);
    const inad = inadimplentes.reduce((s, a) => s + (a.valor || 0), 0);
    const taxa = pagantes.length ? Math.round(((pagantes.length - inadimplentes.length) / pagantes.length) * 100) : 0;
    const mesAnt = (() => { const d = new Date(hoje.getFullYear(), hoje.getMonth()-1, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })();
    const recAnt = pagamentos.filter(p => p.mes === mesAnt && pagsReais(p)).reduce((s,p) => s+(p.valor||0), 0);
    const mom = recAnt > 0 ? Math.round(((rec - recAnt) / recAnt) * 100) : 0;
    const recAno = pagamentos.filter(p => (p.mes||'').startsWith(String(anoAtual)) && pagsReais(p)).reduce((s,p) => s+(p.valor||0), 0);
    const ticket = pagsMes.length > 0 ? rec / pagsMes.length : 0;
    return { rec, pot, inad, taxa, mom, recAno, ticket, bolsistas: bolsistas.length, pagantes: pagantes.length, pagsMes };
  }, [pagamentos, alunas, inadimplentes, mesSel, hoje, anoAtual]);

  // Histórico 12 meses
  const historico12 = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(anoAtual, i, 1);
    const m = `${anoAtual}-${String(i+1).padStart(2,'0')}`;
    const val = pagamentos.filter(p => p.mes === m && pagsReais(p)).reduce((s,p)=>s+(p.valor||0),0);
    return { mes: m, abrev: MESES_ABREV[i], val, isCurrent: m === mes };
  }), [pagamentos, anoAtual, mes]);
  const maxBar = Math.max(...historico12.map(h => h.val), 1);

  // Por modalidade
  const modStats = useMemo(() => {
    const map: Record<string, { alunas: number; pagou: number; inad: number; receita: number }> = {};
    alunas.forEach(a => {
      if (!(a as any).bolsista) {
        if (!map[a.modalidade]) map[a.modalidade] = { alunas: 0, pagou: 0, inad: 0, receita: 0 };
        map[a.modalidade].alunas++;
      }
    });
    const pagsMes = pagamentos.filter(p => p.mes === mesSel && pagsReais(p));
    pagsMes.forEach(p => {
      const al = alunas.find(a => a.id === p.alunaId);
      if (al && !(al as any).bolsista && map[al.modalidade]) {
        map[al.modalidade].pagou++;
        map[al.modalidade].receita += p.valor || 0;
      }
    });
    inadimplentes.forEach(a => {
      if (map[a.modalidade]) map[a.modalidade].inad++;
    });
    return Object.entries(map).sort((a, b) => b[1].receita - a[1].receita);
  }, [alunas, pagamentos, inadimplentes, mesSel]);

  // Top alunas pagadoras
  const topAlunas = useMemo(() => {
    const totais: Record<string, number> = {};
    pagamentos.filter(p => (p.mes||'').startsWith(String(anoAtual)) && pagsReais(p)).forEach(p => {
      totais[p.alunaId] = (totais[p.alunaId] || 0) + (p.valor || 0);
    });
    return Object.entries(totais)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, total]) => ({ aluna: alunas.find(a => a.id === id), total }))
      .filter(x => x.aluna);
  }, [pagamentos, alunas, anoAtual]);

  // Formas de pagamento
  const formasDist = useMemo(() => {
    const dist: Record<string, { qtd: number; valor: number }> = {};
    pagamentos.filter(p => p.mes === mesSel && pagsReais(p)).forEach(p => {
      const f = (p as any).forma || 'Pix';
      if (!dist[f]) dist[f] = { qtd: 0, valor: 0 };
      dist[f].qtd++;
      dist[f].valor += p.valor || 0;
    });
    return Object.entries(dist).sort((a, b) => b[1].valor - a[1].valor);
  }, [pagamentos, mesSel]);

  const imprimir = () => window.print();

  const ABA_ITEMS: { id: Aba; label: string }[] = [
    { id: 'executivo', label: '📊 Executivo' },
    { id: 'financeiro', label: '💰 Financeiro' },
    { id: 'alunas', label: '👥 Alunas' },
    { id: 'modalidades', label: '🎭 Modalidades' },
  ];

  const modColors: Record<string, string> = {
    Ballet: '#C9A86A', Jazz: '#DC2626', 'Danças Urbanas': '#2563EB',
    'Dança Contemporânea': '#7C3AED', 'Dança do Ventre': '#D97706',
  };

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Relatórios</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>Análise completa · {anoAtual}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={mesSel} onChange={e => setMesSel(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)', outline: 'none', cursor: 'pointer' }}>
            {Array.from({ length: 12 }, (_, i) => {
              const m = `${anoAtual}-${String(i+1).padStart(2,'0')}`;
              return <option key={m} value={m}>{MESES_FULL[i]} {anoAtual}</option>;
            })}
          </select>
          <button onClick={imprimir} className="btn btn-secondary btn-sm">🖨️ Imprimir</button>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
        {ABA_ITEMS.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{
            padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: aba === a.id ? 700 : 500,
            color: aba === a.id ? 'var(--gold-dark)' : 'var(--text3)',
            fontFamily: 'inherit',
            borderBottom: aba === a.id ? '2px solid var(--gold)' : '2px solid transparent',
            marginBottom: -2,
            transition: 'all 0.15s',
          }}>{a.label}</button>
        ))}
      </div>

      {/* ── ABA EXECUTIVO ───────────────────────────────────────────────── */}
      {aba === 'executivo' && (
        <div>
          {/* KPIs resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'Receita Ano', value: fmt(stats.recAno), sub: `${hoje.getMonth()+1} meses`, color: '#7C3AED' },
              { label: `Recebido ${nomeMes(mesSel).split('/')[0]}`, value: fmt(stats.rec), sub: `${stats.taxa}% adimplência`, color: '#16A34A' },
              { label: 'MRR Potencial', value: fmt(stats.pot), sub: `${stats.pagantes} pagantes`, color: '#C9A86A' },
              { label: 'Em Aberto', value: fmt(stats.inad), sub: `${inadimplentes.length} inadimplentes`, color: '#DC2626' },
            ].map(k => (
              <div key={k.label} className="panel" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: k.color, letterSpacing: -0.5 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Gráfico receita anual */}
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header">
              <div>
                <div className="panel-title">Receita Mensal — {anoAtual}</div>
                <div className="panel-sub">Total recebido por mês</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold-dark)' }}>
                Total: {fmt(stats.recAno)}
              </div>
            </div>
            <div style={{ padding: '20px 20px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
                {historico12.map(h => {
                  const pct = Math.round((h.val / maxBar) * 100);
                  return (
                    <div key={h.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: h.isCurrent ? 'var(--gold-dark)' : 'var(--text3)', lineHeight: 1 }}>
                        {h.val > 0 ? `${(h.val/1000).toFixed(1)}k` : ''}
                      </div>
                      <div style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
                        <div style={{
                          width: '100%', minHeight: 4, borderRadius: '4px 4px 0 0',
                          height: `${Math.max(pct, 3)}%`,
                          background: h.isCurrent ? 'linear-gradient(180deg,#C9A86A,#A88340)' : 'linear-gradient(180deg,#E2E8F0,#CBD5E1)',
                          transition: 'height 0.6s',
                        }} />
                      </div>
                      <div style={{ fontSize: 10, fontWeight: h.isCurrent ? 700 : 400, color: h.isCurrent ? 'var(--gold-dark)' : 'var(--text3)' }}>{h.abrev}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Analytics da API (se disponível) */}
          {analytics && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div className="panel" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Indicadores Avançados</div>
                {[
                  { label: 'Ticket Médio', value: fmt(analytics.financeiro?.ticket || 0) },
                  { label: 'LTV Médio (12m)', value: fmt(analytics.financeiro?.ltvMedio || 0) },
                  { label: 'Previsão Próx. Mês', value: fmt(analytics.financeiro?.previsao || 0) },
                  { label: 'Crescimento MoM', value: `${analytics.financeiro?.momPct >= 0 ? '+' : ''}${analytics.financeiro?.momPct || 0}%` },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>{item.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="panel" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Retenção & Churn</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>Taxa de Retenção</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: (analytics.retencao || 0) >= 80 ? 'var(--green)' : 'var(--amber)' }}>{analytics.retencao || 0}%</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${analytics.retencao || 0}%`, background: (analytics.retencao || 0) >= 80 ? 'var(--green)' : 'var(--amber)', borderRadius: 99 }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>Adimplência</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: (analytics.snapshot?.taxa || 0) >= 70 ? 'var(--green)' : 'var(--amber)' }}>{analytics.snapshot?.taxa || 0}%</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${analytics.snapshot?.taxa || 0}%`, background: (analytics.snapshot?.taxa || 0) >= 70 ? 'var(--green)' : 'var(--amber)', borderRadius: 99 }} />
                    </div>
                  </div>
                  <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Risco de Churn</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: (analytics.churnRisk || 0) > 3 ? 'var(--red)' : (analytics.churnRisk || 0) > 0 ? 'var(--amber)' : 'var(--green)' }}>
                      {analytics.churnRisk || 0} alunas
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>devendo 2+ meses</div>
                  </div>
                </div>
              </div>
              <div className="panel" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Formas de Pagamento</div>
                {Object.entries(analytics.formasDist || {}).length === 0
                  ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Sem dados deste mês</div>
                  : Object.entries(analytics.formasDist || {}).map(([f, qtd]: any) => {
                    const total = Object.values(analytics.formasDist || {}).reduce((s: any, v: any) => s+v, 0) as number;
                    const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;
                    return (
                      <div key={f} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12 }}>{f}</span>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{qtd}x · {pct}%</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)', borderRadius: 99 }} />
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          )}

          {/* Formas de pagamento locais */}
          {formasDist.length > 0 && !analytics && (
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel-header"><div className="panel-title">Formas de Pagamento — {nomeMes(mesSel)}</div></div>
              <div style={{ padding: '12px 16px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {formasDist.map(([f, { qtd, valor }]) => (
                  <div key={f} style={{ flex: 1, minWidth: 120, background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{f}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold-dark)' }}>{fmt(valor)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{qtd} pagamento{qtd !== 1 ? 's' : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ABA FINANCEIRO ──────────────────────────────────────────────── */}
      {aba === 'financeiro' && (
        <div>
          {/* Resumo do mês */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div className="panel" style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Resumo — {nomeMes(mesSel)}</div>
              {[
                { label: 'Potencial (MRR)', value: fmt(stats.pot), color: 'var(--text)' },
                { label: 'Recebido', value: fmt(stats.rec), color: 'var(--green)' },
                { label: 'Em aberto', value: fmt(stats.inad), color: 'var(--red)' },
                { label: 'Adimplência', value: `${stats.taxa}%`, color: stats.taxa >= 70 ? 'var(--green)' : stats.taxa >= 50 ? 'var(--amber)' : 'var(--red)' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text3)' }}>{item.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
            <div className="panel" style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Distribuição</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12 }}>Recebido</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>{stats.taxa}%</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg2)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${stats.taxa}%`, background: 'var(--green)', borderRadius: 99, transition: 'width 0.8s' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12 }}>Pendente</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>{100 - stats.taxa}%</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg2)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${100 - stats.taxa}%`, background: 'var(--red)', borderRadius: 99, transition: 'width 0.8s' }} />
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ticket Médio do Mês</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--gold-dark)' }}>{fmt(stats.ticket)}</div>
              </div>
            </div>
            <div className="panel" style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Comparação MoM</div>
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: stats.mom >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {stats.mom >= 0 ? '+' : ''}{stats.mom}%
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>vs mês anterior</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>{fmt(stats.rec)}</div>
              </div>
            </div>
          </div>

          {/* Pagamentos do mês */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Pagamentos Confirmados — {nomeMes(mesSel)}</div>
                <div className="panel-sub">{stats.pagsMes.length} pagamentos · {fmt(stats.rec)}</div>
              </div>
            </div>
            <table className="splendore-table">
              <thead><tr><th>Aluna</th><th>Modalidade</th><th>Data</th><th>Forma</th><th>Valor</th></tr></thead>
              <tbody>
                {stats.pagsMes.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13 }}>Nenhum pagamento confirmado em {nomeMes(mesSel)}</td></tr>
                ) : stats.pagsMes.map(p => {
                  const al = alunas.find(a => a.id === p.alunaId);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{al?.nome || '—'}</td>
                      <td><span style={{ fontSize: 11, color: 'var(--text3)' }}>{al?.modalidade || '—'}</span></td>
                      <td><span style={{ fontSize: 11 }}>{(p.data || '').split('-').reverse().join('/')}</span></td>
                      <td><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--bg2)', color: 'var(--text2)', fontWeight: 600 }}>{(p as any).forma || 'Pix'}</span></td>
                      <td><span style={{ fontWeight: 700, color: 'var(--green)', fontSize: 13 }}>{fmt(p.valor)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ABA ALUNAS ──────────────────────────────────────────────────── */}
      {aba === 'alunas' && (
        <div>
          {/* Top pagadoras */}
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header">
              <div>
                <div className="panel-title">Top Alunas por Receita — {anoAtual}</div>
                <div className="panel-sub">Maior contribuição acumulada no ano</div>
              </div>
            </div>
            <div style={{ padding: '8px 0' }}>
              {topAlunas.map(({ aluna, total }, i) => {
                const max = topAlunas[0]?.total || 1;
                const pct = Math.round((total / max) * 100);
                return (
                  <div key={aluna!.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 24, height: 24, borderRadius: 8, background: i < 3 ? 'var(--gold-bg)' : 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: i < 3 ? 'var(--gold-dark)' : 'var(--text3)', flexShrink: 0 }}>
                      {i+1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aluna!.nome}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--green)', flexShrink: 0, marginLeft: 8 }}>{fmt(total)}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? 'var(--gold)' : 'var(--green)', borderRadius: 99 }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{aluna!.modalidade}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inadimplentes */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Inadimplentes — {nomeMes(mesSel)}</div>
                <div className="panel-sub">{inadimplentes.length} alunas · {fmt(stats.inad)} em aberto</div>
              </div>
            </div>
            <table className="splendore-table">
              <thead><tr><th>Aluna</th><th>Responsável</th><th>Modalidade</th><th>Atraso</th><th>Total</th></tr></thead>
              <tbody>
                {inadimplentes.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
                    <div style={{ fontSize: 13, color: 'var(--text3)' }}>Todas as alunas em dia!</div>
                  </td></tr>
                ) : inadimplentes.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{a.nome}</td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{a.responsavel}</td>
                    <td><span style={{ fontSize: 11, color: 'var(--text3)' }}>{a.modalidade}</span></td>
                    <td>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 700,
                        background: ((a as any).quantidadeMeses || 1) >= 2 ? 'var(--red-bg)' : 'rgba(217,119,6,0.1)',
                        color: ((a as any).quantidadeMeses || 1) >= 2 ? 'var(--red)' : 'var(--amber)',
                      }}>
                        {(a as any).quantidadeMeses || 1} mês/meses
                      </span>
                    </td>
                    <td><span style={{ fontWeight: 700, color: 'var(--red)', fontSize: 13 }}>{fmt((a as any).totalDebito || a.valor)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ABA MODALIDADES ─────────────────────────────────────────────── */}
      {aba === 'modalidades' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 20 }}>
            {modStats.map(([mod, s]) => {
              const taxa = s.alunas > 0 ? Math.round(((s.alunas - s.inad) / s.alunas) * 100) : 100;
              const color = modColors[mod] || '#64748B';
              return (
                <div key={mod} className="panel" style={{ padding: '18px 20px', borderLeft: `4px solid ${color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{mod}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.alunas} alunas ativas</div>
                    </div>
                    <span style={{ fontSize: 14, padding: '3px 10px', borderRadius: 99, fontWeight: 700,
                      background: taxa >= 80 ? 'var(--green-bg)' : taxa >= 60 ? 'rgba(217,119,6,0.1)' : 'var(--red-bg)',
                      color: taxa >= 80 ? 'var(--green)' : taxa >= 60 ? 'var(--amber)' : 'var(--red)',
                    }}>{taxa}%</span>
                  </div>
                  {[
                    { label: 'Receita', value: fmt(s.receita), color: 'var(--green)' },
                    { label: 'Pagaram', value: `${s.pagou} / ${s.alunas}`, color: 'var(--text)' },
                    { label: 'Inadimplentes', value: String(s.inad), color: s.inad > 0 ? 'var(--red)' : 'var(--green)' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{item.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.value}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${taxa}%`, background: color, borderRadius: 99, transition: 'width 0.8s' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparação visual */}
          <div className="panel">
            <div className="panel-header"><div className="panel-title">Receita por Modalidade — {nomeMes(mesSel)}</div></div>
            <div style={{ padding: '16px 20px' }}>
              {modStats.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13 }}>Nenhum dado</div>
              ) : (() => {
                const maxRec = Math.max(...modStats.map(([, s]) => s.receita), 1);
                return modStats.map(([mod, s]) => {
                  const pct = Math.round((s.receita / maxRec) * 100);
                  const color = modColors[mod] || '#64748B';
                  return (
                    <div key={mod} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{mod}</span>
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{s.alunas} alunas</span>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)' }}>{fmt(s.receita)}</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--bg2)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.8s' }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Estilos de impressão */}
      <style>{`
        @media print {
          .topbar, .sidebar, nav, button, .btn { display: none !important; }
          .panel { break-inside: avoid; box-shadow: none !important; border: 1px solid #ddd !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
