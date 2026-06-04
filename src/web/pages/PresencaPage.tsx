import { useState, useEffect, useMemo } from "react";
import { initials } from "../lib/api";
import type { Turma, Aluna } from "../types";

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

interface Props {
  turmas: Turma[];
  alunas: Aluna[];
  onToast: (msg: string, type?: "success"|"danger"|"gold") => void;
}

interface Presenca { id: string; alunaId: string; turmaId: string; data: string; presente: boolean; }

export function PresencaPage({ turmas, alunas, onToast }: Props) {
  const [turmaSel, setTurmaSel] = useState<string>('');
  const [data, setData] = useState(() => new Date().toISOString().split('T')[0]);
  const [presencas, setPresencas] = useState<Record<string, boolean>>({});
  const [loadingPresenca, setLoadingPresenca] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const alunasDaTurma = useMemo(() =>
    turmaSel ? alunas.filter(a => a.turmaId === turmaSel) : [],
    [alunas, turmaSel]
  );

  // Carregar presenças existentes quando mudar turma/data
  useEffect(() => {
    if (!turmaSel || !data) return;
    setLoadingPresenca(true);
    setSaved(false);
    fetch(`/api/presencas/${turmaSel}/${data}`)
      .then(r => r.json())
      .then((lista: Presenca[]) => {
        const map: Record<string, boolean> = {};
        // Inicializar todas como presente
        alunas.filter(a => a.turmaId === turmaSel).forEach(a => { map[a.id] = true; });
        // Aplicar o que está salvo
        lista.forEach(p => { map[p.alunaId] = p.presente; });
        setPresencas(map);
      })
      .catch(() => {
        const map: Record<string, boolean> = {};
        alunas.filter(a => a.turmaId === turmaSel).forEach(a => { map[a.id] = true; });
        setPresencas(map);
      })
      .finally(() => setLoadingPresenca(false));
  }, [turmaSel, data]);

  const toggle = (alunaId: string) => {
    setPresencas(p => ({ ...p, [alunaId]: !p[alunaId] }));
    setSaved(false);
  };

  const marcarTodas = (presente: boolean) => {
    const map: Record<string, boolean> = {};
    alunasDaTurma.forEach(a => { map[a.id] = presente; });
    setPresencas(map);
    setSaved(false);
  };

  const salvarPresenca = async () => {
    if (!turmaSel || !data) return;
    setSaving(true);
    try {
      const promises = alunasDaTurma.map(a =>
        fetch('/api/presencas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: genId(), alunaId: a.id, turmaId: turmaSel, data, presente: presencas[a.id] ?? true }),
        })
      );
      await Promise.all(promises);
      setSaved(true);
      onToast(`✓ Presença salva — ${data}`, "success");
    } catch(e:any) {
      onToast(e.message, "danger");
    } finally {
      setSaving(false);
    }
  };

  const presentes = alunasDaTurma.filter(a => presencas[a.id] !== false).length;
  const ausentes  = alunasDaTurma.filter(a => presencas[a.id] === false).length;

  return (
    <div className="animate-fade-up">
      <div className="section-header">
        <div>
          <div className="section-title">Controle de Presença</div>
          <div className="section-sub">Registre a chamada por turma</div>
        </div>
      </div>

      {/* Seleção turma + data */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:200, display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5 }}>Turma</label>
          <select value={turmaSel} onChange={e=>setTurmaSel(e.target.value)} style={{ padding:'10px 12px' }}>
            <option value="">Selecione a turma...</option>
            {turmas.map(t => (
              <option key={t.id} value={t.id}>
                {t.nome} {t.dias ? `(${t.dias}${t.horario ? ' '+t.horario : ''})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5 }}>Data da aula</label>
          <input type="date" value={data} onChange={e=>setData(e.target.value)} style={{ padding:'10px 12px' }} />
        </div>
      </div>

      {!turmaSel ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>
          <div style={{ fontSize:40, marginBottom:12, opacity:0.2 }}>✓</div>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text2)' }}>Selecione uma turma para iniciar a chamada</div>
        </div>
      ) : loadingPresenca ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:48, gap:12, color:'var(--text3)' }}>
          <div className="spinner" /> Carregando...
        </div>
      ) : !alunasDaTurma.length ? (
        <div style={{ textAlign:'center', padding:48, color:'var(--text3)', fontSize:13 }}>
          <div style={{ fontSize:32, marginBottom:10, opacity:0.3 }}>👥</div>
          Nenhuma aluna nesta turma. Associe alunas à turma no cadastro.
        </div>
      ) : (
        <>
          {/* Stats + ações rápidas */}
          <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ display:'flex', gap:10 }}>
              <div style={{ padding:'8px 16px', background:'var(--green-bg)', border:'1px solid rgba(22,163,74,0.2)', borderRadius:99, fontSize:13, fontWeight:700, color:'var(--green)' }}>
                ✓ {presentes} presente{presentes!==1?'s':''}
              </div>
              {ausentes > 0 && (
                <div style={{ padding:'8px 16px', background:'var(--red-bg)', border:'1px solid rgba(220,38,38,0.2)', borderRadius:99, fontSize:13, fontWeight:700, color:'var(--red)' }}>
                  ✗ {ausentes} falta{ausentes!==1?'s':''}
                </div>
              )}
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <button className="btn btn-secondary btn-sm" onClick={()=>marcarTodas(true)}>✓ Todos presentes</button>
              <button className="btn btn-secondary btn-sm" onClick={()=>marcarTodas(false)}>✗ Todos ausentes</button>
            </div>
          </div>

          {/* Lista de chamada */}
          <div className="panel" style={{ marginBottom:16 }}>
            <div className="panel-header">
              <div>
                <div className="panel-title">Chamada — {data.split('-').reverse().join('/')}</div>
                <div className="panel-sub">{turmas.find(t=>t.id===turmaSel)?.nome} · {alunasDaTurma.length} alunas</div>
              </div>
            </div>
            <div style={{ padding:8 }}>
              {alunasDaTurma.map((a, idx) => {
                const presente = presencas[a.id] !== false;
                return (
                  <button key={a.id} onClick={() => toggle(a.id)} style={{
                    width:'100%', display:'flex', alignItems:'center', gap:14, padding:'11px 14px',
                    background: presente ? 'rgba(22,163,74,0.05)' : 'rgba(220,38,38,0.04)',
                    border:`1px solid ${presente ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)'}`,
                    borderRadius:10, cursor:'pointer', fontFamily:'inherit', textAlign:'left',
                    marginBottom:6, transition:'all 0.1s',
                  }}>
                    <div style={{ fontSize:13, color:'var(--text3)', fontWeight:600, minWidth:24 }}>{idx+1}</div>
                    <div style={{ width:36, height:36, borderRadius:11, background: presente?'var(--green-bg)':'var(--red-bg)', color: presente?'var(--green)':'var(--red)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, flexShrink:0 }}>
                      {initials(a.nome)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.nome}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>{a.modalidade}{a.nivel ? ' · '+a.nivel : ''}</div>
                    </div>
                    <div style={{ width:36, height:36, borderRadius:10, background: presente?'var(--green-bg)':'var(--red-bg)', border:`2px solid ${presente?'var(--green)':'var(--red)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                      {presente ? '✓' : '✗'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Salvar */}
          <button
            onClick={salvarPresenca}
            disabled={saving}
            className="btn btn-primary"
            style={{ width:'100%', padding:14, fontSize:14, opacity: saved ? 0.7 : 1 }}
          >
            {saving ? <><div className="spinner" style={{width:16,height:16}}/> Salvando...</> :
             saved ? '✓ Presença salva!' : `Salvar chamada — ${presentes}P / ${ausentes}F`}
          </button>
        </>
      )}
    </div>
  );
}
