import { useState, useMemo, useCallback } from "react";
import { fmt, initials, mesAtual, genId, recalcularPlano, editarLoteMensalidades, getDiagnostico, corrigirInconsistencias, editarMensalidade, req } from "../lib/api";
import type { Aluna } from "../types";

// genId centralizado em lib/api
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_ABR  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

interface Mensalidade {
  valor: number; status: 'pago'|'pendente'|'atrasado'; pagamento: any|null;
}
interface Props { alunas: Aluna[]; onToast: (msg:string,type?:"success"|"danger"|"gold")=>void; onRefresh:()=>void; }

const ST = {
  pago:     { label:'Pago',     color:'#16A34A', bg:'rgba(22,163,74,0.1)',  border:'rgba(22,163,74,0.2)',  icon:'✓' },
  pendente: { label:'Pendente', color:'#D97706', bg:'rgba(217,119,6,0.1)', border:'rgba(217,119,6,0.2)', icon:'⏳' },
  atrasado: { label:'Atrasado', color:'#DC2626', bg:'rgba(220,38,38,0.1)', border:'rgba(220,38,38,0.2)', icon:'!' },
};

export function MensalidadesPage({ alunas, onToast, onRefresh }: Props) {
  const [search, setSearch]           = useState("");
  const [alunaSel, setAlunaSel]       = useState<Aluna|null>(null);
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [loading, setLoading]         = useState(false);
  const [modalPagar, setModalPagar]   = useState<Mensalidade|null>(null);
  const [modalVcto, setModalVcto]     = useState(false);
  const [modalRecalc, setModalRecalc] = useState(false);
  const [modalDiag, setModalDiag]     = useState(false);
  const [modalLote, setModalLote]     = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [diagData, setDiagData]       = useState<any>(null);
  const [recalcForm, setRecalcForm]   = useState({ valorTotal:'', parcelas:'12', planoTipo:'mensal' });
  const [loteForm, setLoteForm]       = useState({ novoValor:'', desconto:'', tipoDesconto: 'valor' as 'valor' | 'percentual', motivo:'' }); // BUG-3
  const [novoVcto, setNovoVcto]       = useState("10");
  const [pagForm, setPagForm]         = useState({ data: new Date().toISOString().split('T')[0], forma:'Pix', valor:'' });
  const [saving, setSaving]           = useState(false);
  const [gerando, setGerando]         = useState(false);
  const [filtro, setFiltro]           = useState('todos');
  const [ano, setAno]                 = useState(new Date().getFullYear());

  const filteredAlunas = useMemo(() => {
    const q = search.toLowerCase();
    return alunas.filter(a => !q || a.nome.toLowerCase().includes(q) || (a.responsavel||'').toLowerCase().includes(q));
  }, [alunas, search]);

  // ── Recalcular plano
  const handleRecalc = async () => {
    if (!alunaSel || !recalcForm.valorTotal) { onToast("Informe o valor total","danger"); return; }
    setSaving(true);
    try {
      const r = await recalcularPlano(alunaSel.id, {
        valorTotal: parseFloat(recalcForm.valorTotal),
        parcelas: parseInt(recalcForm.parcelas),
        planoTipo: recalcForm.planoTipo,
        anoRef: ano,
      });
      onToast(r.mensagem || `✓ ${r.atualizados} mensalidades atualizadas!`,"success");
      setModalRecalc(false);
      setSelecionados(new Set());
      await onRefresh();
      await carregarMens(alunaSel);
    } catch(e:any) { onToast(e.message,"danger"); }
    finally { setSaving(false); }
  };

  // ── Diagnóstico
  const handleDiag = async () => {
    if (!alunaSel) return;
    try {
      const r = await getDiagnostico(alunaSel.id);
      setDiagData(r);
      setModalDiag(true);
    } catch(e:any) { onToast(e.message,"danger"); }
  };

  // ── Corrigir inconsistências
  const handleCorrigir = async (valorCorreto?: number) => {
    if (!alunaSel) return;
    setSaving(true);
    try {
      const r = await corrigirInconsistencias(alunaSel.id, valorCorreto);
      onToast(`✓ ${r.corrigidos} mensalidades corrigidas para R${r.valorAlvo}!`,"success");
      setModalDiag(false);
      await carregarMens(alunaSel);
      onRefresh();
    } catch(e:any) { onToast(e.message,"danger"); }
    finally { setSaving(false); }
  };

  // ── Edição em lote
  const handleEditarLote = async () => {
    if (!alunaSel || selecionados.size === 0) { onToast("Selecione pelo menos uma mensalidade","danger"); return; }
    setSaving(true);
    try {
      // Separar IDs reais de banco (nanoid) dos identificadores por mês (YYYY-MM)
      const mesRegex = /^\d{4}-\d{2}$/;
      const idsReais   = Array.from(selecionados).filter(id => !mesRegex.test(id));
      const mesesStr   = Array.from(selecionados).filter(id =>  mesRegex.test(id));

      const r = await editarLoteMensalidades({
        alunaId: alunaSel.id,
        mesIds:  idsReais.length  ? idsReais  : undefined,
        meses:   mesesStr.length  ? mesesStr  : undefined,
        novoValor: loteForm.novoValor ? parseFloat(loteForm.novoValor) : undefined,
        desconto: loteForm.desconto ? parseFloat(loteForm.desconto) : undefined,
        tipoDesconto: loteForm.tipoDesconto, // BUG-3 FIX
        motivo: loteForm.motivo,
      });
      onToast(`✓ ${r.atualizados} mensalidades atualizadas | ${r.pulados} pagas (preservadas)`,"success");
      setModalLote(false);
      setSelecionados(new Set());
      await carregarMens(alunaSel);
    } catch(e:any) { onToast(e.message,"danger"); }
    finally { setSaving(false); }
  };

  // Toggle seleção de mensalidade
  const toggleSel = (id: string) => setSelecionados(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const carregarMens = useCallback(async (aluna: Aluna, anoRef?: number) => {
    setLoading(true); setMensalidades([]);
    // Usar anoRef se fornecido, senão usar estado atual
    const anoAlvo = anoRef !== undefined ? anoRef : ano;
    try {
      const d = await req<any>(`/mensalidades/${aluna.id}?ano=${anoAlvo}`);
      const mens = d.mensalidades || [];
      // Auto-gerar: se não tem nenhuma mensalidade no ano atual, gera automaticamente
      if (mens.length === 0 && aluna.ativo) {
        try {
          await req<any>(`/mensalidades/gerar/${aluna.id}`, {
            method: 'POST',
            body: JSON.stringify({ ano: anoAlvo }),
          });
          const d2 = await req<any>(`/mensalidades/${aluna.id}?ano=${anoAlvo}`);
          setMensalidades(d2.mensalidades || []);
        } catch(eGerar: any) {
          onToast(`Erro ao gerar mensalidades: ${eGerar.message}`, "danger");
          setMensalidades([]);
        }
      } else {
        setMensalidades(mens);
      }
      setNovoVcto(aluna.vencimento || '10');
    } catch(e: any) { onToast(`Erro ao carregar mensalidades: ${e.message}`,"danger"); }
    finally { setLoading(false); }
  }, [ano]);

  const selectAluna = (a: Aluna) => {
    setSelecionados(new Set());
    setFiltro('todos');
    setAlunaSel(a);
    carregarMens(a);
  };

  const handlePagar = async () => {
    if (!modalPagar || !alunaSel) return;
    setSaving(true);
    try {
      const val = parseFloat(pagForm.valor) || modalPagar.valor;

      // Usar dados do objeto modalPagar diretamente (que já foi carregado corretamente)
      // 1. Se existe registro no banco → dar baixa via PUT
      // 2. Se não existe → criar via POST já marcado como pago
      const existenteId = modalPagar.pagamento?.id;

      if (existenteId) {
        await req(`/pagamentos/${existenteId}/pagar`, {
          method: 'PUT',
          body: JSON.stringify({ data: pagForm.data, forma: pagForm.forma, valor: val }),
        });
      } else {
        await req('/pagamentos', {
          method: 'POST',
          body: JSON.stringify({
            id: genId(),
            aluna_id: alunaSel.id,
            mes: modalPagar.mes,
            data: pagForm.data,
            valor: val,

            forma: pagForm.forma,
          }),
        });
      }

      const mesIdx = parseInt(modalPagar.mes.split('-')[1]) - 1;
      onToast(`✓ ${MESES_FULL[mesIdx]} pago!`, "success");
      setModalPagar(null);
      // Recarregar com delay para garantir que o banco processou
      setTimeout(() => {
        carregarMens(alunaSel, ano);
        onRefresh();
      }, 500);

      // WhatsApp
      const wpp = (alunaSel.whatsapp || '').replace(/\D/g, '');
      if (wpp) {
        const msg = encodeURIComponent(
          `Olá, ${alunaSel.responsavel || alunaSel.nome}! 🩰\n\n` +
          `Pagamento de *${MESES_FULL[mesIdx]}/${modalPagar.mes.split('-')[0]}* confirmado:\n` +
          `• Aluna: ${alunaSel.nome}\n` +
          `• Valor: R$ ${val.toFixed(2).replace('.', ',')}\n` +
          `• Forma: ${pagForm.forma}\n\nObrigada! ✦ Splendore`
        );
        if (confirm("Enviar confirmação WhatsApp?")) {
          window.open(`https://wa.me/55${wpp}?text=${msg}`, '_blank');
        }
      }
    } catch (e: any) {
      onToast(e.message, "danger");
    } finally {
      setSaving(false);
    }
  };

  const handleAlterarVcto = async () => {
    if (!alunaSel) return;
    const dia = parseInt(novoVcto);
    if (!dia||dia<1||dia>31) { onToast("Dia inválido","danger"); return; }
    setSaving(true);
    try {
      await req(`/alunas/${alunaSel.id}/vencimento`, {
        method: 'PUT',
        body: JSON.stringify({ diaVencimento: dia }),
      });
      onToast(`Vencimento alterado para dia ${dia}`,"success");
      setModalVcto(false);
      const atualizadaLocal = { ...alunaSel, vencimento: String(dia) };
      setAlunaSel(atualizadaLocal);
      await carregarMens(atualizadaLocal);
      onRefresh();
    } catch(e:any) { onToast(e.message,"danger"); }
    finally { setSaving(false); }
  };

  const handleGerarTodas = async () => {
    if (!confirm(`Gerar mensalidades de ${ano} para todas as alunas ativas?\nSó meses sem registro serão criados.`)) return;
    setGerando(true);
    try {
      const d = await req<any>('/mensalidades/gerar-todas', {
        method: 'POST',
        body: JSON.stringify({ ano }),
      });
      onToast(`✦ ${d.gerados} mensalidades geradas para ${d.alunas} alunas!`,"success");
      if (alunaSel) await carregarMens(alunaSel);
    } catch(e:any) { onToast(e.message,"danger"); }
    finally { setGerando(false); }
  };

  const mensFiltradas = useMemo(() =>
    filtro==='todos' ? mensalidades : mensalidades.filter(m=>m.status===filtro),
    [mensalidades, filtro]);

  const stats = useMemo(() => ({
    pago:     mensalidades.filter(m=>m.status==='pago').length,
    pendente: mensalidades.filter(m=>m.status==='pendente').length,
    atrasado: mensalidades.filter(m=>m.status==='atrasado').length,
    totalPago: mensalidades.filter(m=>m.status==='pago').reduce((s,m)=>s+(m.pagamento?.valor||m.valor),0),
    aReceber:  mensalidades.filter(m=>m.status!=='pago').reduce((s,m)=>s+m.valor,0),
  }), [mensalidades]);

  return (
    <div className="animate-fade-up" style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 100px)', gap:0 }}>

      {/* ── TOP BAR ── */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8, flexShrink:0 }}>
        <div style={{ fontSize:20, fontWeight:800, color:'var(--text)', flex:1 }}>Mensalidades</div>
        <select value={ano} onChange={e=>{ const a = parseInt(e.target.value); setAno(a); if(alunaSel) carregarMens(alunaSel, a); }} style={{ width:88, padding:'7px 10px', fontSize:12, borderRadius:8 }}>
          {[2024,2025,2026,2027].map(a=><option key={a}>{a}</option>)}
        </select>
        <button onClick={handleGerarTodas} disabled={gerando} className="btn btn-primary" style={{ gap:6, background:'var(--gold)', padding:'9px 18px', fontSize:13 }}>
          {gerando ? <><div className="spinner" style={{width:13,height:13}}/> Gerando para todas...</> : `⚡ Gerar ${ano} para todas`}
        </button>
      </div>
      {/* Banner: clica em Gerar para criar mensalidades de todas as alunas sem registro */}
      <div style={{ marginBottom:14, padding:'10px 14px', background:'rgba(217,119,6,0.08)', border:'1.5px solid rgba(217,119,6,0.25)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexShrink:0 }}>
        <div style={{ fontSize:12, color:'#92400e' }}>
          <strong>⚡ Dica:</strong> Se há alunas sem mensalidades, clique em <strong>"Gerar {ano} para todas"</strong> — só cria meses que ainda não existem, nunca duplica.
          Ao clicar em uma aluna sem registro, as mensalidades são geradas automaticamente.
        </div>
      </div>

      {/* ── LAYOUT SPLIT ── */}
      <div style={{ display:'flex', gap:16, flex:1, overflow:'hidden' }}>

        {/* ── LISTA DE ALUNAS ── */}
        <div style={{ width:286, flexShrink:0, display:'flex', flexDirection:'column', gap:10 }}>
          <div className="search-wrap">
            <span className="search-icon" style={{fontSize:13}}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar aluna..." style={{ fontSize:13 }} />
          </div>
          <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:5 }}>
            {filteredAlunas.map(a => {
              const isActive = alunaSel?.id === a.id;
              return (
                <button key={a.id} onClick={()=>selectAluna(a)}
                  style={{ width:'100%', textAlign:'left', padding:'10px 12px',
                    background: isActive ? 'rgba(201,168,106,0.1)' : 'var(--surface)',
                    border: `1.5px solid ${isActive ? 'var(--gold)' : 'var(--border)'}`,
                    borderRadius:10, cursor:'pointer', fontFamily:'inherit', transition:'all 0.12s',
                  }}>
                  <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                    <div className="avatar avatar-sm" style={{ background: isActive?'var(--gold-bg)':'var(--bg2)', color: isActive?'var(--gold-dark)':'var(--text2)', fontSize:10 }}>
                      {initials(a.nome)}
                    </div>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text)' }}>{a.nome}</div>
                      <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>{a.modalidade} · Dia {a.vencimento||'10'}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── PAINEL MENSALIDADES ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:12, overflow:'hidden' }}>
          {!alunaSel ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, color:'var(--text3)' }}>
              <div style={{ width:64, height:64, borderRadius:18, background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>💰</div>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text2)' }}>Selecione uma aluna</div>
              <div style={{ fontSize:13 }}>para visualizar e gerenciar mensalidades</div>
            </div>
          ) : (
            <>
              {/* Header da aluna — compacto */}
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', gap:10, flexShrink:0, flexWrap:'wrap' }}>
                <div className="avatar avatar-md" style={{ background:'var(--gold-bg)', color:'var(--gold-dark)', fontWeight:800 }}>
                  {initials(alunaSel.nome)}
                </div>
                <div style={{ flex:1, minWidth:120 }}>
                  <div style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>{alunaSel.nome}</div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:1 }}>
                    {alunaSel.modalidade}{alunaSel.nivel?' · '+alunaSel.nivel:''} · {fmt(alunaSel.valor)}/parcela
                    {(alunaSel as any).planoParcelas && <span style={{ marginLeft:8, padding:'1px 7px', borderRadius:99, background:'var(--gold-bg)', color:'var(--gold-dark)', fontSize:10, fontWeight:700 }}>Plano {(alunaSel as any).planoParcelas}x</span>}
                  </div>
                </div>
                {/* Botões de ação */}
                <button onClick={()=>setModalRecalc(true)} style={{ fontSize:11, fontWeight:700, color:'#fff', background:'linear-gradient(135deg,var(--gold),var(--gold-dark))', border:'none', borderRadius:8, padding:'7px 14px', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', boxShadow:'0 2px 8px rgba(201,168,106,0.35)' }}>
                  🔄 Recalcular
                </button>
                <button onClick={handleDiag} style={{ fontSize:11, fontWeight:600, color:'var(--blue)', background:'var(--blue-bg)', border:'1px solid rgba(37,99,235,0.25)', borderRadius:8, padding:'7px 12px', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                  🔍 Diagnóstico
                </button>
                <button onClick={()=>setModalVcto(true)} style={{ fontSize:11, fontWeight:600, color:'var(--text2)', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 10px', cursor:'pointer', fontFamily:'inherit' }}>
                  📅 Dia {alunaSel.vencimento||'10'}
                </button>
                <button onClick={()=>{ req(`/mensalidades/gerar/${alunaSel.id}`,{method:'POST',body:JSON.stringify({ano})}).then(()=>{ carregarMens(alunaSel); onToast('Mensalidades geradas!','success'); }).catch((e:any)=>onToast(`Erro ao gerar: ${e.message}`,'danger')); }} style={{ fontSize:11, fontWeight:600, color:'var(--text2)', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 10px', cursor:'pointer', fontFamily:'inherit' }}>
                  ✦ Gerar {ano}
                </button>
              </div>

              {/* Stats compactas em linha */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, flexShrink:0 }}>
                {[
                  { label:'✓ Pagas',     value:stats.pago,     color:'#16A34A', bg:'rgba(22,163,74,0.08)'  },
                  { label:'⏳ Pendentes', value:stats.pendente, color:'#D97706', bg:'rgba(217,119,6,0.08)'  },
                  { label:'! Atrasadas', value:stats.atrasado, color:'#DC2626', bg:'rgba(220,38,38,0.08)'  },
                  { label:'Total pago',  value:fmt(stats.totalPago).replace('R$ ','R$'), color:'#16A34A', bg:'rgba(22,163,74,0.05)' },
                  { label:'A receber',   value:fmt(stats.aReceber).replace('R$ ','R$'),  color:'#DC2626', bg:'rgba(220,38,38,0.05)' },
                ].map(({label,value,color,bg})=>(
                  <div key={label} style={{ background:bg, borderRadius:10, padding:'8px 10px', border:`1px solid ${color}20`, textAlign:'center' }}>
                    <div style={{ fontSize:9, color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:0.4, marginBottom:3 }}>{label}</div>
                    <div style={{ fontSize:14, fontWeight:800, color }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Filtros + Lote */}
              <div style={{ display:'flex', gap:6, flexShrink:0, flexWrap:'wrap', alignItems:'center' }}>
                {(['todos','pago','pendente','atrasado'] as const).map(f => (
                  <button key={f} onClick={()=>setFiltro(f)}
                    className={`btn btn-sm ${filtro===f?'btn-primary':'btn-secondary'}`}
                    style={{ fontSize:11 }}>
                    {f==='todos'?'Todos':f.charAt(0).toUpperCase()+f.slice(1)}
                    {f!=='todos' && <span style={{ marginLeft:5, padding:'1px 6px', borderRadius:99, background: filtro===f?'rgba(255,255,255,0.25)':'rgba(0,0,0,0.08)', fontSize:10 }}>
                      {f==='pago'?stats.pago:f==='pendente'?stats.pendente:stats.atrasado}
                    </span>}
                  </button>
                ))}
                <div style={{ flex:1 }}/>
                {selecionados.size > 0 && (
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ fontSize:11, color:'var(--gold-dark)', fontWeight:700, padding:'4px 10px', background:'var(--gold-bg)', borderRadius:99, border:'1px solid rgba(201,168,106,0.3)' }}>
                      {selecionados.size} selecionada{selecionados.size!==1?'s':''}
                    </span>
                    <button onClick={()=>setModalLote(true)} className="btn btn-sm" style={{ fontSize:11, background:'rgba(37,99,235,0.1)', color:'var(--blue)', border:'1px solid rgba(37,99,235,0.25)' }}>
                      ✏️ Editar em lote
                    </button>
                    <button onClick={()=>setSelecionados(new Set())} className="btn btn-sm btn-secondary" style={{ fontSize:11 }}>
                      ✕ Limpar
                    </button>
                  </div>
                )}
              </div>

              {/* Grid 4 colunas para caber sem scroll */}
              <div style={{ flex:1, overflowY:'auto' }}>
                {loading ? (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:40, gap:10, color:'var(--text3)' }}>
                    <div className="spinner"/> Carregando mensalidades...
                  </div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                    {mensFiltradas.map(m => {
                      const mesIdx = parseInt(m.mes.split('-')[1]) - 1;
                      const st = ST[m.status];
                      const isPago = m.status === 'pago';
                      const isAtrasado = m.status === 'atrasado';
                      const isSel = selecionados.has(m.mes);
                      return (
                        <div key={m.mes} style={{
                          background: isSel ? 'var(--blue-bg)' : 'var(--surface)',
                          border:`1.5px solid ${isSel?'var(--blue)':isAtrasado?'rgba(220,38,38,0.3)':isPago?'rgba(22,163,74,0.2)':'var(--border)'}`,
                          borderRadius:12, padding:'12px', position:'relative',
                          boxShadow: isAtrasado?'0 2px 8px rgba(220,38,38,0.08)':'0 1px 4px rgba(0,0,0,0.04)',
                          transition:'all 0.1s',
                        }}>
                          {/* Checkbox seleção (só para não pagos) */}
                          {!isPago && (
                            <input type="checkbox" checked={isSel} onChange={()=>toggleSel(m.mes)}
                              style={{ position:'absolute', top:8, right:8, width:14, height:14, cursor:'pointer', accentColor:'var(--blue)' }} />
                          )}

                          {/* Mês + badge */}
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
                            <div style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>{MESES_ABR[mesIdx]}</div>
                            <span style={{ padding:'2px 6px', borderRadius:99, fontSize:9, fontWeight:800, background:st.bg, color:st.color, border:`1px solid ${st.border}` }}>
                              {st.icon}
                            </span>
                          </div>

                          {/* Valor */}
                          <div style={{ fontSize:16, fontWeight:900, color: isPago?'var(--green)':isAtrasado?'var(--red)':'var(--amber)', marginBottom:3, letterSpacing:-0.5 }}>
                            {fmt(m.pagamento?.valor||m.valor)}
                          </div>

                          {/* Vencimento */}
                          <div style={{ fontSize:10, color:'var(--text3)', marginBottom: isPago?5:7 }}>
                          </div>

                          {/* Pago: data */}
                          {isPago && m.pagamento && (
                            <div style={{ padding:'3px 6px', background:'var(--green-bg)', borderRadius:5, fontSize:10, color:'var(--green)', fontWeight:600 }}>
                              ✓ {m.pagamento.data?.split('-').reverse().join('/')}
                            </div>
                          )}

                          {/* Botão pagar */}
                          {!isPago && (
                            <button
                              onClick={()=>{ setPagForm({data:new Date().toISOString().split('T')[0],forma:'Pix',valor:String(m.valor)}); setModalPagar(m); }}
                              style={{ width:'100%', padding:'5px 0', fontSize:11, fontWeight:700, borderRadius:6,
                                background:st.bg, color:st.color, border:`1px solid ${st.border}`,
                                cursor:'pointer', fontFamily:'inherit' }}
                            >💰 Pagar</button>
                          )}
                        </div>
                      );
                    })}
                    {mensFiltradas.length===0 && (
                      <div style={{ gridColumn:'span 4', textAlign:'center', padding:32, color:'var(--text3)' }}>
                        <div style={{ fontSize:28, marginBottom:8, opacity:0.3 }}>📋</div>
                        Nenhuma mensalidade.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── MODAL PAGAR ── */}
      {modalPagar && (
        <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setModalPagar(null)}}>
          <div className="modal-box" style={{maxWidth:400}}>
            <button onClick={()=>setModalPagar(null)} style={{position:'absolute',top:14,right:14,width:26,height:26,borderRadius:'50%',background:'var(--bg2)',border:'none',cursor:'pointer',fontSize:13}}>✕</button>
            <div style={{fontSize:10,fontWeight:800,letterSpacing:1,textTransform:'uppercase',color:'var(--green)',marginBottom:3}}>Pagamento</div>
            <div style={{fontSize:17,fontWeight:800,marginBottom:4,color:'var(--text)'}}>Registrar Pagamento</div>
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:18}}>{alunaSel?.nome} · {MESES_FULL[parseInt(modalPagar.mes.split('-')[1])-1]}/{modalPagar.mes.split('-')[0]}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                <label style={{fontSize:10,fontWeight:700,color:'var(--text2)',letterSpacing:0.3}}>Data do pagamento</label>
                <input type="date" value={pagForm.data} onChange={e=>setPagForm(f=>({...f,data:e.target.value}))} />
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                <label style={{fontSize:10,fontWeight:700,color:'var(--text2)'}}>Valor (R$)</label>
                <input type="number" value={pagForm.valor} onChange={e=>setPagForm(f=>({...f,valor:e.target.value}))} placeholder={String(modalPagar.valor)} />
              </div>
              <div style={{gridColumn:'span 2',display:'flex',flexDirection:'column',gap:5}}>
                <label style={{fontSize:10,fontWeight:700,color:'var(--text2)'}}>Forma</label>
                <select value={pagForm.forma} onChange={e=>setPagForm(f=>({...f,forma:e.target.value}))}>
                  <option>Pix</option><option>Dinheiro</option><option>Cartão Débito</option><option>Cartão Crédito</option><option>Boleto</option>
                </select>
              </div>
            </div>
            <div style={{marginTop:10,padding:'8px 12px',background:'var(--gold-bg)',borderRadius:8,fontSize:11,color:'#92610A',border:'1px solid rgba(201,168,106,0.3)'}}>
              {modalPagar.status==='atrasado' && <span style={{marginLeft:8,color:'var(--red)',fontWeight:700}}>⚠️ ATRASADO</span>}
            </div>
            <div style={{display:'flex',gap:8,marginTop:16,paddingTop:14,borderTop:'1px solid var(--border)',justifyContent:'flex-end'}}>
              <button className="btn btn-secondary btn-sm" onClick={()=>setModalPagar(null)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={handlePagar} disabled={saving}>
                {saving?<><div className="spinner" style={{width:12,height:12}}/> Salvando...</>:'✓ Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL VENCIMENTO ── */}
      {modalVcto && (
        <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setModalVcto(false)}}>
          <div className="modal-box" style={{maxWidth:360}}>
            <button onClick={()=>setModalVcto(false)} style={{position:'absolute',top:14,right:14,width:26,height:26,borderRadius:'50%',background:'var(--bg2)',border:'none',cursor:'pointer',fontSize:13}}>✕</button>
            <div style={{fontSize:17,fontWeight:800,marginBottom:6,color:'var(--text)'}}>Alterar Vencimento</div>
            <div style={{padding:'10px 12px',background:'var(--amber-bg)',borderRadius:8,border:'1px solid rgba(217,119,6,0.3)',fontSize:12,color:'#92400E',marginBottom:16,lineHeight:1.6}}>
              ⚠️ Apenas mensalidades <strong>futuras não pagas</strong> serão atualizadas.
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:18}}>
              <label style={{fontSize:11,fontWeight:700,color:'var(--text2)'}}>Novo dia de vencimento</label>
              <select value={novoVcto} onChange={e=>setNovoVcto(e.target.value)}>
                {['1','5','7','10','12','15','18','20','25','28'].map(d=><option key={d} value={d}>Dia {d}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-secondary btn-sm" onClick={()=>setModalVcto(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={handleAlterarVcto} disabled={saving}>{saving?'Salvando...':'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
      {/* ── MODAL RECALCULAR PLANO ── */}
      {modalRecalc && (
        <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setModalRecalc(false)}}>
          <div className="modal-box" style={{maxWidth:480}}>
            <button onClick={()=>setModalRecalc(false)} style={{position:'absolute',top:14,right:14,width:28,height:28,borderRadius:'50%',background:'var(--bg2)',border:'none',cursor:'pointer',fontSize:14}}>✕</button>
            <div style={{fontSize:11,fontWeight:800,letterSpacing:1,textTransform:'uppercase',color:'var(--gold-dark)',marginBottom:4}}>Plano Financeiro</div>
            <div style={{fontSize:18,fontWeight:800,marginBottom:6,color:'var(--text)'}}>Recalcular Plano</div>
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:20,lineHeight:1.6}}>
              Informe o valor total e o número de parcelas. O sistema divide automaticamente e atualiza apenas mensalidades <strong>não pagas</strong>.
            </div>

            {/* Preview do cálculo */}
            {recalcForm.valorTotal && recalcForm.parcelas && (
              <div style={{padding:'12px 14px',background:'var(--gold-bg)',borderRadius:10,border:'1px solid rgba(201,168,106,0.3)',marginBottom:18,display:'flex',alignItems:'center',gap:12}}>
                <div style={{fontSize:22}}>📊</div>
                <div>
                  <div style={{fontSize:12,color:'var(--text2)'}}>
                    R$ {recalcForm.valorTotal} ÷ {recalcForm.parcelas} parcelas =
                  </div>
                  <div style={{fontSize:20,fontWeight:900,color:'var(--gold-dark)'}}>
                    R$ {(parseFloat(recalcForm.valorTotal||'0')/parseInt(recalcForm.parcelas||'1')).toFixed(2).replace('.',',')} / mês
                  </div>
                </div>
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
              <div style={{gridColumn:'span 2',display:'flex',flexDirection:'column',gap:5}}>
                <label style={{fontSize:11,fontWeight:700,color:'var(--text2)'}}>Valor total do plano (R$) *</label>
                <input type="number" value={recalcForm.valorTotal} onChange={e=>setRecalcForm(f=>({...f,valorTotal:e.target.value}))} placeholder="Ex: 1920" style={{fontSize:18,fontWeight:700,textAlign:'center'}} />
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                <label style={{fontSize:11,fontWeight:700,color:'var(--text2)'}}>Número de parcelas</label>
                <select value={recalcForm.parcelas} onChange={e=>setRecalcForm(f=>({...f,parcelas:e.target.value,planoTipo:e.target.value==='12'?'mensal':e.target.value==='6'?'semestral':'trimestral'}))}>
                  <option value="12">12x — Mensal</option>
                  <option value="6">6x — Semestral</option>
                  <option value="3">3x — Trimestral</option>
                  <option value="1">1x — À vista</option>
                  <option value="2">2x</option>
                  <option value="4">4x</option>
                </select>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                <label style={{fontSize:11,fontWeight:700,color:'var(--text2)'}}>Ano de referência</label>
                <select value={ano} onChange={e=>setAno(parseInt(e.target.value))}>
                  {[2025,2026,2027].map(a=><option key={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div style={{padding:'10px 12px',background:'var(--amber-bg)',borderRadius:8,border:'1px solid rgba(217,119,6,0.3)',fontSize:12,color:'#92400E',marginBottom:18,lineHeight:1.6}}>
              ⚠️ <strong>Segurança:</strong> Mensalidades <strong>já pagas</strong> não serão alteradas. Apenas pendentes e futuras serão atualizadas.
            </div>

            <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:14,borderTop:'1px solid var(--border)'}}>
              <button className="btn btn-secondary btn-sm" onClick={()=>setModalRecalc(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleRecalc} disabled={saving||!recalcForm.valorTotal} style={{minWidth:160}}>
                {saving?<><div className="spinner" style={{width:13,height:13}}/> Calculando...</>:'🔄 Aplicar Recálculo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DIAGNÓSTICO ── */}
      {modalDiag && diagData && (
        <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setModalDiag(false)}}>
          <div className="modal-box" style={{maxWidth:520}}>
            <button onClick={()=>setModalDiag(false)} style={{position:'absolute',top:14,right:14,width:28,height:28,borderRadius:'50%',background:'var(--bg2)',border:'none',cursor:'pointer',fontSize:14}}>✕</button>
            <div style={{fontSize:11,fontWeight:800,letterSpacing:1,textTransform:'uppercase',color:'var(--blue)',marginBottom:4}}>Análise</div>
            <div style={{fontSize:18,fontWeight:800,marginBottom:16,color:'var(--text)'}}>Diagnóstico — {alunaSel?.nome?.split(' ')[0]}</div>

            {/* Stats */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
              {[
                {label:'Pagas',     value:diagData.stats.pagos,    color:'var(--green)'},
                {label:'Pendentes', value:diagData.stats.pendentes, color:'var(--amber)'},
                {label:'Atrasadas', value:diagData.stats.atrasados, color:'var(--red)'},
              ].map(({label,value,color})=>(
                <div key={label} style={{textAlign:'center',padding:'10px',background:'var(--bg)',borderRadius:10,border:'1px solid var(--border)'}}>
                  <div style={{fontSize:22,fontWeight:900,color}}>{value}</div>
                  <div style={{fontSize:11,color:'var(--text3)'}}>{label}</div>
                </div>
              ))}
            </div>

            {/* Plano atual */}
            <div style={{padding:'12px 14px',background:'var(--surface2)',borderRadius:10,marginBottom:16,border:'1px solid var(--border)'}}>
              <div style={{fontSize:12,fontWeight:700,color:'var(--text)',marginBottom:8}}>Plano atual:</div>
              <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
                <div><span style={{fontSize:11,color:'var(--text3)'}}>Valor/parcela: </span><strong style={{color:'var(--gold-dark)'}}>R$ {diagData.stats.valorPrincipal?.toFixed(2)}</strong></div>
                <div><span style={{fontSize:11,color:'var(--text3)'}}>Parcelas: </span><strong>{diagData.stats.planoParcelas||'—'}</strong></div>
                <div><span style={{fontSize:11,color:'var(--text3)'}}>Total plano: </span><strong>{diagData.stats.planoTotal?`R$ ${diagData.stats.planoTotal.toFixed(2)}`:'—'}</strong></div>
              </div>
              <div style={{marginTop:8,fontSize:11,color:'var(--text3)'}}>Valores distintos no banco: {Object.entries(diagData.valoresDist).map(([v,n])=>`R${v}(${n}x)`).join(', ')}</div>
            </div>

            {/* Inconsistências */}
            {diagData.inconsistentes.length > 0 ? (
              <>
                <div style={{padding:'10px 12px',background:'var(--red-bg)',borderRadius:8,border:'1px solid rgba(220,38,38,0.25)',fontSize:12,color:'var(--red)',marginBottom:14,fontWeight:600}}>
                  ⚠️ {diagData.inconsistentes.length} mensalidade{diagData.inconsistentes.length!==1?'s':''} com valor divergente do plano principal
                </div>
                <div style={{maxHeight:160,overflowY:'auto',marginBottom:14,display:'flex',flexDirection:'column',gap:6}}>
                  {diagData.inconsistentes.map((inc:any)=>(
                    <div key={inc.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,fontSize:12}}>
                      <span style={{fontWeight:700,color:'var(--text)',minWidth:60}}>{inc.mes}</span>
                      <span style={{color:'var(--red)',textDecoration:'line-through'}}>R$ {inc.valorAtual?.toFixed(2)}</span>
                      <span style={{color:'var(--text3)'}}>→</span>
                      <span style={{color:'var(--green)',fontWeight:700}}>R$ {inc.valorCorreto?.toFixed(2)}</span>
                      <span className={`badge badge-${inc.status==='atrasado'?'red':inc.status==='pendente'?'amber':'gray'}`} style={{marginLeft:'auto'}}>{inc.status}</span>
                    </div>
                  ))}
                </div>
                <button onClick={()=>handleCorrigir(diagData.stats.valorPrincipal)} disabled={saving} className="btn btn-primary" style={{width:'100%'}}>
                  {saving?'Corrigindo...':`✓ Corrigir ${diagData.inconsistentes.length} inconsistências automaticamente`}
                </button>
              </>
            ) : (
              <div style={{textAlign:'center',padding:20,color:'var(--green)',fontWeight:700,fontSize:14}}>
                ✅ Nenhuma inconsistência encontrada!
              </div>
            )}

            <div style={{display:'flex',justifyContent:'flex-end',marginTop:14,paddingTop:12,borderTop:'1px solid var(--border)'}}>
              <button className="btn btn-secondary btn-sm" onClick={()=>setModalDiag(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDIÇÃO EM LOTE ── */}
      {modalLote && (
        <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setModalLote(false)}}>
          <div className="modal-box" style={{maxWidth:440}}>
            <button onClick={()=>setModalLote(false)} style={{position:'absolute',top:14,right:14,width:28,height:28,borderRadius:'50%',background:'var(--bg2)',border:'none',cursor:'pointer',fontSize:14}}>✕</button>
            <div style={{fontSize:11,fontWeight:800,letterSpacing:1,textTransform:'uppercase',color:'var(--blue)',marginBottom:4}}>Edição</div>
            <div style={{fontSize:18,fontWeight:800,marginBottom:6,color:'var(--text)'}}>Editar em Lote</div>
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:18}}>
              {selecionados.size} mensalidade{selecionados.size!==1?'s':''} selecionada{selecionados.size!==1?'s':''} — apenas <strong>pendentes/atrasadas</strong> serão afetadas.
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:14,marginBottom:18}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  <label style={{fontSize:11,fontWeight:700,color:'var(--text2)'}}>Novo valor (R$)</label>
                  <input type="number" value={loteForm.novoValor} onChange={e=>setLoteForm(f=>({...f,novoValor:e.target.value}))} placeholder="Deixe vazio para não alterar" />
                </div>
                <div style={{display:'flex',gap:8}}>
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:5}}>
                    <label style={{fontSize:11,fontWeight:700,color:'var(--text2)'}}>Desconto</label>
                    <input type="number" value={loteForm.desconto} onChange={e=>setLoteForm(f=>({...f,desconto:e.target.value}))} placeholder="Ex: 20" />
                  </div>
                  <div style={{width:100,display:'flex',flexDirection:'column',gap:5}}>
                    <label style={{fontSize:11,fontWeight:700,color:'var(--text2)'}}>Tipo</label>
                    <select value={loteForm.tipoDesconto} onChange={e=>setLoteForm(f=>({...f,tipoDesconto:e.target.value as any}))} style={{padding:'6px 8px',border:'1px solid var(--border)',borderRadius:4,background:'var(--surface)',color:'var(--text)',fontSize:13}}>
                      <option value="valor">R$ (valor)</option>
                      <option value="percentual">% (percentual)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                <label style={{fontSize:11,fontWeight:700,color:'var(--text2)'}}>Motivo / Observação</label>
                <input value={loteForm.motivo} onChange={e=>setLoteForm(f=>({...f,motivo:e.target.value}))} placeholder="Ex: Desconto de irmã, correção de valor..." />
              </div>
            </div>

            <div style={{padding:'10px 12px',background:'var(--amber-bg)',borderRadius:8,border:'1px solid rgba(217,119,6,0.25)',fontSize:12,color:'#92400E',marginBottom:16}}>
              ⚠️ Pagamentos já quitados serão ignorados automaticamente.
            </div>

            <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:14,borderTop:'1px solid var(--border)'}}>
              <button className="btn btn-secondary btn-sm" onClick={()=>setModalLote(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleEditarLote} disabled={saving||(!loteForm.novoValor&&!loteForm.desconto)}>
                {saving?'Salvando...':`✏️ Aplicar em ${selecionados.size} mensalidades`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
