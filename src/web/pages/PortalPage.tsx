import { useState, useEffect, useRef, useCallback } from "react";
import { portalAuth, portalDados, fmt, mesAtual, uploadFotoPortal, enviarComprovante } from "../lib/api";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Tab = "home" | "financeiro" | "perfil" | "avisos" | "presenca";
interface Session { id: string; aluna: any; dados: any }

// ─── ICONS SVG ────────────────────────────────────────────────────────────────
const IC = {
  home:     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  money:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>,
  user:     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>,
  bell:     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  check:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  copy:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
  chat:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>,
  calendar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>,
  alert:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>,
  dance:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="4" r="2"/><path d="M12 6v6l4 4"/><path d="m8 18 2-4"/><path d="m16 18-2-4"/><path d="M12 12 8 9"/></svg>,
  logout:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>,
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function parseMes(mes: string) {
  const [y, m] = mes.split('-');
  return { ano: y, mes: m, nome: MESES[parseInt(m)-1], abrev: MESES_ABREV[parseInt(m)-1] };
}

function formatDate(d: string) {
  if (!d) return '—';
  return d.split('-').reverse().join('/');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export function PortalPage() {
  const [session, setSession] = useState<Session | null>(null);
  // Verifica se tem sessão salva de forma síncrona (sem causar tela branca)
  const [hasSavedSession] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem("spl_portal_v2");
      if (!raw) return false;
      const saved = JSON.parse(raw);
      return !!(saved?.id);
    } catch { return false; }
  });
  const [loadingSession, setLoadingSession] = useState(hasSavedSession);
  const [tab, setTab] = useState<Tab>("home");
  const [toast, setToast] = useState<{ msg: string; type: "ok"|"err"|"info" } | null>(null);

  const showToast = (msg: string, type: "ok"|"err"|"info" = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Restaurar sessão salva — só roda se havia sessão no storage
  useEffect(() => {
    if (!hasSavedSession) return;

    // Timeout de segurança: se demorar mais de 5s, mostra o login
    const timeout = setTimeout(() => {
      localStorage.removeItem("spl_portal_v2");
      setLoadingSession(false);
    }, 5000);

    const restore = async () => {
      try {
        const raw = localStorage.getItem("spl_portal_v2");
        if (!raw) { setLoadingSession(false); clearTimeout(timeout); return; }
        const saved = JSON.parse(raw);
        if (!saved?.id) { setLoadingSession(false); clearTimeout(timeout); return; }
        const d = await portalDados(saved.id);
        clearTimeout(timeout);
        if (d?.aluna) {
          setSession({ id: saved.id, aluna: d.aluna, dados: d });
        } else {
          localStorage.removeItem("spl_portal_v2");
        }
      } catch {
        clearTimeout(timeout);
        localStorage.removeItem("spl_portal_v2");
      } finally {
        setLoadingSession(false);
      }
    };
    restore();
    return () => clearTimeout(timeout);
  }, []); // eslint-disable-line

  const handleLogin = (s: Session) => {
    localStorage.setItem("spl_portal_v2", JSON.stringify({ id: s.id }));
    setSession(s);
  };

  const handleLogout = () => {
    if (!confirm("Sair do portal?")) return;
    localStorage.removeItem("spl_portal_v2");
    setSession(null);
    setTab("home");
  };

  const refreshData = async () => {
    if (!session) return;
    try {
      const d = await portalDados(session.id);
      if (d?.aluna) setSession(s => s ? { ...s, dados: d, aluna: d.aluna } : null);
    } catch {}
  };

  // Restaurando sessão salva → splash animado
  if (loadingSession) return <PortalSplash />;
  // Sem sessão → tela de login
  if (!session) return <PortalLogin onLogin={handleLogin} />;
  // Logado → app

  return (
    <PortalApp
      session={session}
      tab={tab}
      setTab={setTab}
      onLogout={handleLogout}
      onRefresh={refreshData}
      showToast={showToast}
      toast={toast}
    />
  );
}

// ─── SPLASH ───────────────────────────────────────────────────────────────────
function PortalSplash() {
  return (
    <div style={{ minHeight:"100vh", background:"#080B14", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:64, height:64, borderRadius:18, background:"linear-gradient(135deg,#C9A86A,#A88340)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, margin:"0 auto 20px", animation:"pulse 1.5s ease-in-out infinite" }}>🩰</div>
        <div style={{ width:32, height:3, background:"rgba(201,168,106,0.3)", borderRadius:99, margin:"0 auto", overflow:"hidden" }}>
          <div style={{ height:"100%", background:"#C9A86A", borderRadius:99, animation:"loading 1.2s ease-in-out infinite" }} />
        </div>
      </div>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(0.96)}}
        @keyframes loading{0%{width:0%;marginLeft:0}50%{width:100%;marginLeft:0}100%{width:0%;marginLeft:100%}}
      `}</style>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
// Recebe onLogin com a sessão COMPLETA — faz tudo aqui dentro
function PortalLogin({ onLogin }: { onLogin: (s: Session) => void }) {
  const [cpf, setCpf] = useState("");
  const [status, setStatus] = useState<"idle"|"auth"|"dados"|"ok"|"erro">("idle");
  const [erro, setErro] = useState("");

  const formatCPF = (v: string) => {
    const n = v.replace(/\D/g,'').slice(0,11);
    if (n.length <= 3) return n;
    if (n.length <= 6) return n.slice(0,3)+'.'+n.slice(3);
    if (n.length <= 9) return n.slice(0,3)+'.'+n.slice(3,6)+'.'+n.slice(6);
    return n.slice(0,3)+'.'+n.slice(3,6)+'.'+n.slice(6,9)+'-'+n.slice(9);
  };

  const handleSubmit = async () => {
    const clean = cpf.replace(/\D/g,'');
    if (clean.length < 11) { setErro("Digite um CPF válido com 11 dígitos"); return; }

    setStatus("auth"); setErro("");

    try {
      // Passo 1: autenticar CPF
      const auth = await portalAuth(clean);
      if (!auth.ok || !auth.aluna) {
        setErro(auth.error || "CPF não encontrado. Verifique com a escola.");
        setStatus("idle");
        return;
      }

      // Passo 2: buscar dados completos
      setStatus("dados");
      let dados: any = { pagamentos: [], mensalidades: [], avisos: [], config: {} };
      try {
        const d = await portalDados(auth.aluna.id);
        if (d?.aluna) dados = d;
      } catch {
        // dados parciais — ok, entra mesmo assim
        dados.aluna = auth.aluna;
      }

      // Passo 3: sucesso — mostrar check e chamar onLogin
      setStatus("ok");
      const sessao: Session = {
        id: auth.aluna.id,
        aluna: dados.aluna || auth.aluna,
        dados,
      };
      // Pequeno delay só para mostrar o check verde
      setTimeout(() => onLogin(sessao), 600);

    } catch {
      setErro("Erro de conexão. Tente novamente.");
      setStatus("idle");
    }
  };

  const isLoading = status === "auth" || status === "dados" || status === "ok";
  const loadingMsg = status === "auth" ? "Verificando CPF..." : status === "dados" ? "Carregando dados..." : status === "ok" ? "Entrando..." : "";

  return (
    <div style={{ minHeight:"100vh", background:"#080B14", fontFamily:"'Plus Jakarta Sans',sans-serif", display:"flex", flexDirection:"column" }}>
      {/* Top decoration */}
      <div style={{ position:"fixed", top:-100, right:-100, width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle, rgba(201,168,106,0.08), transparent 70%)", pointerEvents:"none" }} />
      <div style={{ position:"fixed", bottom:-80, left:-80, width:250, height:250, borderRadius:"50%", background:"radial-gradient(circle, rgba(201,168,106,0.05), transparent 70%)", pointerEvents:"none" }} />

      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px" }}>
        {/* Logo area */}
        <div style={{ textAlign:"center", marginBottom:44 }}>
          <div style={{ width:72, height:72, borderRadius:22, background:"linear-gradient(135deg,#C9A86A,#A88340)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:34, margin:"0 auto 18px", boxShadow:"0 8px 32px rgba(201,168,106,0.3)" }}>🩰</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:34, fontWeight:700, color:"#F8FAFC", letterSpacing:0.5 }}>Hathor</div>
          <div style={{ fontSize:12, color:"#475569", letterSpacing:3, textTransform:"uppercase", marginTop:4 }}>Portal da Família</div>
        </div>

        {/* Tela de sucesso — aparece enquanto carrega dados */}
        {status === "ok" ? (
          <div style={{ textAlign:"center" }}>
            <div style={{ width:72, height:72, borderRadius:"50%", background:"rgba(22,163,74,0.15)", border:"2px solid rgba(22,163,74,0.4)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px", fontSize:32 }}>✓</div>
            <div style={{ fontSize:18, fontWeight:800, color:"#4ADE80" }}>Bem-vinda!</div>
            <div style={{ fontSize:13, color:"#475569", marginTop:6 }}>Abrindo o portal...</div>
          </div>
        ) : (
          <div style={{ width:"100%", maxWidth:360 }}>
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:22, padding:"28px 24px", backdropFilter:"blur(20px)" }}>
              <div style={{ fontSize:18, fontWeight:800, color:"#F8FAFC", marginBottom:6 }}>Acessar portal</div>
              <div style={{ fontSize:13, color:"#475569", marginBottom:24, lineHeight:1.6 }}>
                Entre com o CPF cadastrado na escola.
              </div>

              {/* CPF Input */}
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:11, fontWeight:700, color:"#64748B", display:"block", marginBottom:10, letterSpacing:0.8, textTransform:"uppercase" }}>CPF do Responsável</label>
                <input
                  type="tel"
                  value={cpf}
                  onChange={e => { setCpf(formatCPF(e.target.value)); setErro(""); }}
                  onKeyDown={e => e.key === "Enter" && !isLoading && handleSubmit()}
                  placeholder="000.000.000-00"
                  disabled={isLoading}
                  style={{
                    width:"100%", padding:"15px 18px", borderRadius:14,
                    background:"rgba(255,255,255,0.05)",
                    border:`1.5px solid ${erro ? "rgba(220,38,38,0.5)" : "rgba(255,255,255,0.1)"}`,
                    color:"#F1F0EB", fontSize:18, fontFamily:"inherit", outline:"none",
                    letterSpacing:2, textAlign:"center", opacity: isLoading ? 0.6 : 1,
                  }}
                  autoFocus
                />
              </div>

              {/* Mensagem de progresso */}
              {isLoading && !erro && (
                <div style={{ padding:"10px 14px", background:"rgba(201,168,106,0.1)", border:"1px solid rgba(201,168,106,0.25)", borderRadius:10, fontSize:13, color:"#C9A86A", marginBottom:14, display:"flex", gap:10, alignItems:"center" }}>
                  <div style={{ width:16, height:16, border:"2px solid rgba(201,168,106,0.3)", borderTopColor:"#C9A86A", borderRadius:"50%", animation:"spin 0.7s linear infinite", flexShrink:0 }} />
                  {loadingMsg}
                </div>
              )}

              {/* Erro */}
              {erro && (
                <div style={{ padding:"10px 14px", background:"rgba(220,38,38,0.1)", border:"1px solid rgba(220,38,38,0.3)", borderRadius:10, fontSize:13, color:"#F87171", marginBottom:14, display:"flex", gap:8, alignItems:"center" }}>
                  <span>⚠️</span>{erro}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={isLoading || cpf.replace(/\D/g,'').length < 11}
                style={{
                  width:"100%", padding:"15px", borderRadius:14,
                  background: (isLoading || cpf.replace(/\D/g,'').length < 11) ? "rgba(201,168,106,0.3)" : "linear-gradient(135deg,#C9A86A,#A88340)",
                  border:"none",
                  color: (isLoading || cpf.replace(/\D/g,'').length < 11) ? "#92610A" : "#0F172A",
                  fontSize:15, fontWeight:800, cursor: isLoading ? "wait" : "pointer",
                  fontFamily:"inherit", transition:"all 0.2s",
                }}
              >
                {isLoading ? loadingMsg : "Entrar →"}
              </button>
            </div>

            <div style={{ textAlign:"center", marginTop:20, fontSize:12, color:"#334155", lineHeight:1.8 }}>
              Problemas para acessar?<br/>
              Fale com a escola para cadastrar seu CPF.
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding:"16px 24px", textAlign:"center", fontSize:11, color:"#1E293B" }}>
        Hathor Escola de Dança · Cuiabá-MT
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
function PortalApp({ session, tab, setTab, onLogout, onRefresh, showToast, toast }: any) {
  const { aluna, dados } = session;
  const config    = dados?.config   || {};
  const avisos    = dados?.avisos   || [];
  const pagamentos = dados?.pagamentos || [];
  const mensalidades = dados?.mensalidades || [];

  // Recarrega dados frescos toda vez que o usuário troca de aba
  const prevTab = useRef<Tab | null>(null);
  useEffect(() => {
    if (prevTab.current !== null && prevTab.current !== tab) {
      onRefresh();
    }
    prevTab.current = tab;
  }, [tab]); // eslint-disable-line

  const mes = mesAtual();
  // Bolsista = sempre em dia, nunca mostrar débito
  const isBolsista = !!(aluna as any)?.bolsista;
  // Usar mensalidades para determinar status real do mês atual
  const mensMes = mensalidades.find((m: any) => m.mes === mes);
  const pagouMes = isBolsista || (mensMes ? mensMes.status === 'pago' : pagamentos.some((p: any) => p.mes === mes));

  const unreadAvisos = avisos.filter((a: any) => a.tipo === 'urgente').length;

  const TAB_ITEMS = [
    { id: "home" as Tab,       label: "Início",    icon: IC.home  },
    { id: "financeiro" as Tab, label: "Financeiro", icon: IC.money },
    { id: "perfil" as Tab,     label: "Aluna",      icon: IC.user  },
    { id: "avisos" as Tab,     label: "Avisos",     icon: IC.bell, badge: unreadAvisos },
    { id: "presenca" as Tab,   label: "Presença",   icon: IC.check },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#080B14", color:"#F1F0EB", fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:80, position:"relative" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed", top:20, left:"50%", transform:"translateX(-50%)",
          background: toast.type==="ok" ? "rgba(22,163,74,0.9)" : toast.type==="err" ? "rgba(220,38,38,0.9)" : "rgba(15,23,42,0.95)",
          color:"#fff", padding:"12px 22px", borderRadius:99, fontSize:13, fontWeight:600,
          zIndex:999, boxShadow:"0 8px 32px rgba(0,0,0,0.4)", backdropFilter:"blur(10px)",
          display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap",
        }}>
          {toast.type==="ok"?"✓":toast.type==="err"?"✕":"ℹ"} {toast.msg}
        </div>
      )}

      {/* Content */}
      <div style={{ maxWidth:480, margin:"0 auto" }}>
        {tab === "home"       && <HomeTab aluna={aluna} pagamentos={pagamentos} avisos={avisos} config={config} pagouMes={pagouMes} isBolsista={isBolsista} mes={mes} setTab={setTab} onLogout={onLogout} showToast={showToast} />}
        {tab === "financeiro" && <FinanceiroTab aluna={aluna} pagamentos={pagamentos} mensalidades={mensalidades} config={config} mes={mes} pagouMes={pagouMes} isBolsista={isBolsista} showToast={showToast} onRefresh={onRefresh} />}
        {tab === "perfil"     && <PerfilTab     aluna={aluna} config={config} showToast={showToast} onRefreshSession={onRefresh} />}
        {tab === "avisos"     && <AvisosTab     avisos={avisos} config={config} />}
        {tab === "presenca"   && <PresencaTab   aluna={aluna} />}
      </div>

      {/* Bottom Navigation */}
      <nav style={{
        position:"fixed", bottom:0, left:0, right:0, zIndex:100,
        background:"rgba(8,11,20,0.98)", backdropFilter:"blur(24px)",
        borderTop:"1px solid rgba(255,255,255,0.06)",
        display:"flex", padding:"8px 0",
        paddingBottom:"max(8px, env(safe-area-inset-bottom))",
      }}>
        {TAB_ITEMS.map(({ id, label, icon, badge }) => {
          const isActive = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3,
                padding:"6px 4px", border:"none", background:"none", cursor:"pointer",
                color: isActive ? "#C9A86A" : "#334155",
                fontFamily:"inherit", transition:"color 0.15s", position:"relative",
              }}
            >
              {badge ? (
                <div style={{ position:"relative" }}>
                  {icon}
                  <div style={{ position:"absolute", top:-4, right:-4, width:16, height:16, borderRadius:"50%", background:"#DC2626", color:"#fff", fontSize:9, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>{badge}</div>
                </div>
              ) : icon}
              <span style={{ fontSize:10, fontWeight: isActive ? 700 : 500, letterSpacing:0.2 }}>{label}</span>
              {isActive && <div style={{ position:"absolute", bottom:-8, left:"50%", transform:"translateX(-50%)", width:24, height:3, borderRadius:99, background:"#C9A86A" }} />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ─── HOME TAB ─────────────────────────────────────────────────────────────────
function HomeTab({ aluna, pagamentos, avisos, config, pagouMes, mes, setTab, onLogout, showToast }: any) {
  const { nome: mesNome, ano } = parseMes(mes);
  const valor = aluna?.valor || 160;

  // Próximos 3 meses
  const hoje = new Date();
  const historico3Meses = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const pago = pagamentos.some((p: any) => p.mes === m);
    historico3Meses.push({ m, nome: MESES_ABREV[d.getMonth()], pago, atual: m === mes });
  }

  return (
    <div>
      {/* Header */}
      <div style={{ padding:"52px 20px 20px", background:"linear-gradient(180deg, rgba(201,168,106,0.08) 0%, transparent 100%)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:12, color:"#475569", fontWeight:500, marginBottom:4 }}>Olá! 👋</div>
            <div style={{ fontSize:22, fontWeight:800, color:"#F8FAFC", lineHeight:1.2 }}>
              {aluna?.responsavel?.split(' ')[0] || "Bem-vinda"}
            </div>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <button onClick={() => { const w=(config?.whatsapp||'').replace(/\D/g,''); if(w) window.open(`https://wa.me/55${w}?text=${encodeURIComponent(`Olá! Sou responsável pela aluna ${aluna?.nome||''}. Preciso de informações.`)}`, '_blank'); else showToast("WhatsApp não configurado","err"); }} style={{ width:38,height:38,borderRadius:12,background:"rgba(37,211,102,0.15)",border:"1px solid rgba(37,211,102,0.25)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18 }}>💬</button>
            <button onClick={onLogout} style={{ width:38,height:38,borderRadius:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#475569" }}>{IC.logout}</button>
          </div>
        </div>

        {/* Big status card */}
        <div style={{
          borderRadius:24, padding:22, marginBottom:4,
          background: pagouMes
            ? "linear-gradient(135deg, #0D2818, #1A3D28)"
            : "linear-gradient(135deg, #1C0A0A, #2D1515)",
          border: `1px solid ${pagouMes ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
          boxShadow: pagouMes ? "0 8px 32px rgba(22,163,74,0.12)" : "0 8px 32px rgba(220,38,38,0.12)",
        }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:18 }}>
            <div>
              <div style={{ fontSize:11, color: pagouMes?"rgba(74,222,128,0.6)":"rgba(248,113,113,0.6)", textTransform:"uppercase", letterSpacing:1.5, fontWeight:700, marginBottom:6 }}>
                Mensalidade · {mesNome} {ano}
              </div>
              <div style={{ fontSize:38, fontWeight:900, color: pagouMes?"#4ADE80":"#F87171", letterSpacing:-1.5, lineHeight:1 }}>
                R$ {valor.toFixed(2).replace('.',',')}
              </div>
            </div>
            <div style={{ width:52, height:52, borderRadius:16, background: pagouMes?"rgba(74,222,128,0.15)":"rgba(248,113,113,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>
              {pagouMes ? "✅" : "⚠️"}
            </div>
          </div>

          {/* Status badge */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ padding:"6px 14px", borderRadius:99, background: pagouMes?"rgba(74,222,128,0.15)":"rgba(248,113,113,0.15)", border:`1px solid ${pagouMes?"rgba(74,222,128,0.3)":"rgba(248,113,113,0.3)"}`, fontSize:12, fontWeight:700, color:pagouMes?"#4ADE80":"#F87171" }}>
              {pagouMes ? "✓ Mensalidade em dia" : "● Pagamento pendente"}
            </div>
            {!pagouMes && (
              <button onClick={() => setTab("financeiro")} style={{ fontSize:12, fontWeight:700, color:"#F87171", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>
                Pagar →
              </button>
            )}
          </div>

          {/* Últimos 3 meses */}
          <div style={{ display:"flex", gap:8, marginTop:16, paddingTop:16, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
            {historico3Meses.map(({ m, nome: n, pago, atual }) => (
              <div key={m} style={{ flex:1, textAlign:"center" }}>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginBottom:5, fontWeight:600 }}>{n}</div>
                <div style={{ width:"100%", height:4, borderRadius:99, background: pago?"#4ADE80":atual?"rgba(248,113,113,0.5)":"rgba(255,255,255,0.08)" }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Aluna card */}
      <div style={{ padding:"0 20px", marginBottom:16 }}>
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:20, padding:18, display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:56, height:56, borderRadius:16, background:"linear-gradient(135deg,rgba(201,168,106,0.2),rgba(201,168,106,0.05))", border:"1px solid rgba(201,168,106,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0 }}>🩰</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:800, color:"#F8FAFC", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{aluna?.nome}</div>
            <div style={{ fontSize:12, color:"#475569", marginTop:2 }}>{aluna?.modalidade}{aluna?.nivel ? " · "+aluna.nivel : ""}</div>
          </div>
          <button onClick={() => setTab("perfil")} style={{ fontSize:12, fontWeight:600, color:"#C9A86A", background:"rgba(201,168,106,0.1)", border:"1px solid rgba(201,168,106,0.2)", borderRadius:10, padding:"7px 14px", cursor:"pointer", fontFamily:"inherit" }}>
            Ver perfil →
          </button>
        </div>
      </div>

      {/* Quick info grid */}
      <div style={{ padding:"0 20px", marginBottom:16 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[
            { icon:"🎭", label:"Modalidade", value: aluna?.modalidade || "Ballet" },
            { icon:"⭐", label:"Nível", value: aluna?.nivel || "—" },
            { icon:"💰", label:"Mensalidade", value: `R$ ${(aluna?.valor||160).toFixed(0)}`, gold:true },
            { icon:"📅", label:"Vencimento", value: `Dia ${aluna?.vencimento || "10"}` },
          ].map(({ icon, label, value, gold }) => (
            <div key={label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:"14px 16px" }}>
              <div style={{ fontSize:18, marginBottom:8 }}>{icon}</div>
              <div style={{ fontSize:10, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:15, fontWeight:700, color: gold ? "#C9A86A" : "#F1F0EB" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ações rápidas */}
      <div style={{ padding:"0 20px", marginBottom:20 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#334155", textTransform:"uppercase", letterSpacing:1.5, marginBottom:12 }}>Ações Rápidas</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {!pagouMes && (
            <ActionBtn icon="💳" title="Pagar mensalidade" sub={`R$ ${(aluna?.valor||160).toFixed(2).replace('.',',')} em aberto`} color="#C9A86A" onClick={() => setTab("financeiro")} />
          )}
          <ActionBtn icon="💬" title="Falar com a escola" sub="WhatsApp direto com a equipe" color="#25D366" onClick={() => { const w=(config?.whatsapp||'').replace(/\D/g,''); if(w) window.open(`https://wa.me/55${w}?text=${encodeURIComponent(`Olá! Sou responsável pela aluna ${aluna?.nome||''}. Preciso de informações.`)}`, '_blank'); else showToast("WhatsApp não configurado","err"); }} />
          <ActionBtn icon="📋" title="Histórico de pagamentos" sub="Ver todos os meses" color="#3B82F6" onClick={() => setTab("financeiro")} />
          <ActionBtn icon="📢" title="Avisos da escola" sub={`${avisos?.length || 0} comunicados`} color="#8B5CF6" onClick={() => setTab("avisos")} />
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon, title, sub, color, onClick }: any) {
  return (
    <button onClick={onClick} style={{ width:"100%", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:"14px 16px", display:"flex", alignItems:"center", gap:14, cursor:"pointer", fontFamily:"inherit", textAlign:"left", transition:"all 0.15s" }}
      onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.06)")}
      onMouseLeave={e=>(e.currentTarget.style.background="rgba(255,255,255,0.03)")}
    >
      <div style={{ width:44, height:44, borderRadius:14, background:`${color}15`, border:`1px solid ${color}25`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:"#F1F0EB" }}>{title}</div>
        <div style={{ fontSize:12, color:"#475569", marginTop:2 }}>{sub}</div>
      </div>
      <div style={{ color:"#334155", fontSize:18 }}>›</div>
    </button>
  );
}


// ─── FINANCEIRO TAB ─────────────────────────────────────────────────────────
const PIX_CHAVE = "65984743940";
const PIX_NOME  = "Hathor";
const WPP_ESCOLA = "65992283358";

function FinanceiroTab({ aluna, pagamentos, mensalidades, config, mes, pagouMes, isBolsista, showToast, onRefresh }: any) {
  const valor = aluna?.valor || 160;
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [comprovanteEnviado, setComprovanteEnviado] = useState(false);
  const [modalPix, setModalPix] = useState(false);

  const hoje = new Date();
  const mesesAnalise = mensalidades.length > 0
    ? mensalidades.map((m: any) => ({
        m: m.mes, nome: MESES_ABREV[parseInt(m.mes.split('-')[1])-1],
        ano: parseInt(m.mes.split('-')[0]), pago: m.status === 'pago',
        atrasado: m.status === 'atrasado', pag: m.pagamento, isAtual: m.mes === mes, vcto: m.dataVencimento,
      }))
    : Array.from({length:12},(_,i) => {
        const d2 = new Date(hoje.getFullYear(), i, 1);
        const m2 = `${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}`;
        const pag = pagamentos.find((p: any) => p.mes === m2);
        return { m: m2, nome: MESES_ABREV[d2.getMonth()], ano: d2.getFullYear(), pago: !!pag, atrasado: false, pag, isAtual: m2===mes, vcto: null };
      });

  const pago2026 = (mensalidades.length > 0 ? mensalidades : pagamentos)
    .filter((p: any) => (p.mes||'').startsWith('2026') && (p.status==='pago'||p.forma!=='Pendente'))
    .reduce((s: number, p: any) => s+(p.pagamento?.valor||p.valor||0), 0);
  // Bolsista nunca tem mensalidades atrasadas
  const atrasadas = isBolsista ? 0 : mensalidades.filter((m: any) => m.status==='atrasado').length;

  const pixChave = config?.pix || PIX_CHAVE;
  const [nomeMes] = mes.split('-').reverse();

  const copiarPix = async () => {
    try {
      await navigator.clipboard.writeText(pixChave);
      setCopiado(true);
      showToast("Chave Pix copiada! ✓", "ok");
      setTimeout(() => setCopiado(false), 3000);
    } catch { showToast("Erro ao copiar", "err"); }
  };

  const enviarComprovanteWpp = () => {
    const wpp = WPP_ESCOLA.replace(/\D/g,'');
    const txt = encodeURIComponent(
      `🧾 *Comprovante de Pagamento*\n\n` +
      `Aluna: *${aluna?.nome}*\n` +
      `Responsável: ${aluna?.responsavel}\n` +
      `Mês de referência: *${parseMes(mes).nome} ${parseMes(mes).ano}*\n` +
      `Valor: *R$ ${valor.toFixed(2).replace('.',',')}*\n` +
      `Chave Pix paga: ${pixChave}\n\n` +
      `_Segue comprovante em anexo. Favor confirmar o recebimento._`
    );
    window.open(`https://wa.me/55${wpp}?text=${txt}`, '_blank');
    setComprovanteEnviado(true);
    showToast("WhatsApp aberto! Anexe o comprovante.", "ok");
  };

  const abrirPix = () => setModalPix(true);

  return (
    <div style={{ padding:"52px 20px 20px" }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:20, fontWeight:800, color:"#F8FAFC" }}>Financeiro</div>
        <div style={{ fontSize:13, color:"#475569", marginTop:4 }}>Acompanhe suas mensalidades</div>
      </div>

      {/* Atrasadas */}
      {atrasadas > 0 && (
        <div style={{ background:"rgba(220,38,38,0.1)", border:"1px solid rgba(220,38,38,0.25)", borderRadius:14, padding:"12px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:20 }}>🔴</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#F87171" }}>{atrasadas} mensalidade{atrasadas>1?'s':''} em atraso</div>
            <div style={{ fontSize:11, color:"rgba(248,113,113,0.6)", marginTop:2 }}>Entre em contato com a escola para regularizar</div>
          </div>
        </div>
      )}

      {/* Cards resumo */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
        <div style={{ background:"rgba(22,163,74,0.1)", border:"1px solid rgba(22,163,74,0.2)", borderRadius:16, padding:14 }}>
          <div style={{ fontSize:9, color:"rgba(74,222,128,0.7)", textTransform:"uppercase", letterSpacing:1, fontWeight:700, marginBottom:6 }}>Pago 2026</div>
          <div style={{ fontSize:20, fontWeight:900, color:"#4ADE80" }}>R$ {pago2026.toFixed(0)}</div>
        </div>
        <div style={{ background: pagouMes?"rgba(22,163,74,0.1)":"rgba(220,38,38,0.1)", border:`1px solid ${pagouMes?"rgba(22,163,74,0.2)":"rgba(220,38,38,0.2)"}`, borderRadius:16, padding:14 }}>
          <div style={{ fontSize:9, color: pagouMes?"rgba(74,222,128,0.7)":"rgba(248,113,113,0.7)", textTransform:"uppercase", letterSpacing:1, fontWeight:700, marginBottom:6 }}>Este mês</div>
          <div style={{ fontSize:16, fontWeight:900, color: pagouMes?"#4ADE80":"#F87171" }}>{pagouMes?"Em dia":"Pendente"}</div>
        </div>
        <div style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:16, padding:14 }}>
          <div style={{ fontSize:9, color:"rgba(248,113,113,0.7)", textTransform:"uppercase", letterSpacing:1, fontWeight:700, marginBottom:6 }}>Atrasadas</div>
          <div style={{ fontSize:20, fontWeight:900, color:"#F87171" }}>{atrasadas}</div>
        </div>
      </div>

      {/* ── SEÇÃO DE PAGAMENTO PIX ──────────────────────────────────────────── */}
      {!pagouMes && (
        <div style={{ background:"linear-gradient(135deg,#0D1F0D,#0D2818)", border:"1px solid rgba(74,222,128,0.25)", borderRadius:22, padding:22, marginBottom:20 }}>
          {/* Título */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#4ADE80", display:"flex", alignItems:"center", gap:8 }}>
                💸 Pagar mensalidade
              </div>
              <div style={{ fontSize:11, color:"rgba(74,222,128,0.5)", marginTop:2 }}>
                {parseMes(mes).nome} {parseMes(mes).ano} · R$ {valor.toFixed(2).replace('.',',')}
              </div>
            </div>
            <div style={{ background:"rgba(74,222,128,0.15)", border:"1px solid rgba(74,222,128,0.3)", borderRadius:12, padding:"6px 12px", fontSize:11, fontWeight:700, color:"#4ADE80" }}>
              ● Pendente
            </div>
          </div>

          {/* Opções de pagamento */}
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {/* PIX */}
            <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:16, padding:18, border:"1px solid rgba(74,222,128,0.15)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:"rgba(74,222,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🔑</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#F1F0EB" }}>Pix — Pagamento instantâneo</div>
                  <div style={{ fontSize:11, color:"#475569" }}>Chave: telefone</div>
                </div>
              </div>

              {/* Chave Pix destacada */}
              <div style={{ background:"rgba(74,222,128,0.06)", borderRadius:12, padding:"12px 16px", marginBottom:12, border:"1px solid rgba(74,222,128,0.12)" }}>
                <div style={{ fontSize:10, color:"rgba(74,222,128,0.5)", fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, marginBottom:6 }}>
                  Chave Pix · {PIX_NOME}
                </div>
                <div style={{ fontSize:20, fontWeight:900, color:"#4ADE80", letterSpacing:1.5 }}>
                  {pixChave}
                </div>
              </div>

              <div style={{ display:"flex", gap:8 }}>
                <button onClick={copiarPix} style={{
                  flex:2, padding:"13px 0", borderRadius:12,
                  background: copiado ? "rgba(74,222,128,0.2)" : "rgba(74,222,128,0.12)",
                  border:`1.5px solid ${copiado?"rgba(74,222,128,0.5)":"rgba(74,222,128,0.25)"}`,
                  color:"#4ADE80", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 0.2s",
                }}>
                  {copiado ? "✓ Copiado!" : "📋 Copiar chave Pix"}
                </button>
                <button onClick={abrirPix} style={{
                  flex:1, padding:"13px 0", borderRadius:12,
                  background:"rgba(74,222,128,0.08)", border:"1.5px solid rgba(74,222,128,0.15)",
                  color:"rgba(74,222,128,0.7)", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                }}>
                  QR Code
                </button>
              </div>
            </div>

            {/* Débito/Crédito — em breve */}
            <div style={{ background:"rgba(255,255,255,0.02)", borderRadius:16, padding:16, border:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:12, opacity:0.5 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:"rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>💳</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#94A3B8" }}>Débito / Crédito</div>
                <div style={{ fontSize:11, color:"#334155" }}>Em breve disponível</div>
              </div>
              <div style={{ fontSize:10, padding:"4px 10px", borderRadius:99, background:"rgba(255,255,255,0.06)", color:"#475569", fontWeight:700 }}>EM BREVE</div>
            </div>
          </div>

          {/* Instrução comprovante */}
          <div style={{ marginTop:16, padding:"12px 14px", background:"rgba(201,168,106,0.08)", border:"1px solid rgba(201,168,106,0.15)", borderRadius:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#C9A86A", marginBottom:6 }}>📨 Após pagar</div>
            <div style={{ fontSize:12, color:"rgba(201,168,106,0.7)", lineHeight:1.6 }}>
              Envie o comprovante pelo botão abaixo para confirmar o pagamento com a escola.
            </div>
          </div>
        </div>
      )}

      {/* ── ENVIAR COMPROVANTE ──────────────────────────────────────────────── */}
      {!pagouMes && (
        <div style={{ marginBottom:20 }}>
          <button onClick={enviarComprovanteWpp} style={{
            width:"100%", padding:"16px", borderRadius:18,
            background: comprovanteEnviado ? "rgba(37,211,102,0.2)" : "rgba(37,211,102,0.12)",
            border:`1.5px solid ${comprovanteEnviado?"rgba(37,211,102,0.5)":"rgba(37,211,102,0.25)"}`,
            color:"#25D366", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", justifyContent:"center", gap:12,
            transition:"all 0.2s",
          }}>
            <span style={{ fontSize:22 }}>📱</span>
            <div style={{ textAlign:"left" }}>
              <div>{comprovanteEnviado ? "✓ WhatsApp aberto — anexe o comprovante" : "Enviar comprovante para a escola"}</div>
              <div style={{ fontSize:11, color:"rgba(37,211,102,0.6)", fontWeight:500, marginTop:2 }}>
                WhatsApp: {WPP_ESCOLA}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Bolsista — card especial */}
      {isBolsista && (
        <div style={{ background:"linear-gradient(135deg,#0D1A2E,#0D2240)", border:"1px solid rgba(99,179,237,0.3)", borderRadius:18, padding:20, marginBottom:20, display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:52, height:52, borderRadius:16, background:"rgba(99,179,237,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>🎓</div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:"#63B3ED" }}>Bolsista Hathor</div>
            <div style={{ fontSize:12, color:"rgba(99,179,237,0.6)", marginTop:4 }}>Mensalidade isenta · Bolsa de estudos ativa</div>
          </div>
        </div>
      )}

      {/* Pago este mês — confirmação */}
      {pagouMes && !isBolsista && (
        <div style={{ background:"linear-gradient(135deg,#0D2818,#1A3D28)", border:"1px solid rgba(74,222,128,0.25)", borderRadius:18, padding:20, marginBottom:20, display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:52, height:52, borderRadius:16, background:"rgba(74,222,128,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>✅</div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:"#4ADE80" }}>Mensalidade paga!</div>
            <div style={{ fontSize:12, color:"rgba(74,222,128,0.5)", marginTop:4 }}>
              {parseMes(mes).nome} {parseMes(mes).ano} · R$ {valor.toFixed(2).replace('.',',')}
            </div>
          </div>
        </div>
      )}

      {/* Calendário de meses */}
      <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:20, padding:20, marginBottom:20 }}>
        <div style={{ fontSize:14, fontWeight:700, color:"#F8FAFC", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
          📅 Calendário de Mensalidades
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {mesesAnalise.map(({ m, nome: n, pago, atrasado, isAtual, vcto }: any) => {
            const bg = pago ? "rgba(22,163,74,0.12)" : atrasado ? "rgba(220,38,38,0.12)" : isAtual ? "rgba(217,119,6,0.1)" : "rgba(255,255,255,0.02)";
            const border = pago ? "rgba(74,222,128,0.3)" : atrasado ? "rgba(220,38,38,0.3)" : isAtual ? "rgba(217,119,6,0.25)" : "rgba(255,255,255,0.05)";
            return (
              <div key={m} style={{ borderRadius:12, padding:"10px 8px", textAlign:"center", background:bg, border:`1px solid ${border}` }}>
                <div style={{ fontSize:10, fontWeight:700, color:pago?"#4ADE80":atrasado?"#F87171":isAtual?"#FCD34D":"#334155", marginBottom:4 }}>{n}</div>
                <div style={{ fontSize:15 }}>{pago ? "✅" : atrasado ? "🔴" : isAtual ? "🟡" : "○"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Histórico */}
      <div>
        <div style={{ fontSize:14, fontWeight:700, color:"#F8FAFC", marginBottom:14 }}>📋 Histórico de Pagamentos</div>
        {pagamentos.length ? (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[...pagamentos].reverse().map((p: any) => {
              const { nome: mNome, ano: mAno } = parseMes(p.mes);
              return (
                <div key={p.id} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:42, height:42, borderRadius:14, background:"rgba(74,222,128,0.1)", border:"1px solid rgba(74,222,128,0.2)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <div style={{ fontSize:16 }}>✅</div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"#F1F0EB" }}>{mNome} {mAno}</div>
                    <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>{formatDate(p.data)} · {p.forma || "Pix"}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:18, fontWeight:800, color:"#4ADE80" }}>R$ {Number(p.valor).toFixed(2).replace('.',',')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign:"center", padding:"40px 0", color:"#334155", fontSize:13 }}>
            <div style={{ fontSize:40, marginBottom:12, opacity:0.3 }}>📋</div>
            Nenhum pagamento registrado ainda.
          </div>
        )}
      </div>

      {/* Modal QR Code Pix */}
      {modalPix && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={() => setModalPix(false)}>
          <div style={{ background:"#0D1F0D", border:"1.5px solid rgba(74,222,128,0.3)", borderRadius:24, padding:28, maxWidth:340, width:"100%", textAlign:"center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:16, fontWeight:800, color:"#4ADE80", marginBottom:4 }}>QR Code Pix</div>
            <div style={{ fontSize:12, color:"rgba(74,222,128,0.5)", marginBottom:20 }}>{PIX_NOME}</div>

            {/* QR gerado com API pública */}
            <div style={{ background:"#fff", borderRadius:16, padding:16, marginBottom:16, display:"inline-block" }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixChave)}&bgcolor=ffffff&color=000000&margin=4`}
                width={200} height={200}
                alt="QR Pix"
                style={{ borderRadius:8, display:"block" }}
              />
            </div>

            <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:12, padding:"10px 14px", marginBottom:16, fontSize:16, color:"#4ADE80", fontWeight:700, letterSpacing:1 }}>
              {pixChave}
            </div>
            <div style={{ fontSize:11, color:"rgba(74,222,128,0.4)", marginBottom:20 }}>
              Valor: R$ {valor.toFixed(2).replace('.',',')} · {PIX_NOME}
            </div>
            <button onClick={copiarPix} style={{ width:"100%", padding:14, borderRadius:12, background:"rgba(74,222,128,0.15)", border:"1.5px solid rgba(74,222,128,0.3)", color:"#4ADE80", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", marginBottom:8 }}>
              {copiado ? "✓ Copiado!" : "📋 Copiar chave Pix"}
            </button>
            <button onClick={() => setModalPix(false)} style={{ width:"100%", padding:12, borderRadius:12, background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"#475569", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PERFIL TAB ────────────────────────────────────────────────────────────────
function PerfilTab({ aluna, config, showToast, onRefreshSession }: any) {
  const [uploadando, setUploadando] = useState(false);
  const [fotoLocal, setFotoLocal] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const nascimento = aluna?.nascimento;
  let idade = "";
  if (nascimento) {
    const nasc = new Date(nascimento);
    const hoje2 = new Date();
    let anos = hoje2.getFullYear() - nasc.getFullYear();
    if (hoje2 < new Date(hoje2.getFullYear(), nasc.getMonth(), nasc.getDate())) anos--;
    if (!isNaN(anos) && anos > 0 && anos < 100) idade = `${anos} anos`;
  }

  const wpp = (config?.whatsapp || "").replace(/\D/g, "");
  const fotoAtual = fotoLocal || (aluna?.fotoUrl ? `/api/portal/foto/${aluna.id}` : null);

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast("Apenas imagens (JPG, PNG)", "err"); return; }
    if (file.size > 5 * 1024 * 1024) { showToast("Foto muito grande (máx 5MB)", "err"); return; }

    // Preview imediato
    const reader = new FileReader();
    reader.onload = (ev) => setFotoLocal(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploadando(true);
    try {
      await uploadFotoPortal(aluna.id, file);
      showToast("Foto atualizada! ✓", "ok");
      if (onRefreshSession) onRefreshSession();
    } catch(err: any) {
      showToast(err.message || "Erro ao enviar foto", "err");
      setFotoLocal(null);
    } finally {
      setUploadando(false);
    }
  };

  const iniciais = (n: string) => n?.split(' ').slice(0,2).map((w:string)=>w[0]||'').join('').toUpperCase() || '🩰';

  return (
    <div style={{ padding:"52px 20px 20px" }}>
      {/* Profile hero com foto */}
      <div style={{ textAlign:"center", marginBottom:28 }}>
        {/* Avatar com upload */}
        <div style={{ position:"relative", display:"inline-block", marginBottom:16 }}>
          <div style={{
            width:108, height:108, borderRadius:32, overflow:"hidden",
            background:"linear-gradient(135deg, rgba(201,168,106,0.3), rgba(201,168,106,0.05))",
            border:"2px solid rgba(201,168,106,0.4)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:48, boxShadow:"0 8px 32px rgba(201,168,106,0.2)",
          }}>
            {fotoAtual ? (
              <img src={fotoAtual} alt="Foto" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            ) : (
              <span style={{ fontSize:40, opacity:0.6 }}>{iniciais(aluna?.nome||'')}</span>
            )}
            {uploadando && (
              <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:30 }}>
                <div style={{ width:24, height:24, border:"3px solid rgba(201,168,106,0.3)", borderTopColor:"#C9A86A", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
              </div>
            )}
          </div>
          {/* Botão câmera */}
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              position:"absolute", bottom:-4, right:-4,
              width:36, height:36, borderRadius:12,
              background:"linear-gradient(135deg,#C9A86A,#A88340)",
              border:"2px solid #080B14",
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", fontSize:18, boxShadow:"0 4px 12px rgba(201,168,106,0.4)",
            }}
            title="Alterar foto"
          >📷</button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFoto} />
        </div>

        <div style={{ fontSize:22, fontWeight:800, color:"#F8FAFC", marginBottom:6 }}>{aluna?.nome}</div>
        <div style={{ fontSize:12, color:"#475569", marginBottom:10 }}>
          {uploadando ? "Enviando foto..." : fotoAtual ? "Toque em 📷 para trocar a foto" : "Toque em 📷 para adicionar sua foto"}
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <span style={{ padding:"4px 14px", borderRadius:99, background:"rgba(201,168,106,0.12)", border:"1px solid rgba(201,168,106,0.25)", fontSize:12, fontWeight:600, color:"#C9A86A" }}>
            {aluna?.modalidade || "Ballet"}
          </span>
          {aluna?.nivel && (
            <span style={{ padding:"4px 14px", borderRadius:99, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", fontSize:12, fontWeight:600, color:"#94A3B8" }}>
              {aluna.nivel}
            </span>
          )}
          {(aluna as any)?.bolsista && (
            <span style={{ padding:"4px 14px", borderRadius:99, background:"rgba(234,179,8,0.15)", border:"1px solid rgba(234,179,8,0.3)", fontSize:12, fontWeight:600, color:"#EAB308" }}>
              🎓 Bolsista
            </span>
          )}
        </div>
      </div>

      {/* Dados */}
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
        <InfoCard icon="📛" label="Nome completo" value={aluna?.nome || "—"} />
        <InfoCard icon="👤" label="Responsável" value={aluna?.responsavel || "—"} />
        {nascimento && <InfoCard icon="🎂" label="Data de nascimento" value={`${formatDate(nascimento)}${idade ? ` · ${idade}` : ""}`} />}
        <InfoCard icon="🎭" label="Modalidade" value={aluna?.modalidade || "Ballet"} />
        {aluna?.nivel && <InfoCard icon="⭐" label="Nível / Turma" value={aluna.nivel} />}
        <InfoCard icon="📅" label="Vencimento" value={`Todo dia ${aluna?.vencimento || "10"} do mês`} />
        <InfoCard icon="💰" label="Mensalidade" value={(aluna as any)?.bolsista ? "Gratuita 🎓" : `R$ ${(aluna?.valor||160).toFixed(2).replace('.',',')}`} gold />
      </div>

      {/* Matrícula */}
      <div style={{ background:"rgba(22,163,74,0.08)", border:"1px solid rgba(22,163,74,0.2)", borderRadius:18, padding:18, marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:"rgba(22,163,74,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>✅</div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"#4ADE80" }}>Matrícula Ativa</div>
            <div style={{ fontSize:12, color:"rgba(74,222,128,0.5)", marginTop:2 }}>
              {aluna?.contratoAte ? `Válida até ${formatDate(aluna.contratoAte)}` : "Aluna regularmente matriculada"}
            </div>
          </div>
        </div>
      </div>

      {/* Contato escola */}
      <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:18, padding:18 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#F8FAFC", marginBottom:14 }}>📞 Contato com a escola</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <button onClick={() => window.open(`https://wa.me/55${WPP_ESCOLA.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá! Sou responsável pela aluna ${aluna?.nome||''}. Preciso de informações.`)}`, '_blank')}
            style={{ padding:"14px 18px", background:"rgba(37,211,102,0.1)", border:"1px solid rgba(37,211,102,0.2)", borderRadius:14, color:"#25D366", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:22 }}>💬</span>
            <div style={{ textAlign:"left" }}>
              <div>Falar pelo WhatsApp</div>
              <div style={{ fontSize:11, color:"rgba(37,211,102,0.6)", fontWeight:500, marginTop:2 }}>{WPP_ESCOLA}</div>
            </div>
          </button>
          {config?.instagram && (
            <button onClick={() => window.open(`https://instagram.com/${config.instagram.replace('@','')}`, '_blank')}
              style={{ padding:"14px 18px", background:"rgba(236,72,153,0.08)", border:"1px solid rgba(236,72,153,0.15)", borderRadius:14, color:"#EC4899", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:22 }}>📸</span>
              <div style={{ textAlign:"left" }}>
                <div>Instagram da escola</div>
                <div style={{ fontSize:11, color:"rgba(236,72,153,0.5)", fontWeight:500, marginTop:2 }}>{config.instagram}</div>
              </div>
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function InfoCard({ icon, label, value, gold }: any) {
  return (
    <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:"13px 16px", display:"flex", alignItems:"center", gap:14 }}>
      <span style={{ fontSize:20, flexShrink:0 }}>{icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:10, color:"#334155", fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, marginBottom:3 }}>{label}</div>
        <div style={{ fontSize:14, fontWeight:600, color: gold ? "#C9A86A" : "#F1F0EB", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value}</div>
      </div>
    </div>
  );
}

// ─── AVISOS TAB ────────────────────────────────────────────────────────────────
function AvisosTab({ avisos, config }: any) {
  const tipoConfig: Record<string, { icon: string; color: string; bg: string; label: string }> = {
    urgente: { icon:"🚨", color:"#F87171", bg:"rgba(220,38,38,0.1)",   label:"Urgente" },
    evento:  { icon:"🎉", color:"#C9A86A", bg:"rgba(201,168,106,0.1)", label:"Evento" },
    geral:   { icon:"📢", color:"#94A3B8", bg:"rgba(148,163,184,0.08)", label:"Geral" },
  };

  const urgentes = avisos.filter((a: any) => a.tipo === 'urgente');
  const outros   = avisos.filter((a: any) => a.tipo !== 'urgente');

  return (
    <div style={{ padding:"52px 20px 20px" }}>
      <div style={{ fontSize:20, fontWeight:800, color:"#F8FAFC", marginBottom:4 }}>Avisos</div>
      <div style={{ fontSize:13, color:"#475569", marginBottom:24 }}>Comunicados da escola</div>

      {/* Urgentes em destaque */}
      {urgentes.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#F87171", textTransform:"uppercase", letterSpacing:1.5, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
            {IC.alert} Avisos Urgentes
          </div>
          {urgentes.map((a: any) => <AvisoCard key={a.id} aviso={a} cfg={tipoConfig['urgente']} />)}
        </div>
      )}

      {/* Outros avisos */}
      {outros.length > 0 && (
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:1.5, marginBottom:12 }}>
            Todos os avisos
          </div>
          {outros.map((a: any) => {
            const cfg = tipoConfig[a.tipo || 'geral'] || tipoConfig.geral;
            return <AvisoCard key={a.id} aviso={a} cfg={cfg} />;
          })}
        </div>
      )}

      {!avisos.length && (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#1E293B" }}>
          <div style={{ fontSize:48, marginBottom:16, opacity:0.3 }}>📢</div>
          <div style={{ fontSize:15, fontWeight:600, color:"#334155", marginBottom:6 }}>Nenhum aviso</div>
          <div style={{ fontSize:13 }}>Você será notificada quando a escola publicar comunicados.</div>
        </div>
      )}
    </div>
  );
}

function AvisoCard({ aviso, cfg }: any) {
  const data = aviso.createdAt ? new Date(aviso.createdAt).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' }) : '';
  return (
    <div style={{ background:cfg.bg, border:`1px solid ${cfg.color}25`, borderRadius:18, padding:18, marginBottom:12, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, width:4, height:"100%", background:cfg.color, borderRadius:"18px 0 0 18px" }} />
      <div style={{ paddingLeft:8 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:18 }}>{cfg.icon}</span>
            <span style={{ fontSize:11, fontWeight:700, color:cfg.color, textTransform:"uppercase", letterSpacing:0.8 }}>{cfg.label}</span>
          </div>
          <span style={{ fontSize:11, color:"#334155" }}>{data}</span>
        </div>
        <div style={{ fontSize:14, color:"#CBD5E1", lineHeight:1.7, whiteSpace:"pre-line" }}>{aviso.mensagem}</div>
      </div>
    </div>
  );
}

// ─── PRESENÇA TAB ──────────────────────────────────────────────────────────────
function PresencaTab({ aluna }: any) {
  return (
    <div style={{ padding:"52px 20px 20px" }}>
      <div style={{ fontSize:20, fontWeight:800, color:"#F8FAFC", marginBottom:4 }}>Presença</div>
      <div style={{ fontSize:13, color:"#475569", marginBottom:28 }}>Frequência nas aulas</div>

      {/* Coming soon card */}
      <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:24, padding:40, textAlign:"center" }}>
        <div style={{ width:80, height:80, borderRadius:24, background:"rgba(201,168,106,0.1)", border:"1px solid rgba(201,168,106,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36, margin:"0 auto 20px" }}>📅</div>
        <div style={{ fontSize:18, fontWeight:800, color:"#F8FAFC", marginBottom:8 }}>Controle de Presença</div>
        <div style={{ fontSize:13, color:"#475569", lineHeight:1.7, maxWidth:280, margin:"0 auto 24px" }}>
          Em breve você poderá acompanhar a frequência de <strong style={{ color:"#C9A86A" }}>{aluna?.nome?.split(' ')[0]}</strong> nas aulas, ver o histórico e receber alertas de faltas.
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
          {["✓ Frequência mensal","✓ Histórico de presenças","✓ Alertas de faltas","✓ Reposições"].map(f => (
            <span key={f} style={{ padding:"6px 14px", borderRadius:99, background:"rgba(201,168,106,0.08)", border:"1px solid rgba(201,168,106,0.15)", fontSize:12, color:"#C9A86A", fontWeight:600 }}>{f}</span>
          ))}
        </div>
      </div>

      {/* Info atual */}
      <div style={{ marginTop:20, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:18, padding:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#94A3B8", marginBottom:16, textTransform:"uppercase", letterSpacing:1 }}>Informações da turma</div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid rgba(255,255,255,0.04)", paddingBottom:12 }}>
            <span style={{ fontSize:13, color:"#475569" }}>Modalidade</span>
            <span style={{ fontSize:13, fontWeight:700, color:"#F1F0EB" }}>{aluna?.modalidade || "Ballet"}</span>
          </div>
          {aluna?.nivel && (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid rgba(255,255,255,0.04)", paddingBottom:12 }}>
              <span style={{ fontSize:13, color:"#475569" }}>Nível</span>
              <span style={{ fontSize:13, fontWeight:700, color:"#F1F0EB" }}>{aluna.nivel}</span>
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:13, color:"#475569" }}>Status</span>
            <span style={{ padding:"4px 12px", borderRadius:99, background:"rgba(22,163,74,0.12)", border:"1px solid rgba(22,163,74,0.25)", fontSize:12, fontWeight:700, color:"#4ADE80" }}>Ativa ✓</span>
          </div>
        </div>
      </div>
    </div>
  );
}
