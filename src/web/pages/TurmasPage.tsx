import { useState, useMemo } from "react";
import { fmt, initials } from "../lib/api";
import { saveTurma, updateTurma, deleteTurma } from "../lib/api";
import type { Turma, Aluna } from "../types";

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const DIAS_SEMANA = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const MODALIDADES = ['Ballet','Jazz','Danças Urbanas','Outra'];

interface Props {
  turmas: Turma[];
  alunas: Aluna[];
  onRefresh: () => void;
  onToast: (msg: string, type?: "success"|"danger"|"gold") => void;
}

const emptyForm = (): Partial<Turma> => ({
  nome:'', modalidade:'Ballet', nivel:'', dias:'',
  horario:'', professor:'', vagas: undefined, faixaEtaria:'', observacao:''
});

export function TurmasPage({ turmas, alunas, onRefresh, onToast }: Props) {
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState<Partial<Turma>>(emptyForm());
  const [diasSel, setDiasSel] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditId(null); setForm(emptyForm()); setDiasSel([]); setModal(true); };
  const openEdit = (t: Turma) => {
    setEditId(t.id);
    setForm({ ...t });
    setDiasSel(t.dias ? t.dias.split('/').filter(Boolean) : []);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.nome || !form.modalidade) { onToast("Preencha nome e modalidade","danger"); return; }
    setSaving(true);
    try {
      if (editId) {
        await updateTurma(editId, { ...form, dias: diasSel.join('/') });
      } else {
        await saveTurma({ ...form, id: genId(), dias: diasSel.join('/') });
      }
      onToast(editId ? "Turma atualizada!" : "Turma cadastrada!", "success");
      setModal(false);
      onRefresh();
    } catch(e:any) { onToast(e.message,"danger"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (t: Turma) => {
    const cnt = alunas.filter(a => a.turmaId === t.id).length;
    if (!confirm(`Excluir "${t.nome}"?${cnt > 0 ? `\n\n⚠️ ${cnt} aluna(s) estão nesta turma.` : ''}`)) return;
    try {
      await deleteTurma(t.id);
      onToast("Turma excluída.","gold");
      onRefresh();
    } catch(e:any) { onToast(e.message,"danger"); }
  };

  const F = (key: keyof Turma) => (e: any) => setForm(f => ({ ...f, [key]: e.target.value }));
  const toggleDia = (d: string) => setDiasSel(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev,d]);

  const modColors: Record<string,string> = { Ballet:'#C9A86A', Jazz:'#DC2626', 'Danças Urbanas':'#2563EB', Outra:'#16A34A' };

  return (
    <div className="animate-fade-up">
      <div className="section-header">
        <div>
          <div className="section-title">Turmas & Horários</div>
          <div className="section-sub">{turmas.length} turmas cadastradas</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nova Turma</button>
      </div>

      {!turmas.length ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>
          <div style={{ fontSize:48, marginBottom:16, opacity:0.2 }}>🎭</div>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--text2)', marginBottom:8 }}>Nenhuma turma cadastrada</div>
          <div style={{ fontSize:13, marginBottom:24 }}>Crie turmas para organizar suas alunas por horário e nível.</div>
          <button className="btn btn-primary" onClick={openNew}>+ Criar primeira turma</button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
          {turmas.map(t => {
            const cnt = alunas.filter(a => a.turmaId === t.id).length;
            const pct = t.vagas ? Math.min(Math.round(cnt/t.vagas*100), 100) : 0;
            const cor = modColors[t.modalidade] || '#64748B';
            return (
              <div key={t.id} className="card card-hover" style={{ padding:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                      <div style={{ width:10, height:10, borderRadius:3, background:cor, flexShrink:0 }} />
                      <span style={{ fontSize:16, fontWeight:800, color:'var(--text)' }}>{t.nome}</span>
                    </div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      <span style={{ padding:'2px 9px', borderRadius:99, fontSize:11, fontWeight:600, background:`${cor}15`, color:cor, border:`1px solid ${cor}30` }}>{t.modalidade}</span>
                      {t.nivel && <span className="badge badge-gray" style={{ fontSize:11 }}>{t.nivel}</span>}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => openEdit(t)} className="btn btn-secondary btn-xs">✎</button>
                    <button onClick={() => handleDelete(t)} className="btn btn-danger btn-xs">✕</button>
                  </div>
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:13, color:'var(--text2)' }}>
                  {t.dias && <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:14 }}>📅</span>
                    <span>{t.dias}</span>
                    {t.horario && <span style={{ color:'var(--text3)' }}>· {t.horario}</span>}
                  </div>}
                  {t.professor && <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:14 }}>👤</span>
                    <span>Prof. {t.professor}</span>
                  </div>}
                  {t.faixaEtaria && <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:14 }}>🎂</span>
                    <span>{t.faixaEtaria}</span>
                  </div>}
                </div>

                <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <span style={{ fontSize:12, color:'var(--text3)', fontWeight:600 }}>Alunas</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>
                      {cnt}{t.vagas ? `/${t.vagas}` : ''} aluna{cnt!==1?'s':''}
                    </span>
                  </div>
                  {t.vagas && (
                    <div style={{ height:5, background:'var(--bg2)', borderRadius:99, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, borderRadius:99, background: pct>=90 ? 'var(--red)' : pct>=70 ? 'var(--amber)' : 'var(--green)', transition:'width 0.4s' }} />
                    </div>
                  )}
                </div>

                {/* Mini lista de alunas */}
                {cnt > 0 && (
                  <div style={{ marginTop:10, display:'flex', gap:4, flexWrap:'wrap' }}>
                    {alunas.filter(a=>a.turmaId===t.id).slice(0,6).map(a => (
                      <div key={a.id} title={a.nome} style={{ width:28, height:28, borderRadius:'50%', background:'var(--gold-bg)', color:'var(--gold-dark)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, border:'1.5px solid var(--border)' }}>
                        {initials(a.nome)}
                      </div>
                    ))}
                    {cnt > 6 && <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--bg2)', color:'var(--text3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, border:'1.5px solid var(--border)' }}>+{cnt-6}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          {/* Drawer lateral */}
          <div style={{ position:'fixed', top:0, right:0, bottom:0, width:480, maxWidth:'95vw', background:'var(--surface)', display:'flex', flexDirection:'column', boxShadow:'-8px 0 40px rgba(0,0,0,0.12)', animation:'slideInRight 0.25s ease', zIndex:201 }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'var(--gold-dark)' }}>Turma</div>
                <div style={{ fontSize:19, fontWeight:800, color:'var(--text)', marginTop:2 }}>{editId ? 'Editar Turma' : 'Nova Turma'}</div>
              </div>
              <button onClick={()=>setModal(false)} style={{ width:32, height:32, borderRadius:10, background:'var(--bg2)', border:'1px solid var(--border)', cursor:'pointer', fontSize:14 }}>✕</button>
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div style={{ gridColumn:'span 2', display:'flex', flexDirection:'column', gap:5 }}>
                  <label style={lbl}>Nome da Turma *</label>
                  <input value={form.nome||''} onChange={F('nome')} placeholder="Ex: Ballet Grau 1 — Manhã" />
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <label style={lbl}>Modalidade *</label>
                  <select value={form.modalidade||''} onChange={F('modalidade')}>
                    {MODALIDADES.map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <label style={lbl}>Nível</label>
                  <select value={form.nivel||''} onChange={F('nivel')}>
                    <option value="">—</option>
                    <option>Baby Class</option><option>Primary</option>
                    <option>Grau 1</option><option>Grau 2</option><option>Grau 3</option>
                    <option>Intermediário</option><option>Avançado</option>
                  </select>
                </div>
                <div style={{ gridColumn:'span 2', display:'flex', flexDirection:'column', gap:8 }}>
                  <label style={lbl}>Dias da semana</label>
                  <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                    {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((d,i) => {
                      const full = DIAS_SEMANA[i];
                      const sel = diasSel.includes(d);
                      return (
                        <button key={d} type="button" onClick={()=>toggleDia(d)} style={{
                          padding:'7px 13px', borderRadius:8, border:`1.5px solid ${sel?'var(--gold)':'var(--border)'}`,
                          background: sel?'var(--gold-bg)':'var(--surface)', color: sel?'var(--gold-dark)':'var(--text3)',
                          fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                        }}>{d}</button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <label style={lbl}>Horário</label>
                  <input value={form.horario||''} onChange={F('horario')} placeholder="Ex: 18:00 - 19:00" />
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <label style={lbl}>Professor(a)</label>
                  <input value={form.professor||''} onChange={F('professor')} placeholder="Nome do professor" />
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <label style={lbl}>Máximo de vagas</label>
                  <input value={form.vagas||''} onChange={F('vagas')} type="number" placeholder="Ex: 20" />
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <label style={lbl}>Faixa etária</label>
                  <input value={form.faixaEtaria||''} onChange={F('faixaEtaria')} placeholder="Ex: 6 a 12 anos" />
                </div>
                <div style={{ gridColumn:'span 2', display:'flex', flexDirection:'column', gap:5 }}>
                  <label style={lbl}>Observações</label>
                  <textarea value={form.observacao||''} onChange={F('observacao')} rows={2} placeholder="Informações adicionais..." />
                </div>
              </div>
            </div>

            <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', background:'var(--surface2)', display:'flex', gap:10, justifyContent:'flex-end', flexShrink:0 }}>
              <button className="btn btn-secondary" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth:140 }}>
                {saving ? 'Salvando...' : editId ? '✓ Salvar' : '✓ Criar Turma'}
              </button>
            </div>
          </div>
          <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize:11, fontWeight:700, color:'var(--text2)', letterSpacing:0.3 };
