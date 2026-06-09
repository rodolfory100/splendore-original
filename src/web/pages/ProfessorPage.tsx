import { useState, useEffect, useMemo } from "react";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Turma { id: string; nome: string; modalidade: string; nivel?: string; dias?: string; horario?: string; professor?: string; }
interface Aluna { id: string; nome: string; responsavel?: string; whatsapp?: string; nascimento?: string; modalidade: string; nivel?: string; turmaId?: string; fotoUrl?: string; valor?: number; bolsista?: boolean; }
interface Presenca { id: string; alunaId: string; turmaId: string; data: string; presente: boolean; }
type Aba = 'chamada' | 'aniversarios' | 'turmas';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const hoje = () => new Date().toISOString().split('T')[0];
const calcIdade = (nasc: string) => {
  if (!nasc) return null;
  const d = new Date(nasc);
  const n = new Date();
  let anos = n.getFullYear() - d.getFullYear();
  if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) anos--;
  return isNaN(anos) || anos < 0 || anos > 100 ? null : anos;
};

// ─── ICONS ───────────────────────────────────────────────────────────────────
const IC = {
  check:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  cake:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2 1 2 1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>,
  users:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  logout:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>,
  cal:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>,
};

// ─── AVATAR ──────────────────────────────────────────────────────────────────
function AlunaAvatar({ aluna, size = 48, style = {} }: { aluna: Aluna; size?: number; style?: React.CSSProperties }) {
  const [err, setErr] = useState(false);
  const initials = aluna.nome.split(' ').slice(0,2).map(w => w[0] || '').join('').toUpperCase();
  const colors = ['#C9A86A','#16A34A','#2563EB','#DC2626','#7C3AED','#D97706'];
  const color = colors[aluna.nome.charCodeAt(0) % colors.length];

  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, overflow: 'hidden', flexShrink: 0,
      background: `${color}22`, border: `2px solid ${color}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.32, fontWeight: 800, color,
      ...style,
    }}>
      {aluna.fotoUrl && !err
        ? <img src={`/api/portal/foto/${aluna.id}`} alt={aluna.nome}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setErr(true)} />
        : initials
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL PROFESSOR — MAIN
// ═══════════════════════════════════════════════════════════════════════════════
export function ProfessorPage() {
  const [session, setSession] = useState<{ turmas: Turma[]; nome: string } | null>(null);
  const [hasSaved] = useState(() => {
    try { const s = localStorage.getItem('spl_prof_v1'); return !!s && !!JSON.parse(s).nome; } catch { return false; }
  });
  const [loading, setLoading] = useState(hasSaved);

  // Restaurar sessão
  useEffect(() => {
    if (!hasSaved) return;
    const raw = localStorage.getItem('spl_prof_v1');
    if (!raw) { setLoading(false); return; }
    try {
      const saved = JSON.parse(raw);
      if (saved?.nome && saved?.turmas) {
        setSession({ turmas: saved.turmas, nome: saved.nome });
      }
    } catch {}
    setLoading(false);
  }, []);

  const handleLogin = (s: { turmas: Turma[]; nome: string }) => {
    localStorage.setItem('spl_prof_v1', JSON.stringify(s));
    setSession(s);
  };

  const handleLogout = () => {
    if (!confirm('Sair do portal do professor?')) return;
    localStorage.removeItem('spl_prof_v1');
    setSession(null);
  };

  if (loading) return <ProfSplash />;
  if (!session) return <ProfLogin onLogin={handleLogin} />;
  return <ProfApp session={session} onLogout={handleLogout} />;
}

// ─── SPLASH ──────────────────────────────────────────────────────────────────
function ProfSplash() {
  return (
    <div style={{ minHeight: '100vh', background: '#0B1120', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse 1.4s ease-in-out infinite' }}>🩰</div>
        <div style={{ width: 32, height: 3, background: 'rgba(201,168,106,0.3)', borderRadius: 99, margin: '0 auto', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#C9A86A', borderRadius: 99, animation: 'loading 1.2s ease-in-out infinite' }} />
        </div>
      </div>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(0.95)}}
        @keyframes loading{0%{width:0%;margin-left:0}50%{width:100%;margin-left:0}100%{width:0%;margin-left:100%}}
      `}</style>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function ProfLogin({ onLogin }: { onLogin: (s: any) => void }) {
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [status, setStatus] = useState<'idle'|'loading'|'ok'|'erro'>('idle');
  const [erro, setErro] = useState('');

  const handleSubmit = async () => {
    if (!senha) { setErro('Digite a senha'); return; }
    setStatus('loading'); setErro('');
    try {
      const r = await fetch('/api/professor/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha, professorNome: nome }),
      });
      const data = await r.json();
      if (!data.ok) { setErro(data.error || 'Senha incorreta'); setStatus('erro'); return; }
      setStatus('ok');
      setTimeout(() => onLogin({ turmas: data.turmas, nome: nome || 'Professor(a)' }), 500);
    } catch {
      setErro('Erro de conexão'); setStatus('idle');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0B1120', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Decoração */}
      <div style={{ position: 'fixed', top: -80, right: -80, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,106,0.07), transparent 70%)', pointerEvents: 'none' }} />

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ width: 68, height: 68, borderRadius: 20, background: 'linear-gradient(135deg,#1e3a5f,#2a5298)', border: '2px solid rgba(99,179,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 16px', boxShadow: '0 8px 32px rgba(37,99,235,0.2)' }}>🎓</div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 700, color: '#F8FAFC', letterSpacing: 0.5 }}>Hathor</div>
        <div style={{ fontSize: 12, color: '#475569', letterSpacing: 3, textTransform: 'uppercase', marginTop: 4 }}>Portal do Professor</div>
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 360, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 22, padding: '28px 24px', backdropFilter: 'blur(20px)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#F8FAFC', marginBottom: 6 }}>Entrar</div>
        <div style={{ fontSize: 13, color: '#475569', marginBottom: 24, lineHeight: 1.6 }}>
          Acesse com seu nome e a senha da escola.
        </div>

        {/* Nome */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 8, letterSpacing: 0.8, textTransform: 'uppercase' }}>Seu nome (opcional)</label>
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex: Professora Ana"
            style={{ width: '100%', padding: '13px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)', color: '#F1F0EB', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Senha */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 8, letterSpacing: 0.8, textTransform: 'uppercase' }}>Senha da escola</label>
          <input
            type="password"
            value={senha}
            onChange={e => { setSenha(e.target.value); setErro(''); }}
            onKeyDown={e => e.key === 'Enter' && status !== 'loading' && handleSubmit()}
            placeholder="••••••••"
            autoFocus
            style={{ width: '100%', padding: '13px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: `1.5px solid ${erro ? 'rgba(220,38,38,0.5)' : 'rgba(255,255,255,0.1)'}`, color: '#F1F0EB', fontSize: 16, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Status */}
        {status === 'loading' && (
          <div style={{ padding: '10px 14px', background: 'rgba(99,179,237,0.1)', border: '1px solid rgba(99,179,237,0.25)', borderRadius: 10, fontSize: 13, color: '#63B3ED', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 14, height: 14, border: '2px solid rgba(99,179,237,0.3)', borderTopColor: '#63B3ED', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Verificando...
          </div>
        )}
        {status === 'ok' && (
          <div style={{ padding: '10px 14px', background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 10, fontSize: 13, color: '#4ADE80', marginBottom: 14 }}>
            ✓ Bem-vinda ao portal!
          </div>
        )}
        {erro && (
          <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, fontSize: 13, color: '#F87171', marginBottom: 14, display: 'flex', gap: 8 }}>
            <span>⚠️</span>{erro}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={status === 'loading' || !senha}
          style={{ width: '100%', padding: '14px', borderRadius: 12, background: (status === 'loading' || !senha) ? 'rgba(99,179,237,0.25)' : 'linear-gradient(135deg,#2563EB,#1d4ed8)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 800, cursor: status === 'loading' ? 'wait' : 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
        >
          {status === 'loading' ? 'Entrando...' : 'Entrar →'}
        </button>
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: '#1E293B', textAlign: 'center' }}>
        Hathor Escola de Dança · Cuiabá-MT
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
function ProfApp({ session, onLogout }: { session: { turmas: Turma[]; nome: string }; onLogout: () => void }) {
  const [aba, setAba] = useState<Aba>('chamada');
  const [dados, setDados] = useState<{ turmas: Turma[]; alunas: Aluna[]; aniversariantes: any[] } | null>(null);
  const [loadingDados, setLoadingDados] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'ok'|'err'|'info' } | null>(null);

  const showToast = (msg: string, type: 'ok'|'err'|'info' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetch('/api/professor/dados')
      .then(r => r.json())
      .then(d => setDados(d))
      .catch(() => showToast('Erro ao carregar dados', 'err'))
      .finally(() => setLoadingDados(false));
  }, []);

  const TABS = [
    { id: 'chamada' as Aba, label: 'Chamada', icon: IC.check },
    { id: 'aniversarios' as Aba, label: 'Aniversários', icon: IC.cake },
    { id: 'turmas' as Aba, label: 'Turmas', icon: IC.users },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0B1120', color: '#F1F0EB', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 80 }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'ok' ? 'rgba(22,163,74,0.92)' : toast.type === 'err' ? 'rgba(220,38,38,0.92)' : 'rgba(15,23,42,0.95)', color: '#fff', padding: '11px 22px', borderRadius: 99, fontSize: 13, fontWeight: 600, zIndex: 999, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', whiteSpace: 'nowrap' }}>
          {toast.type === 'ok' ? '✓' : toast.type === 'err' ? '✕' : 'ℹ'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#1e3a5f,#2a5298)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎓</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#F8FAFC' }}>{session.nome}</div>
            <div style={{ fontSize: 11, color: '#475569' }}>Portal do Professor · Hathor</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}>
          {IC.logout}
        </button>
      </div>

      {/* Conteúdo */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 0 20px' }}>
        {loadingDados ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12, color: '#475569' }}>
            <div style={{ width: 20, height: 20, border: '2px solid rgba(201,168,106,0.3)', borderTopColor: '#C9A86A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Carregando turmas...
          </div>
        ) : (
          <>
            {aba === 'chamada'     && <ChamadaTab turmas={dados?.turmas || []} alunas={dados?.alunas || []} showToast={showToast} />}
            {aba === 'aniversarios' && <AniversariosTab aniversariantes={dados?.aniversariantes || []} />}
            {aba === 'turmas'      && <TurmasTab turmas={dados?.turmas || []} alunas={dados?.alunas || []} />}
          </>
        )}
      </div>

      {/* Bottom Nav */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(11,17,32,0.98)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', paddingBottom: 'max(8px, env(safe-area-inset-bottom))', zIndex: 100 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setAba(t.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 4px 6px', border: 'none', background: 'none', cursor: 'pointer', color: aba === t.id ? '#63B3ED' : '#334155', fontFamily: 'inherit', transition: 'color 0.15s', position: 'relative' }}>
            <span style={{ color: aba === t.id ? '#63B3ED' : '#334155' }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: aba === t.id ? 700 : 500 }}>{t.label}</span>
            {aba === t.id && <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 22, height: 3, borderRadius: 99, background: '#63B3ED' }} />}
          </button>
        ))}
      </nav>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── ABA: CHAMADA ─────────────────────────────────────────────────────────────
function ChamadaTab({ turmas, alunas, showToast }: { turmas: Turma[]; alunas: Aluna[]; showToast: (m: string, t?: any) => void }) {
  const [turmaSel, setTurmaSel] = useState('');
  const [data, setData] = useState(hoje());
  const [presencas, setPresencas] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const turmaAtual = turmas.find(t => t.id === turmaSel);
  const alunasDaTurma = useMemo(() =>
    turmaSel ? alunas.filter(a => a.turmaId === turmaSel) : [],
    [alunas, turmaSel]
  );

  // Carregar presenças ao trocar turma/data
  useEffect(() => {
    if (!turmaSel || !data) return;
    setLoading(true); setSaved(false);
    const init: Record<string, boolean> = {};
    alunas.filter(a => a.turmaId === turmaSel).forEach(a => { init[a.id] = true; });

    fetch(`/api/professor/presencas/${turmaSel}/${data}`)
      .then(r => r.json())
      .then((lista: Presenca[]) => {
        if (lista.length > 0) lista.forEach(p => { init[p.alunaId] = p.presente; });
        setPresencas(init);
      })
      .catch(() => setPresencas(init))
      .finally(() => setLoading(false));
  }, [turmaSel, data]);

  const toggle = (id: string) => { setPresencas(p => ({ ...p, [id]: !p[id] })); setSaved(false); };
  const marcarTodas = (v: boolean) => {
    const m: Record<string, boolean> = {};
    alunasDaTurma.forEach(a => { m[a.id] = v; });
    setPresencas(m); setSaved(false);
  };

  const salvar = async () => {
    if (!turmaSel) return;
    setSaving(true);
    try {
      await Promise.all(alunasDaTurma.map(a =>
        fetch('/api/professor/presencas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: genId(), alunaId: a.id, turmaId: turmaSel, data, presente: presencas[a.id] ?? true }),
        })
      ));
      setSaved(true);
      const pres = alunasDaTurma.filter(a => presencas[a.id] !== false).length;
      const falt = alunasDaTurma.length - pres;
      showToast(`✓ Chamada salva — ${pres}P / ${falt}F`, 'ok');
    } catch {
      showToast('Erro ao salvar', 'err');
    } finally {
      setSaving(false);
    }
  };

  const presentes = alunasDaTurma.filter(a => presencas[a.id] !== false).length;
  const ausentes  = alunasDaTurma.filter(a => presencas[a.id] === false).length;

  return (
    <div>
      {/* Seleção */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#F8FAFC', marginBottom: 16 }}>Chamada</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Turma</div>
            <select value={turmaSel} onChange={e => setTurmaSel(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)', color: '#F1F0EB', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}>
              <option value="">Selecione a turma...</option>
              {turmas.map(t => (
                <option key={t.id} value={t.id} style={{ background: '#1e293b' }}>
                  {t.nome} {t.dias ? `· ${t.dias}` : ''} {t.horario ? t.horario : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Data</div>
            <input type="date" value={data} onChange={e => { setData(e.target.value); setSaved(false); }}
              style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)', color: '#F1F0EB', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
          </div>
        </div>
      </div>

      {!turmaSel ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#334155' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🎭</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>Selecione uma turma para fazer a chamada</div>
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12, color: '#475569' }}>
          <div style={{ width: 18, height: 18, border: '2px solid rgba(99,179,237,0.3)', borderTopColor: '#63B3ED', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          Carregando...
        </div>
      ) : !alunasDaTurma.length ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#334155' }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>👥</div>
          <div>Nenhuma aluna nesta turma.</div>
        </div>
      ) : (
        <div style={{ padding: '0 20px' }}>
          {/* Info turma */}
          {turmaAtual && (
            <div style={{ background: 'rgba(99,179,237,0.08)', border: '1px solid rgba(99,179,237,0.18)', borderRadius: 14, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24 }}>🎭</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC' }}>{turmaAtual.nome}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  {[turmaAtual.modalidade, turmaAtual.nivel, turmaAtual.dias, turmaAtual.horario].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#63B3ED' }}>{alunasDaTurma.length}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>alunas</div>
              </div>
            </div>
          )}

          {/* Stats + ações */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            <div style={{ padding: '7px 14px', background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 99, fontSize: 13, fontWeight: 700, color: '#4ADE80' }}>
              ✓ {presentes} presentes
            </div>
            {ausentes > 0 && (
              <div style={{ padding: '7px 14px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 99, fontSize: 13, fontWeight: 700, color: '#F87171' }}>
                ✗ {ausentes} falta{ausentes !== 1 ? 's' : ''}
              </div>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={() => marcarTodas(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.2)', color: '#4ADE80', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Todos ✓</button>
              <button onClick={() => marcarTodas(false)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#F87171', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Todos ✗</button>
            </div>
          </div>

          {/* Lista de alunas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {alunasDaTurma.map((aluna, idx) => {
              const presente = presencas[aluna.id] !== false;
              const isDetalhes = detalheId === aluna.id;
              const idade = calcIdade(aluna.nascimento || '');

              return (
                <div key={aluna.id} style={{ borderRadius: 14, overflow: 'hidden', border: `1.5px solid ${presente ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`, background: presente ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                    <span style={{ fontSize: 12, color: '#334155', fontWeight: 600, minWidth: 22 }}>{idx + 1}</span>

                    {/* Foto */}
                    <AlunaAvatar aluna={aluna} size={44} />

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aluna.nome}</div>
                      <div style={{ fontSize: 11, color: '#475569', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {aluna.nivel && <span>{aluna.nivel}</span>}
                        {idade && <span>{idade} anos</span>}
                        {aluna.bolsista && <span style={{ color: '#63B3ED', fontWeight: 700 }}>Bolsista</span>}
                      </div>
                    </div>

                    {/* Botão detalhes */}
                    <button onClick={() => setDetalheId(isDetalhes ? null : aluna.id)} style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748B', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                      {isDetalhes ? '▲' : 'ver'}
                    </button>

                    {/* Toggle presença */}
                    <button onClick={() => toggle(aluna.id)} style={{ width: 40, height: 40, borderRadius: 12, background: presente ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.15)', border: `2px solid ${presente ? 'rgba(22,163,74,0.5)' : 'rgba(220,38,38,0.4)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}>
                      {presente ? '✓' : '✗'}
                    </button>
                  </div>

                  {/* Detalhes expandidos */}
                  {isDetalhes && (
                    <div style={{ padding: '12px 14px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <AlunaAvatar aluna={aluna} size={72} style={{ borderRadius: 16 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {[
                              { label: 'Modalidade', value: aluna.modalidade },
                              { label: 'Nível', value: aluna.nivel || '—' },
                              { label: 'Idade', value: idade ? `${idade} anos` : '—' },
                              { label: 'Responsável', value: aluna.responsavel || '—' },
                            ].map(item => (
                              <div key={item.label}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>{item.label}</div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#CBD5E1' }}>{item.value}</div>
                              </div>
                            ))}
                          </div>
                          {aluna.whatsapp && (
                            <button onClick={() => { const w = aluna.whatsapp!.replace(/\D/g,''); window.open(`https://wa.me/55${w}`, '_blank'); }}
                              style={{ marginTop: 10, padding: '7px 14px', borderRadius: 10, background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                              💬 {aluna.whatsapp}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Salvar */}
          <button onClick={salvar} disabled={saving} style={{ width: '100%', padding: '15px', borderRadius: 14, background: saved ? 'rgba(22,163,74,0.2)' : 'linear-gradient(135deg,#2563EB,#1d4ed8)', border: saved ? '2px solid rgba(22,163,74,0.4)' : 'none', color: saved ? '#4ADE80' : '#fff', fontSize: 15, fontWeight: 800, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20, transition: 'all 0.2s' }}>
            {saving
              ? <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Salvando...</>
              : saved ? `✓ Chamada salva — ${presentes}P / ${ausentes}F` : `Salvar chamada — ${presentes}P / ${ausentes}F`
            }
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ABA: ANIVERSÁRIOS ────────────────────────────────────────────────────────
function AniversariosTab({ aniversariantes }: { aniversariantes: any[] }) {
  const hoje_date = new Date();
  const mesAtualNum = hoje_date.getMonth() + 1;
  const diaHoje = hoje_date.getDate();

  const hojeList = aniversariantes.filter(a => a.ehHoje);
  const proximosList = aniversariantes.filter(a => !a.ehHoje && !a.jaPassou);
  const passaramList = aniversariantes.filter(a => a.jaPassou);

  const secao = (titulo: string, emoji: string, lista: any[], cor: string) => lista.length === 0 ? null : (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: cor, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{emoji}</span> {titulo}
        <span style={{ background: `${cor}22`, color: cor, padding: '2px 8px', borderRadius: 99, fontSize: 11 }}>{lista.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lista.map(a => {
          const idade = calcIdade(a.nascimento || '');
          const idadeAniversario = idade !== null ? (a.ehHoje ? idade : (a.jaPassou ? idade : idade + 1)) : null;
          return (
            <div key={a.id} style={{ background: a.ehHoje ? 'linear-gradient(135deg,rgba(201,168,106,0.12),rgba(201,168,106,0.05))' : 'rgba(255,255,255,0.03)', border: `1.5px solid ${a.ehHoje ? 'rgba(201,168,106,0.35)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <AlunaAvatar aluna={a} size={52} style={{ borderRadius: 14 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: a.ehHoje ? '#C9A86A' : '#F8FAFC' }}>{a.nome}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 3, display: 'flex', gap: 8 }}>
                  <span>{a.modalidade}{a.nivel ? ' · ' + a.nivel : ''}</span>
                  {idadeAniversario && <span style={{ color: '#63B3ED', fontWeight: 700 }}>{idadeAniversario} anos</span>}
                </div>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: a.ehHoje ? 28 : 22, fontWeight: 900, color: a.ehHoje ? '#C9A86A' : '#64748B' }}>
                  {a.diaNasc}
                </div>
                <div style={{ fontSize: 10, color: '#475569' }}>{MESES_ABREV[mesAtualNum - 1]}</div>
              </div>
              {a.ehHoje && <span style={{ fontSize: 24 }}>🎂</span>}
              {a.whatsapp && (
                <button onClick={() => {
                  const w = a.whatsapp.replace(/\D/g,'');
                  const msg = encodeURIComponent(`🎂 *Feliz Aniversário, ${a.nome.split(' ')[0]}!*\n\nA equipe Hathor deseja um dia lindo para você! 🩰✨\n\nCom carinho, Hathor Escola de Dança 🌸`);
                  window.open(`https://wa.me/55${w}?text=${msg}`, '_blank');
                }} style={{ padding: '7px 12px', borderRadius: 10, background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.22)', color: '#25D366', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  🎉 Parabéns
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#F8FAFC', marginBottom: 4 }}>Aniversários</div>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 20 }}>{MESES[mesAtualNum - 1]} · {aniversariantes.length} aniversariante{aniversariantes.length !== 1 ? 's' : ''}</div>

      {aniversariantes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#334155' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🎂</div>
          <div style={{ fontSize: 14, color: '#475569' }}>Nenhum aniversário em {MESES[mesAtualNum - 1]}.</div>
          <div style={{ fontSize: 12, color: '#334155', marginTop: 8 }}>Verifique se as datas de nascimento estão cadastradas.</div>
        </div>
      ) : (
        <>
          {secao('Hoje! 🎉', '🎂', hojeList, '#C9A86A')}
          {secao('Ainda virão', '📅', proximosList, '#63B3ED')}
          {secao('Já passaram', '✓', passaramList, '#475569')}
        </>
      )}
    </div>
  );
}

// ─── ABA: TURMAS ─────────────────────────────────────────────────────────────
function TurmasTab({ turmas, alunas }: { turmas: Turma[]; alunas: Aluna[] }) {
  const [turmaSel, setTurmaSel] = useState<string | null>(null);

  const alunasDaTurma = useMemo(() =>
    turmaSel ? alunas.filter(a => a.turmaId === turmaSel) : [],
    [alunas, turmaSel]
  );

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#F8FAFC', marginBottom: 4 }}>Turmas</div>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 20 }}>{turmas.length} turma{turmas.length !== 1 ? 's' : ''} cadastradas</div>

      {/* Lista de turmas */}
      {!turmaSel ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {turmas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#334155' }}>
              <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>🎭</div>
              <div>Nenhuma turma cadastrada.</div>
            </div>
          ) : turmas.map(t => {
            const qtd = alunas.filter(a => a.turmaId === t.id).length;
            const colors: Record<string, string> = { Ballet: '#C9A86A', Jazz: '#DC2626', 'Danças Urbanas': '#2563EB' };
            const color = colors[t.modalidade] || '#7C3AED';
            return (
              <button key={t.id} onClick={() => setTurmaSel(t.id)} style={{ background: 'rgba(255,255,255,0.03)', border: `1.5px solid rgba(255,255,255,0.07)`, borderRadius: 16, padding: '16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = `${color}40`; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${color}18`, border: `2px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🎭</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#F8FAFC' }}>{t.nome}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
                    {[t.modalidade, t.nivel, t.dias, t.horario].filter(Boolean).join(' · ')}
                  </div>
                  {t.professor && <div style={{ fontSize: 11, color: color, marginTop: 2 }}>Prof. {t.professor}</div>}
                </div>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color }}>{qtd}</div>
                  <div style={{ fontSize: 10, color: '#475569' }}>alunas</div>
                </div>
                <span style={{ color: '#334155', fontSize: 20 }}>›</span>
              </button>
            );
          })}
        </div>
      ) : (
        /* Detalhe turma */
        <div>
          <button onClick={() => setTurmaSel(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, background: 'none', border: 'none', color: '#63B3ED', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Voltar
          </button>
          {(() => {
            const t = turmas.find(x => x.id === turmaSel)!;
            const colors: Record<string, string> = { Ballet: '#C9A86A', Jazz: '#DC2626', 'Danças Urbanas': '#2563EB' };
            const color = colors[t?.modalidade] || '#7C3AED';
            return (
              <div>
                <div style={{ background: `${color}10`, border: `1.5px solid ${color}25`, borderRadius: 16, padding: '16px', marginBottom: 20 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#F8FAFC', marginBottom: 4 }}>{t.nome}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    {[t.modalidade, t.nivel, t.dias, t.horario].filter(Boolean).join(' · ')}
                  </div>
                  {t.professor && <div style={{ fontSize: 12, color, marginTop: 4, fontWeight: 600 }}>Prof. {t.professor}</div>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                  {alunasDaTurma.length} aluna{alunasDaTurma.length !== 1 ? 's' : ''}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {alunasDaTurma.map(aluna => {
                    const idade = calcIdade(aluna.nascimento || '');
                    return (
                      <div key={aluna.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
                        <AlunaAvatar aluna={aluna} size={56} style={{ margin: '0 auto 10px', borderRadius: 16 }} />
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC', lineHeight: 1.3, marginBottom: 4 }}>
                          {aluna.nome.split(' ').slice(0, 2).join(' ')}
                        </div>
                        {aluna.nivel && <div style={{ fontSize: 10, color: '#475569' }}>{aluna.nivel}</div>}
                        {idade && <div style={{ fontSize: 10, color: '#63B3ED', fontWeight: 700, marginTop: 2 }}>{idade} anos</div>}
                        {aluna.bolsista && <div style={{ fontSize: 9, color: '#63B3ED', background: 'rgba(99,179,237,0.12)', borderRadius: 99, padding: '2px 8px', marginTop: 4, display: 'inline-block', fontWeight: 700 }}>Bolsista</div>}
                      </div>
                    );
                  })}
                  {alunasDaTurma.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 32, color: '#334155' }}>
                      Nenhuma aluna nesta turma.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
