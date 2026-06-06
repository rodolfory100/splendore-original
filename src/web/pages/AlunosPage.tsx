import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { fmt, initials, mesAtual, toggleBolsista, genId, getAvaliacoes, addAvaliacao } from "../lib/api";
import { saveAluna, updateAluna, deleteAluna, savePagamento } from "../lib/api";
import { ConfirmModal } from "../components/ConfirmModal";
import { ContratoModal } from "../components/ContratoModal";
import type { Aluna, Pagamento, Turma } from "../types";

const chipClass = (m: string) => m==='Ballet'?'chip-ballet':m==='Jazz'?'chip-jazz':m==='Danças Urbanas'?'chip-urbanas':'chip-outro';
// genId centralizado em lib/api
const MODALIDADES = ["Ballet","Jazz","Danças Urbanas","Outra"];
const emptyForm = (): Partial<Aluna> => ({ nome:"",responsavel:"",whatsapp:"",email:"",cpfResponsavel:"",cpfResponsavel2:"",modalidade:"Ballet",nivel:"",valor:160,vencimento:"10",nascimento:"",turmaId:"",observacao:"",autorizaImagem:true,ativo:true,bolsista:false });

interface Props {
  alunas: Aluna[];
  pagamentos: Pagamento[];
  turmas: Turma[];
  onRefresh: () => void;
  onToast: (msg: string, type?: "success"|"danger"|"gold") => void;
}

export function AlunosPage({ alunas, pagamentos, turmas, onRefresh, onToast }: Props) {
  const [search, setSearch] = useState("");
  const [fMod, setFMod] = useState("");
  const [fStat, setFStat] = useState("");
  const [modal, setModal] = useState<"aluna"|"pagamento"|"bolsista"|"turma"|null>(null);
  const [boletoBanner, setBoletoBanner] = useState<{nome:string;valor:number}|null>(null);
  const [contratoAluna, setContratoAluna] = useState<any|null>(null);
  const [turmaAluna, setTurmaAluna] = useState<Aluna|null>(null);
  const [turmaForm, setTurmaForm] = useState({ modalidade: "", nivel: "", turmaId: "" });
  const [bolsistaAluna, setBolsistaAluna] = useState<Aluna|null>(null);
  const [bolsistaDesconto, setBolsistaDesconto] = useState(100);
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState<Partial<Aluna>>(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState<Aluna|null>(null); // MELHORIA-2: confirmação antes deletar
  const [pagForm, setPagForm] = useState({ alunaId:"",mes:mesAtual(),data:new Date().toISOString().split("T")[0],valor:"",forma:"Pix",observacao:"" });
  const [searchAluna, setSearchAluna] = useState("");
  const [saving, setSaving] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"dados"|"evolucao">("dados");
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [loadingAval, setLoadingAval] = useState(false);
  const [modalAval, setModalAval] = useState(false);
  const [avalForm, setAvalForm] = useState({ periodo: "", tecnica: 5, ritmo: 5, expressao: 5, disciplina: 5, evolucao: 5, observacoes: "", professor: "" });
  const [savingAval, setSavingAval] = useState(false);
  const mes = mesAtual();

  // Trava scroll do body quando qualquer modal/drawer está aberto
  useEffect(() => {
    if (modal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [modal]);
  const isPago = (id: string) => pagamentos.some(p => p.alunaId===id && p.mes===mes);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return alunas.filter(a => {
      const matchSearch = !q || a.nome.toLowerCase().includes(q) || (a.responsavel?.toLowerCase().includes(q));
      const matchMod = !fMod || a.modalidade===fMod;
      const pg = isPago(a.id);
      const isBolsista = !!(a as any).bolsista;
      const matchStat = !fStat || (fStat==="pago"&&pg) || (fStat==="inad"&&!pg&&!isBolsista) || (fStat==="bolsista"&&isBolsista);
      return matchSearch && matchMod && matchStat;
    });
  }, [alunas, pagamentos, search, fMod, fStat]);

  const openNew = () => { setEditId(null); setForm(emptyForm()); setDrawerTab("dados"); setModal("aluna"); };
  const openEdit = (a: Aluna) => { setEditId(a.id); setForm({...a}); setDrawerTab("dados"); setAvaliacoes([]); setModal("aluna"); };

  const loadAvaliacoes = async (alunaId: string) => {
    setLoadingAval(true);
    try { setAvaliacoes(await getAvaliacoes(alunaId)); }
    catch { onToast("Erro ao carregar avaliações", "danger"); }
    finally { setLoadingAval(false); }
  };

  const handleSaveAval = async () => {
    if (!avalForm.periodo || !editId) { onToast("Informe o período", "danger"); return; }
    setSavingAval(true);
    try {
      await addAvaliacao({ ...avalForm, id: genId(), alunaId: editId });
      onToast("Avaliação salva!", "success");
      setModalAval(false);
      await loadAvaliacoes(editId);
    } catch (e: any) { onToast(e.message, "danger"); }
    finally { setSavingAval(false); }
  };
  const openPagAluna = (id: string) => {
    const a = alunas.find(x=>x.id===id);
    setPagForm({ alunaId:id, mes:mesAtual(), data:new Date().toISOString().split("T")[0], valor:String(a?.valor||""), forma:"Pix", observacao:"" });
    setSearchAluna(a?.nome||"");
    setModal("pagamento");
  };

  const handleSaveAluna = async () => {
    if (!form.nome||!form.responsavel||!form.whatsapp||!form.valor||!form.modalidade) { onToast("Preencha os campos obrigatórios *","danger"); return; }
    setSaving(true);
    try {
      const data = {...form, id: editId||genId()};
      if (editId) { await updateAluna(editId,data); onToast("Aluna atualizada!","success"); }
      else { await saveAluna(data); onToast("Aluna cadastrada!","success"); }
      setModal(null); onRefresh();
    } catch(e:any) { onToast(e.message,"danger"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (a: Aluna) => {
    setConfirmDelete(a); // MELHORIA-2: modal de confirmação
  };

  const confirmDeleteAluna = async () => {
    if (!confirmDelete) return;
    try { 
      await deleteAluna(confirmDelete.id); 
      onToast(`${confirmDelete.nome} arquivada.`,"gold"); 
      setConfirmDelete(null);
      onRefresh(); 
    }
    catch(e:any) { onToast(e.message,"danger"); }
  };

  const handleSavePag = async () => {
    if (!pagForm.alunaId||!pagForm.valor) { onToast("Selecione a aluna e informe o valor","danger"); return; }
    setSaving(true);
    try {
      await savePagamento({ id:genId(), alunaId:pagForm.alunaId, mes:pagForm.mes, data:pagForm.data, valor:Number(pagForm.valor), forma:pagForm.forma, observacao:pagForm.observacao });
      onToast("✓ Pagamento registrado!","success");
      setModal(null); onRefresh();
      const a = alunas.find(x=>x.id===pagForm.alunaId);
      if (a?.whatsapp) {
        const wpp = a.whatsapp.replace(/\D/g,'');
        const msg = encodeURIComponent(`Olá ${a.responsavel||a.nome}! 🩰\n\nPagamento confirmado:\n• Aluna: ${a.nome}\n• Mês: ${pagForm.mes}\n• Valor: R$${Number(pagForm.valor).toFixed(2).replace('.',',')}\n• Forma: ${pagForm.forma}\n\nObrigada! ✦\nSplendore Escola de Dança`);
        if (confirm("Enviar confirmação por WhatsApp?")) window.open(`https://wa.me/55${wpp}?text=${msg}`,'_blank');
      }
    } catch(e:any) {
      onToast(e.message==="Pagamento já registrado para este mês"?"⚠️ Este mês já foi pago!":e.message,"danger");
    } finally { setSaving(false); }
  };

  const gerarCobranca = (a: Aluna) => {
    const wpp = (a.whatsapp||'').replace(/\D/g,'');
    const msg = `Olá, ${a.responsavel}! 🌸\n\nA mensalidade de *${a.nome}* de ${mes} ainda não foi identificada.\n\n💰 Valor: *${fmt(a.valor)}*\n📅 Vencimento: Dia ${a.vencimento}\n\nApós o pagamento, envie o comprovante aqui. 🙏\n*Splendore Escola de Dança* 🩰`;
    window.open(`https://wa.me/55${wpp}?text=${encodeURIComponent(msg)}`,'_blank');
  };

  const pagAlunasFiltradas = useMemo(() => alunas.filter(a=>a.nome.toLowerCase().includes(searchAluna.toLowerCase())).slice(0,8), [alunas,searchAluna]);
  const F = (key: keyof Aluna) => (e: any) => setForm(f=>({...f,[key]:e.target.value}));

  const statPago = filtered.filter(a=>isPago(a.id)).length;
  const statInad = filtered.filter(a=>!isPago(a.id) && !(a as any).bolsista).length;
  const statBolsista = alunas.filter(a=>(a as any).bolsista).length;

  const abrirTrocarTurma = (a: Aluna) => {
    setTurmaAluna(a);
    setTurmaForm({ modalidade: a.modalidade, nivel: a.nivel || "", turmaId: a.turmaId || "" });
    setModal("turma");
  };

  const salvarTurma = async () => {
    if (!turmaAluna) return;
    setSaving(true);
    try {
      await updateAluna(turmaAluna.id, {
        ...turmaAluna,
        modalidade: turmaForm.modalidade,
        nivel: turmaForm.nivel,
        turmaId: turmaForm.turmaId,
      });
      const nomeCurto = turmaAluna.nome.split(' ')[0];
      const turmaLabel = turmas.find(t => t.id === turmaForm.turmaId);
      onToast(`${nomeCurto} → ${turmaForm.modalidade}${turmaLabel ? ' · ' + turmaLabel.nome : ''}`, "success");
      setModal(null);
      setTurmaAluna(null);
      onRefresh();
    } catch(e: any) { onToast(e.message, "danger"); }
    finally { setSaving(false); }
  };

  const handleToggleBolsista = async (a: Aluna) => {
    const isBolsista = !!(a as any).bolsista;
    if (isBolsista) {
      // Reverter direto, sem modal
      if (!confirm(`Reverter ${a.nome.split(' ')[0]} para PAGANTE?\n\nO valor original (R${(a as any).valorOriginal || a.valor}) será restaurado.`)) return;
      try {
        await toggleBolsista(a.id, false);
        onToast(`${a.nome.split(' ')[0]} voltou a ser pagante`, "success");
        onRefresh();
      } catch(e:any) { onToast(e.message, "danger"); }
    } else {
      // Abrir modal de bolsa
      setBolsistaAluna(a);
      setBolsistaDesconto(100);
      setModal("bolsista");
    }
  };

  const confirmarBolsa = async () => {
    if (!bolsistaAluna) return;
    setSaving(true);
    try {
      const res = await toggleBolsista(bolsistaAluna.id, true, bolsistaDesconto);
      const msg = bolsistaDesconto >= 100
        ? `${bolsistaAluna.nome.split(' ')[0]} é bolsista 100% gratuita 🎓`
        : `${bolsistaAluna.nome.split(' ')[0]} tem ${bolsistaDesconto}% de desconto — novo valor: ${fmt(res.novoValor)}`;
      onToast(msg, "gold");
      setModal(null);
      setBolsistaAluna(null);
      onRefresh();
    } catch(e:any) { onToast(e.message, "danger"); }
    finally { setSaving(false); }
  };

  return (
    <div className="animate-fade-up">
      {/* Banner boleto após cadastro */}
      {boletoBanner && (
        <div style={{ background: "linear-gradient(135deg,#6C63FF,#4F46E5)", borderRadius: 14, padding: "18px 22px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 20px rgba(108,99,255,0.35)" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>✅ {boletoBanner.nome} cadastrada com sucesso!</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>Deseja gerar o boleto ou Pix de R${boletoBanner.valor.toFixed(2).replace(".",",")} agora?</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <button onClick={() => setBoletoBanner(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Agora não</button>
            <button onClick={() => { setBoletoBanner(null); if (onNavigate) onNavigate("cobrancas_efi"); }} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#fff", color: "#4F46E5", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>💳 Gerar Boleto/Pix</button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">Registro de Alunas</div>
          <div className="section-sub">{alunas.length} alunas · {statPago} em dia · {statInad} pendentes · {statBolsista} bolsista{statBolsista !== 1 ? "s" : ""}</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nova Aluna
        </button>
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <div className="search-wrap" style={{ flex:1, minWidth:200 }}>
          <span className="search-icon">🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar aluna ou responsável..." />
        </div>
        <select value={fMod} onChange={e=>setFMod(e.target.value)} style={{ width:180 }}>
          <option value="">Todas as modalidades</option>
          {MODALIDADES.map(m=><option key={m}>{m}</option>)}
        </select>
        <select value={fStat} onChange={e=>setFStat(e.target.value)} style={{ width:150 }}>
          <option value="">Todos os status</option>
          <option value="pago">Em dia</option>
          <option value="inad">Pendentes</option>
          <option value="bolsista">Bolsistas</option>
        </select>
      </div>

      {/* Table */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Alunas</div>
            <div className="panel-sub">{filtered.length} resultado{filtered.length!==1?"s":""}</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <span className="badge badge-green">✓ {statPago} em dia</span>
            <span className="badge badge-red">● {statInad} pendentes</span>
            <span className="badge" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>🎓 {statBolsista} bolsista{statBolsista !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table className="splendore-table">
            <thead>
              <tr>
                <th>Aluna</th><th>Responsável</th><th>WhatsApp</th>
                <th>Modalidade / Nível</th><th>Mensalidade</th><th>Venc.</th>
                <th>Status</th><th>CPF</th><th style={{ width:160 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const pg = isPago(a.id);
                const isBolsista = !!(a as any).bolsista;
                return (
                  <tr key={a.id} style={{ opacity: isBolsista ? 0.85 : 1 }}>
                    <td>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div className="avatar avatar-md" style={{ background: isBolsista?"#fef3c7":pg?"var(--green-bg)":"var(--red-bg)", color: isBolsista?"#b8923a":pg?"var(--green)":"var(--red)", overflow:"hidden", padding:0 }}>
                          {a.fotoUrl
                            ? <img src={`/api/portal/foto/${a.id}`} alt={a.nome} style={{ width:"100%",height:"100%",objectFit:"cover" }} onError={e=>{(e.target as any).style.display="none"}} />
                            : initials(a.nome)
                          }
                        </div>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13, display:"flex", alignItems:"center", gap:6 }}>
                            {a.nome}
                            {isBolsista && <span style={{ fontSize:9, background:"#fef3c7", color:"#92400e", padding:"1px 5px", borderRadius:6, fontWeight:700, letterSpacing:0.5 }}>BOLSISTA</span>}
                          </div>
                          {a.nivel && <div style={{ fontSize:11, color:"var(--text3)" }}>{a.nivel}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ color:"var(--text2)", fontSize:13 }}>{a.responsavel}</td>
                    <td>
                      <a href={`https://wa.me/55${(a.whatsapp||'').replace(/\D/g,'')}`} target="_blank" style={{ color:"#16A34A", fontSize:12, textDecoration:"none", display:"flex", alignItems:"center", gap:4 }}>
                        <span>📱</span>{a.whatsapp}
                      </a>
                    </td>
                    <td>
                      <span className={`chip ${chipClass(a.modalidade)}`}>{a.modalidade}</span>
                    </td>
                    <td style={{ fontWeight:700, fontSize:14 }}>{fmt(a.valor)}</td>
                    <td style={{ fontSize:12, color:"var(--text3)" }}>Dia {a.vencimento}</td>
                    <td>
                      {isBolsista
                        ? <span className="badge" style={{ background:"#fef3c7", color:"#92400e", border:"1px solid #fde68a" }}>🎓 Bolsista</span>
                        : <span className={`badge ${pg?"badge-green":"badge-red"}`}>{pg ? "✓ Em dia" : "● Pendente"}</span>
                      }
                    </td>
                    <td>
                      <span style={{ fontSize:11, fontWeight:600, color: a.cpfResponsavel?"var(--green)":"var(--red)" }}>
                        {a.cpfResponsavel ? "✓" : "✗"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                        {!pg && !isBolsista ? (
                          <>
                            <button className="btn btn-xs btn-success" onClick={()=>openPagAluna(a.id)}>💰</button>
                            <button className="btn btn-xs btn-secondary" onClick={()=>gerarCobranca(a)}>📱</button>
                          </>
                        ) : pg ? (
                          <span style={{ fontSize:11, color:"var(--text3)" }}>pago ✓</span>
                        ) : null}
                        <button
                          className="btn btn-xs"
                          title={isBolsista ? "Reverter para pagante" : "Tornar bolsista"}
                          onClick={()=>handleToggleBolsista(a)}
                          style={{ background: isBolsista?"#fef3c7":"var(--surface)", border: isBolsista?"1px solid #fde68a":"1px solid var(--border)", color: isBolsista?"#92400e":"var(--text2)" }}
                        >{isBolsista ? "↩ Pagante" : "🎓"}</button>
                        <button
                          className="btn btn-xs"
                          title="Trocar turma / modalidade"
                          onClick={() => abrirTrocarTurma(a)}
                          style={{ background:"var(--bg)", border:"1px solid var(--border)", color:"var(--text2)" }}
                        >🔄 Turma</button>
                        <button className="btn btn-xs btn-secondary" onClick={()=>openEdit(a)}>✎</button>
                        <button className="btn btn-xs btn-danger" onClick={()=>handleDelete(a)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={9} style={{ textAlign:"center", padding:48 }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>🔍</div>
                  <div style={{ fontSize:13, color:"var(--text3)" }}>Nenhuma aluna encontrada.</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRAWER ALUNA — renderizado no body via portal (evita problema de transform/stacking context da sidebar) */}
      {modal==="aluna" && createPortal(
        <>
          {/* Overlay */}
          <div onClick={()=>setModal(null)} style={{ position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",backdropFilter:"blur(4px)",zIndex:200 }} />
          {/* Drawer lateral direito */}
          <div style={{
            position:"fixed", top:0, right:0, bottom:0, zIndex:201,
            width:520, maxWidth:"95vw",
            background:"var(--surface)",
            display:"flex", flexDirection:"column",
            boxShadow:"-8px 0 40px rgba(0,0,0,0.15)",
            animation:"slideInRight 0.25s ease",
          }}>
            {/* Header fixo */}
            <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)", background:"var(--surface)", flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: editId ? 12 : 0 }}>
                <div>
                  <div style={{ fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"var(--gold-dark)" }}>
                    {editId?"Editar cadastro":"Novo cadastro"}
                  </div>
                  <div style={{ fontSize:18,fontWeight:800,color:"var(--text)",marginTop:1 }}>
                    {editId ? (form.nome||"Editar Aluna").split(' ')[0] : "Nova Aluna"}
                  </div>
                </div>
                <button onClick={()=>setModal(null)} style={{ width:32,height:32,borderRadius:8,background:"var(--bg2)",border:"1px solid var(--border)",cursor:"pointer",fontSize:16,color:"var(--text2)",display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
              </div>
              {/* Tabs — só aparece em modo edição */}
              {editId && (
                <div style={{ display:"flex", gap:6 }}>
                  {(["dados","evolucao"] as const).map(t => (
                    <button key={t} onClick={()=>{ setDrawerTab(t); if(t==="evolucao" && editId) loadAvaliacoes(editId); }}
                      style={{ padding:"6px 14px", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer",
                        background: drawerTab===t ? "var(--gold)" : "transparent",
                        border: drawerTab===t ? "none" : "1.5px solid var(--border)",
                        color: drawerTab===t ? "#fff" : "var(--text2)" }}>
                      {t==="dados" ? "📋 Dados" : "🩰 Evolução"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Corpo com scroll — gap menor, padding reduzido */}
            <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
            {drawerTab==="evolucao" && editId ? (
              <div>
                {/* Botão nova avaliação */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>Avaliações Pedagógicas</div>
                  <button onClick={()=>{ setAvalForm({ periodo:"", tecnica:5, ritmo:5, expressao:5, disciplina:5, evolucao:5, observacoes:"", professor:"" }); setModalAval(true); }}
                    style={{ padding:"7px 14px", background:"var(--gold)", border:"none", borderRadius:7, fontSize:12, fontWeight:700, color:"#fff", cursor:"pointer" }}>
                    + Nova Avaliação
                  </button>
                </div>
                {loadingAval ? (
                  <div style={{ textAlign:"center", padding:40, color:"var(--text2)" }}>Carregando...</div>
                ) : avaliacoes.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"40px 20px", color:"var(--text2)" }}>
                    <div style={{ fontSize:30, marginBottom:8 }}>🩰</div>
                    <div style={{ fontWeight:700, marginBottom:4 }}>Nenhuma avaliação</div>
                    <div style={{ fontSize:12 }}>Registre a evolução da aluna por período</div>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    {avaliacoes.map(av => {
                      const media = av.mediaGeral ?? 0;
                      const cor = media >= 8 ? "#16a34a" : media >= 5 ? "#f59e0b" : "#dc2626";
                      const criterios = [
                        { label:"Técnica", val: av.tecnica },
                        { label:"Ritmo", val: av.ritmo },
                        { label:"Expressão", val: av.expressao },
                        { label:"Disciplina", val: av.disciplina },
                        { label:"Evolução", val: av.evolucao },
                      ];
                      return (
                        <div key={av.id} style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:10, padding:"14px 16px" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                            <div>
                              <div style={{ fontWeight:800, fontSize:13, color:"var(--text)" }}>Período: {av.periodo}</div>
                              {av.professor && <div style={{ fontSize:11, color:"var(--text2)" }}>Prof. {av.professor}</div>}
                            </div>
                            <div style={{ padding:"4px 12px", borderRadius:20, fontSize:13, fontWeight:800, background:`${cor}18`, color:cor }}>
                              {media.toFixed(1)}
                            </div>
                          </div>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom: av.observacoes ? 10 : 0 }}>
                            {criterios.map(c => (
                              <div key={c.label} style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                                <span style={{ color:"var(--text2)" }}>{c.label}</span>
                                <span style={{ fontWeight:700, color:"var(--text)" }}>
                                  {c.val ?? "—"}/10
                                  <span style={{ display:"inline-block", marginLeft:4, width:32, height:4, borderRadius:2, background:"var(--border)", verticalAlign:"middle", position:"relative", overflow:"hidden" }}>
                                    <span style={{ position:"absolute", left:0, top:0, height:"100%", width:`${(c.val||0)*10}%`, background: cor, borderRadius:2 }} />
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                          {av.observacoes && (
                            <div style={{ fontSize:11, color:"var(--text2)", fontStyle:"italic", borderTop:"1px solid var(--border)", paddingTop:8 }}>
                              "{av.observacoes}"
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Modal nova avaliação */}
                {modalAval && (
                  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <div style={{ background:"var(--surface)", borderRadius:14, padding:24, width:420, maxWidth:"90vw" }}>
                      <div style={{ fontSize:15, fontWeight:800, color:"var(--text)", marginBottom:18 }}>Nova Avaliação</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                        <div>
                          <label style={{ fontSize:10, letterSpacing:1.4, textTransform:"uppercase", color:"var(--text2)", fontWeight:700, display:"block", marginBottom:4 }}>Período *</label>
                          <input value={avalForm.periodo} onChange={e=>setAvalForm(f=>({...f,periodo:e.target.value}))} placeholder="Ex: 2026-1" style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:7, padding:"9px 12px", color:"var(--text)", fontSize:13, fontFamily:"inherit", width:"100%" }} />
                        </div>
                        <div>
                          <label style={{ fontSize:10, letterSpacing:1.4, textTransform:"uppercase", color:"var(--text2)", fontWeight:700, display:"block", marginBottom:4 }}>Professor</label>
                          <input value={avalForm.professor} onChange={e=>setAvalForm(f=>({...f,professor:e.target.value}))} placeholder="Nome do professor" style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:7, padding:"9px 12px", color:"var(--text)", fontSize:13, fontFamily:"inherit", width:"100%" }} />
                        </div>
                        {([["tecnica","Técnica"],["ritmo","Ritmo"],["expressao","Expressão"],["disciplina","Disciplina"],["evolucao","Evolução"]] as [keyof typeof avalForm, string][]).map(([k,label]) => (
                          <div key={k}>
                            <label style={{ fontSize:10, letterSpacing:1.4, textTransform:"uppercase", color:"var(--text2)", fontWeight:700, display:"block", marginBottom:4 }}>{label}: <strong style={{ color:"var(--text)" }}>{avalForm[k]}</strong>/10</label>
                            <input type="range" min={1} max={10} value={Number(avalForm[k])} onChange={e=>setAvalForm(f=>({...f,[k]:parseInt(e.target.value)}))} style={{ width:"100%", accentColor:"var(--gold)" }} />
                          </div>
                        ))}
                        <div>
                          <label style={{ fontSize:10, letterSpacing:1.4, textTransform:"uppercase", color:"var(--text2)", fontWeight:700, display:"block", marginBottom:4 }}>Observações</label>
                          <textarea value={avalForm.observacoes} onChange={e=>setAvalForm(f=>({...f,observacoes:e.target.value}))} placeholder="Notas do professor sobre a aluna..." rows={3} style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:7, padding:"9px 12px", color:"var(--text)", fontSize:13, fontFamily:"inherit", width:"100%", resize:"vertical" }} />
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:10, marginTop:18 }}>
                        <button onClick={()=>setModalAval(false)} style={{ flex:1, padding:"10px 0", background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:8, fontSize:13, cursor:"pointer" }}>Cancelar</button>
                        <button onClick={handleSaveAval} disabled={savingAval} style={{ flex:1, padding:"10px 0", background:"var(--gold)", border:"none", borderRadius:8, fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer" }}>
                          {savingAval ? "Salvando..." : "Salvar"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>

                {/* Nome */}
                <div style={{ gridColumn:"span 2", display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={lbl}>Nome da Aluna *</label>
                  <input value={form.nome||""} onChange={F("nome")} placeholder="Nome completo" />
                </div>

                {/* Responsável + WhatsApp */}
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={lbl}>Responsável *</label>
                  <input value={form.responsavel||""} onChange={F("responsavel")} placeholder="Nome do responsável" />
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={lbl}>WhatsApp *</label>
                  <input value={form.whatsapp||""} onChange={F("whatsapp")} placeholder="(65) 99999-9999" type="tel" />
                </div>

                {/* Modalidade + Nível */}
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={lbl}>Modalidade *</label>
                  <select value={form.modalidade||""} onChange={F("modalidade")}>
                    {MODALIDADES.map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={lbl}>Nível</label>
                  <select value={form.nivel||""} onChange={F("nivel")}>
                    <option value="">—</option>
                    <option>Baby Class</option><option>Primary</option>
                    <option>Grau 1</option><option>Grau 2</option><option>Grau 3</option>
                    <option>Intermediário</option><option>Avançado</option>
                  </select>
                </div>

                {/* Mensalidade + Vencimento */}
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={lbl}>Mensalidade (R$) *</label>
                  <input value={form.valor||""} onChange={F("valor")} type="number" placeholder="160" />
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={lbl}>Dia de Vencimento</label>
                  <select value={form.vencimento||"10"} onChange={F("vencimento")}>
                    {["1","5","7","10","12","15","18","20","25","28"].map(d=><option key={d} value={d}>Dia {d}</option>)}
                  </select>
                </div>

                {/* Email + Nascimento */}
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={lbl}>E-mail</label>
                  <input value={form.email||""} onChange={F("email")} placeholder="email@exemplo.com" type="email" />
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={lbl}>Nascimento</label>
                  <input value={form.nascimento||""} onChange={F("nascimento")} type="date" />
                </div>

                {/* CPF + CPF2 — numa linha só com tamanho reduzido */}
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={lbl}>CPF Responsável</label>
                  <input value={form.cpfResponsavel||""} onChange={F("cpfResponsavel")} placeholder="000.000.000-00" />
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={lbl}>CPF 2º Responsável</label>
                  <input value={form.cpfResponsavel2||""} onChange={F("cpfResponsavel2")} placeholder="Opcional" />
                </div>

                {/* Contrato */}
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={lbl}>Início do Contrato</label>
                  <input value={form.contratoDe||""} onChange={F("contratoDe")} type="date" />
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={lbl}>Fim do Contrato</label>
                  <input value={form.contratoAte||""} onChange={F("contratoAte")} type="date" />
                </div>

                {/* Bolsista — compacto */}
                <div style={{ gridColumn:"span 2", padding:"10px 14px", background:(form as any).bolsista?"#fffbeb":"var(--bg)", borderRadius:8, border:(form as any).bolsista?"1.5px solid #fde68a":"1.5px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:(form as any).bolsista?"#92400e":"var(--text2)" }}>
                    {(form as any).bolsista ? "🎓 Bolsista — mensalidade suspensa" : "💳 Aluna Pagante"}
                  </div>
                  <div style={{ display:"flex", gap:12 }}>
                    <label style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", fontSize:12, fontWeight:600 }}>
                      <input type="radio" name="tipoAluna" checked={!(form as any).bolsista} onChange={()=>setForm(f=>({...f,bolsista:false}))} /> Pagante
                    </label>
                    <label style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", fontSize:12, fontWeight:600, color:"#92400e" }}>
                      <input type="radio" name="tipoAluna" checked={!!(form as any).bolsista} onChange={()=>setForm(f=>({...f,bolsista:true}))} /> Bolsista
                    </label>
                  </div>
                </div>

                {/* Observações */}
                <div style={{ gridColumn:"span 2", display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={lbl}>Observações</label>
                  <textarea value={form.observacao||""} onChange={F("observacao")} rows={2} placeholder="Informações adicionais..." style={{ resize:"none" }} />
                </div>
              </div>
            )}
            </div>

            {/* Footer fixo — só mostra quando na aba dados */}
            {drawerTab === "dados" && (
            <div style={{ padding:"12px 20px", borderTop:"1px solid var(--border)", background:"var(--surface2)", flexShrink:0, display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button className="btn btn-secondary" onClick={()=>setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveAluna} disabled={saving} style={{ minWidth:140 }}>
                {saving
                  ? <><div className="spinner" style={{width:13,height:13}}/> Salvando...</>
                  : editId ? "✓ Salvar Alterações" : "✓ Cadastrar Aluna"
                }
              </button>
            </div>
            )}
          </div>
          <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
        </>,
        document.body
      )}

      {/* MODAL PAGAMENTO */}
      {modal==="pagamento" && createPortal(
        <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
          <div className="modal-box" style={{ maxWidth:480 }}>
            <button onClick={()=>setModal(null)} style={{ position:"absolute",top:16,right:16,width:28,height:28,borderRadius:"50%",background:"var(--bg2)",border:"none",cursor:"pointer",fontSize:14 }}>✕</button>
            <div style={{ fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"var(--green)",marginBottom:4 }}>Financeiro</div>
            <div style={{ fontSize:20,fontWeight:800,marginBottom:22,color:"var(--text)" }}>Registrar Pagamento</div>

            {/* Typeahead aluna */}
            <div style={{ marginBottom:14, position:"relative" }}>
              <label style={{ fontSize:11,fontWeight:700,color:"var(--text2)",display:"block",marginBottom:6 }}>Aluna *</label>
              <input value={searchAluna} onChange={e=>{setSearchAluna(e.target.value);setPagForm(f=>({...f,alunaId:""}));}} placeholder="Digite o nome da aluna..." />
              {searchAluna && !pagForm.alunaId && pagAlunasFiltradas.length>0 && (
                <div style={{ position:"absolute",top:"100%",left:0,right:0,zIndex:10,background:"var(--surface)",border:"1.5px solid var(--border)",borderRadius:"0 0 var(--r-sm) var(--r-sm)",boxShadow:"var(--shadow-md)",maxHeight:220,overflowY:"auto" }}>
                  {pagAlunasFiltradas.map(a=>(
                    <div key={a.id} onClick={()=>{setPagForm(f=>({...f,alunaId:a.id,valor:String(a.valor)}));setSearchAluna(a.nome);}}
                      style={{ padding:"10px 14px",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid var(--border)" }}
                      onMouseEnter={e=>(e.currentTarget.style.background="var(--bg)")}
                      onMouseLeave={e=>(e.currentTarget.style.background="")}
                    >
                      <div className="avatar avatar-sm" style={{ background:"var(--gold-bg)",color:"var(--gold-dark)" }}>{initials(a.nome)}</div>
                      <span style={{ flex:1,fontWeight:500 }}>{a.nome}</span>
                      <span style={{ fontSize:11,color:"var(--text3)" }}>{a.modalidade}</span>
                      <span style={{ fontWeight:700,color:"var(--gold-dark)" }}>{fmt(a.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
              {[
                {label:"Mês de Referência *",key:"mes",type:"month"},
                {label:"Data do Pagamento *",key:"data",type:"date"},
              ].map(({label,key,type})=>(
                <div key={key} style={{ display:"flex",flexDirection:"column",gap:5 }}>
                  <label style={{ fontSize:11,fontWeight:700,color:"var(--text2)" }}>{label}</label>
                  <input value={(pagForm as any)[key]} onChange={e=>setPagForm(f=>({...f,[key]:e.target.value}))} type={type} />
                </div>
              ))}
              <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                <label style={{ fontSize:11,fontWeight:700,color:"var(--text2)" }}>Valor (R$) *</label>
                <input value={pagForm.valor} onChange={e=>setPagForm(f=>({...f,valor:e.target.value}))} type="number" placeholder="160" />
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                <label style={{ fontSize:11,fontWeight:700,color:"var(--text2)" }}>Forma de Pagamento</label>
                <select value={pagForm.forma} onChange={e=>setPagForm(f=>({...f,forma:e.target.value}))}>
                  <option>Pix</option><option>Dinheiro</option><option>Cartão Débito</option><option>Cartão Crédito</option>
                </select>
              </div>
              <div style={{ gridColumn:"span 2",display:"flex",flexDirection:"column",gap:5 }}>
                <label style={{ fontSize:11,fontWeight:700,color:"var(--text2)" }}>Observação</label>
                <input value={pagForm.observacao} onChange={e=>setPagForm(f=>({...f,observacao:e.target.value}))} placeholder="Opcional..." />
              </div>
            </div>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end",marginTop:22,paddingTop:16,borderTop:"1px solid var(--border)" }}>
              <button className="btn btn-secondary" onClick={()=>setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSavePag} disabled={saving||!pagForm.alunaId} style={{ opacity:(!pagForm.alunaId||saving)?0.6:1 }}>
                {saving?"Registrando...":"✓ Confirmar Pagamento"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL TROCAR TURMA / MODALIDADE ─────────────────────────────── */}
      {modal === "turma" && turmaAluna && createPortal(
        <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget){setModal(null);setTurmaAluna(null);}}}>
          <div className="modal-box" style={{ maxWidth: 440 }}>
            <button onClick={()=>{setModal(null);setTurmaAluna(null);}} style={{ position:"absolute",top:16,right:16,width:28,height:28,borderRadius:"50%",background:"var(--bg2)",border:"none",cursor:"pointer",fontSize:14 }}>✕</button>

            <div style={{ fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"var(--gold-dark)",marginBottom:4 }}>Alterar Turma</div>
            <div style={{ fontSize:20,fontWeight:800,marginBottom:4,color:"var(--text)" }}>
              {turmaAluna.nome.split(' ').slice(0,2).join(' ')}
            </div>
            <div style={{ fontSize:12,color:"var(--text3)",marginBottom:22 }}>
              Atual: <strong>{turmaAluna.modalidade}</strong>{turmaAluna.nivel ? ` · ${turmaAluna.nivel}` : ''}{turmaAluna.turmaId && turmas.find(t=>t.id===turmaAluna.turmaId) ? ` · ${turmas.find(t=>t.id===turmaAluna.turmaId)?.nome}` : ''}
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {/* Modalidade */}
              <div>
                <label style={{ fontSize:11,fontWeight:700,color:"var(--text2)",textTransform:"uppercase",letterSpacing:0.5,display:"block",marginBottom:6 }}>Modalidade</label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {MODALIDADES.map(m => (
                    <button key={m} onClick={()=>setTurmaForm(f=>({...f,modalidade:m,turmaId:""}))} style={{
                      padding:"8px 16px", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer",
                      background: turmaForm.modalidade===m ? "var(--text)" : "var(--bg)",
                      color: turmaForm.modalidade===m ? "var(--surface)" : "var(--text2)",
                      border: turmaForm.modalidade===m ? "none" : "1.5px solid var(--border)",
                      transition:"all 0.15s",
                    }}>{m}</button>
                  ))}
                </div>
              </div>

              {/* Nível */}
              <div>
                <label style={{ fontSize:11,fontWeight:700,color:"var(--text2)",textTransform:"uppercase",letterSpacing:0.5,display:"block",marginBottom:6 }}>Nível</label>
                <select value={turmaForm.nivel} onChange={e=>setTurmaForm(f=>({...f,nivel:e.target.value}))} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", fontSize:13, fontFamily:"inherit", color:"var(--text)", background:"var(--surface)" }}>
                  <option value="">— Sem nível —</option>
                  <option>Baby Class</option><option>Primary</option>
                  <option>Grau 1</option><option>Grau 2</option><option>Grau 3</option>
                  <option>Intermediário</option><option>Avançado</option>
                </select>
              </div>

              {/* Turma (filtrada pela modalidade selecionada) */}
              <div>
                <label style={{ fontSize:11,fontWeight:700,color:"var(--text2)",textTransform:"uppercase",letterSpacing:0.5,display:"block",marginBottom:6 }}>Turma</label>
                {turmas.filter(t => !turmaForm.modalidade || t.modalidade === turmaForm.modalidade).length > 0 ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:200, overflowY:"auto" }}>
                    <button onClick={()=>setTurmaForm(f=>({...f,turmaId:""}))} style={{
                      padding:"10px 14px", borderRadius:10, fontSize:13, cursor:"pointer", textAlign:"left",
                      background: !turmaForm.turmaId ? "var(--gold-bg)" : "var(--bg)",
                      border: !turmaForm.turmaId ? "1.5px solid var(--gold)" : "1.5px solid var(--border)",
                      color: !turmaForm.turmaId ? "var(--gold-dark)" : "var(--text2)",
                      fontWeight: !turmaForm.turmaId ? 700 : 400,
                    }}>Sem turma específica</button>
                    {turmas
                      .filter(t => !turmaForm.modalidade || t.modalidade === turmaForm.modalidade)
                      .map(t => (
                        <button key={t.id} onClick={()=>setTurmaForm(f=>({...f,turmaId:t.id}))} style={{
                          padding:"10px 14px", borderRadius:10, fontSize:13, cursor:"pointer", textAlign:"left",
                          background: turmaForm.turmaId===t.id ? "var(--gold-bg)" : "var(--bg)",
                          border: turmaForm.turmaId===t.id ? "1.5px solid var(--gold)" : "1.5px solid var(--border)",
                          color: turmaForm.turmaId===t.id ? "var(--gold-dark)" : "var(--text2)",
                          fontWeight: turmaForm.turmaId===t.id ? 700 : 400, fontFamily:"inherit",
                        }}>
                          <div style={{ fontWeight:600 }}>{t.nome}</div>
                          <div style={{ fontSize:11, opacity:0.6, marginTop:2 }}>
                            {t.dias}{t.horario ? ` · ${t.horario}` : ''}{t.professor ? ` · ${t.professor}` : ''}
                          </div>
                        </button>
                      ))
                    }
                  </div>
                ) : (
                  <div style={{ fontSize:12, color:"var(--text3)", padding:"10px 0" }}>
                    Nenhuma turma cadastrada para {turmaForm.modalidade}. Vá em <strong>Turmas & Horários</strong> para criar.
                  </div>
                )}
              </div>
            </div>

            {/* Preview da mudança */}
            {(turmaForm.modalidade !== turmaAluna.modalidade || turmaForm.nivel !== (turmaAluna.nivel||'') || turmaForm.turmaId !== (turmaAluna.turmaId||'')) && (
              <div style={{ marginTop:18, padding:"12px 14px", background:"rgba(61,122,114,0.07)", border:"1px solid rgba(61,122,114,0.2)", borderRadius:10, fontSize:12, color:"var(--text2)" }}>
                <strong>Mudança:</strong>{' '}
                {turmaAluna.modalidade} → <strong>{turmaForm.modalidade}</strong>
                {turmaForm.nivel && ` · ${turmaForm.nivel}`}
                {turmaForm.turmaId && turmas.find(t=>t.id===turmaForm.turmaId) && ` · ${turmas.find(t=>t.id===turmaForm.turmaId)?.nome}`}
              </div>
            )}

            <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:22, paddingTop:16, borderTop:"1px solid var(--border)" }}>
              <button className="btn btn-secondary" onClick={()=>{setModal(null);setTurmaAluna(null);}}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarTurma} disabled={saving} style={{ minWidth:140 }}>
                {saving ? "Salvando..." : "✓ Salvar Turma"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {modal === "bolsista" && bolsistaAluna && createPortal(
        <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget){setModal(null);setBolsistaAluna(null);}}}>
          <div className="modal-box" style={{ maxWidth: 460 }}>
            <button onClick={()=>{setModal(null);setBolsistaAluna(null);}} style={{ position:"absolute",top:16,right:16,width:28,height:28,borderRadius:"50%",background:"var(--bg2)",border:"none",cursor:"pointer",fontSize:14 }}>✕</button>

            {/* Header */}
            <div style={{ fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#92400e",marginBottom:4 }}>Bolsa de Estudos</div>
            <div style={{ fontSize:20,fontWeight:800,marginBottom:6,color:"var(--text)" }}>
              🎓 {bolsistaAluna.nome.split(' ').slice(0,2).join(' ')}
            </div>
            <div style={{ fontSize:12,color:"var(--text3)",marginBottom:24 }}>
              Valor atual: <strong>{fmt(bolsistaAluna.valor)}</strong> · {bolsistaAluna.modalidade}
            </div>

            {/* Opções rápidas */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11,fontWeight:700,color:"var(--text2)",textTransform:"uppercase",letterSpacing:0.5,marginBottom:10 }}>Tipo de Bolsa</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {[
                  { label:"25% desconto", val:25, sub:`Paga ${fmt(bolsistaAluna.valor * 0.75)}` },
                  { label:"50% desconto", val:50, sub:`Paga ${fmt(bolsistaAluna.valor * 0.50)}` },
                  { label:"75% desconto", val:75, sub:`Paga ${fmt(bolsistaAluna.valor * 0.25)}` },
                  { label:"100% gratuita", val:100, sub:"Paga R$ 0,00" },
                ].map(op => (
                  <button key={op.val} onClick={()=>setBolsistaDesconto(op.val)} style={{
                    flex:"1 1 calc(50% - 4px)", padding:"12px 10px", borderRadius:10, cursor:"pointer",
                    background: bolsistaDesconto===op.val ? (op.val===100?"#1e2d2b":"#fffbeb") : "var(--bg)",
                    border: bolsistaDesconto===op.val ? `2px solid ${op.val===100?"#3d7a72":"#fde68a"}` : "2px solid var(--border)",
                    color: bolsistaDesconto===op.val ? (op.val===100?"#d4af64":"#92400e") : "var(--text2)",
                    transition:"all 0.15s", textAlign:"left",
                  }}>
                    <div style={{ fontWeight:700, fontSize:13 }}>{op.label}</div>
                    <div style={{ fontSize:11, opacity:0.7, marginTop:2 }}>{op.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Slider personalizado */}
            <div style={{ marginBottom:24 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:11,fontWeight:700,color:"var(--text2)",textTransform:"uppercase",letterSpacing:0.5 }}>Percentual personalizado</div>
                <div style={{ fontSize:16,fontWeight:900,color: bolsistaDesconto===100?"#3d7a72":"#92400e" }}>
                  {bolsistaDesconto}%
                </div>
              </div>
              <input
                type="range"
                min={0} max={100} step={5}
                value={bolsistaDesconto}
                onChange={e=>setBolsistaDesconto(Number(e.target.value))}
                style={{ width:"100%", accentColor: bolsistaDesconto===100?"#3d7a72":"#b8923a" }}
              />
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--text3)", marginTop:4 }}>
                <span>0% (sem desconto)</span>
                <span>100% (gratuita)</span>
              </div>
            </div>

            {/* Preview do resultado */}
            <div style={{ background: bolsistaDesconto>=100?"rgba(61,122,114,0.08)":"rgba(184,146,58,0.08)", border:`1px solid ${bolsistaDesconto>=100?"rgba(61,122,114,0.2)":"rgba(184,146,58,0.2)"}`, borderRadius:10, padding:"14px 16px", marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:11, color:"var(--text3)", marginBottom:2 }}>Valor original</div>
                  <div style={{ fontSize:14, color:"var(--text3)", textDecoration:"line-through" }}>{fmt(bolsistaAluna.valor)}</div>
                </div>
                <div style={{ fontSize:22, color:"var(--text3)" }}>→</div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:11, color:"var(--text3)", marginBottom:2 }}>Novo valor</div>
                  <div style={{ fontSize:22, fontWeight:900, color: bolsistaDesconto>=100?"#3d7a72":"#b8923a", fontFamily:"'Cormorant Garamond',serif" }}>
                    {bolsistaDesconto>=100 ? "GRATUITA" : fmt(Math.round(bolsistaAluna.valor*(1-bolsistaDesconto/100)*100)/100)}
                  </div>
                </div>
              </div>
              {bolsistaDesconto > 0 && (
                <div style={{ marginTop:8, fontSize:11, color:"var(--text3)", borderTop:"1px solid rgba(0,0,0,0.06)", paddingTop:8 }}>
                  {bolsistaDesconto>=100
                    ? "✓ Mensalidades suspensas · Gratuidade total · Histórico preservado"
                    : `✓ Desconto de ${fmt(bolsistaAluna.valor * bolsistaDesconto/100)} aplicado · Histórico preservado`
                  }
                </div>
              )}
            </div>

            {bolsistaDesconto === 0 && (
              <div style={{ background:"rgba(220,38,38,0.06)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:8, padding:"10px 14px", fontSize:12, color:"var(--red)", marginBottom:16 }}>
                ⚠ Com 0% de desconto a aluna continua pagante normalmente. Ajuste o percentual.
              </div>
            )}

            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button className="btn btn-secondary" onClick={()=>{setModal(null);setBolsistaAluna(null);}}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={confirmarBolsa}
                disabled={saving || bolsistaDesconto===0}
                style={{ minWidth:160, background: bolsistaDesconto>=100?"linear-gradient(135deg,#1e2d2b,#3d7a72)":undefined }}
              >
                {saving ? "Salvando..." : bolsistaDesconto>=100 ? "🎓 Bolsa 100% Gratuita" : `🎓 Aplicar ${bolsistaDesconto}% Desconto`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MELHORIA-2: Modal de confirmação antes de deletar */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        title={`Arquivar ${confirmDelete?.nome}?`}
        message="Esta aluna será movida para o Arquivo Morto. Você tem certeza?"
        buttonText="Sim, arquivar"
        isDangerous={true}
        onConfirm={confirmDeleteAluna}
        onCancel={() => setConfirmDelete(null)}
      />
    {contratoAluna && (
      <ContratoModal
        aluna={contratoAluna}
        onClose={() => setContratoAluna(null)}
        onSuccess={() => { setContratoAluna(null); onRefresh(); }}
        onToast={onToast}
      />
    )}
    </div>
  );
}

// ── Shared label style usado no drawer
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "var(--text2)", letterSpacing: 0.3,
};
