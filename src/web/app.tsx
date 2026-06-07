import { Route, Switch } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Provider } from "./components/provider";
import { Sidebar } from "./components/Sidebar";
import { ToastContainer, useToast } from "./components/Toast";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { AlunosPage } from "./pages/AlunosPage";
import { CobrancasPage } from "./pages/CobrancasPage";
import { PagamentosPage } from "./pages/PagamentosPage";
import { RelatoriosPage } from "./pages/RelatoriosPage";
import { RenovacoesPage } from "./pages/RenovacoesPage";
import { AvisosPage } from "./pages/AvisosPage";
import { AdminPage } from "./pages/AdminPage";
import { IAPage } from "./pages/IAPage";
import { SemRematriculaPage } from "./pages/SemRematriculaPage";
import { CobrancasEfiPage } from "./pages/CobrancasEfiPage";
import { BoletosInternosPage } from "./pages/BoletosInternosPage";
import { MensalidadesPage } from "./pages/MensalidadesPage";
import { PortalPage } from "./pages/PortalPage";
import { ProfessorPage } from "./pages/ProfessorPage";
import { ImportacaoPage } from "./pages/ImportacaoPage";
import { TurmasPage } from "./pages/TurmasPage";
import { PresencaPage } from "./pages/PresencaPage";
import { ArquivoMortoPage } from "./pages/ArquivoMortoPage";
import { TelegramPage } from "./pages/TelegramPage";
import { CamerasPage } from "./pages/CamerasPage";
import { FinanceiroPage } from "./pages/FinanceiroPage";
import { EstoquePage } from "./pages/EstoquePage";
import { AssinarContratoPage } from "./pages/AssinarContratoPage";
import { MonitorPage } from "./pages/MonitorPage";
import { getAlunas, getPagamentos, getInadimplentes, getTurmas, getConfig, getAvisos, getRenovacoes, getArquivoMorto, mesAtual, savePagamento, initials, genId } from "./lib/api";
import type { Aluna, Pagamento, Turma, Inadimplente, RenovacaoAluna, Aviso } from "./types";

// ─── SISTEMA DE GESTÃO ────────────────────────────────────────────────────────
function Sistema() {
  const [authed, setAuthed] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Data
  const [alunas, setAlunas] = useState<Aluna[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [inadimplentes, setInadimplentes] = useState<Inadimplente[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [renovacoes, setRenovacoes] = useState<RenovacaoAluna[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [arquivoMorto, setArquivoMorto] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});
  const [loadingData, setLoadingData] = useState(false);
  const [pagModalOpen, setPagModalOpen] = useState(false);

  const { toasts, show: showToast, remove } = useToast();

  // Check auth on mount
  useEffect(() => {
    const t = localStorage.getItem("spl_token");
    if (t) setAuthed(true);
  }, []);

  const refresh = useCallback(async () => {
    if (!authed) return;
    setLoadingData(true);
    try {
      const [al, pags, inad, trs, cfg, av, ren] = await Promise.all([
        getAlunas(), getPagamentos(), getInadimplentes(),
        getTurmas(), getConfig(), getAvisos(), getRenovacoes(),
      ]);
      setAlunas(al); setPagamentos(pags); setInadimplentes(inad);
      setTurmas(trs); setConfig(cfg); setAvisos(av); setRenovacoes(ren);
    } catch (e: any) {
      showToast("Erro ao carregar dados: " + e.message, "danger");
    } finally {
      setLoadingData(false);
    }
  }, [authed]);

  useEffect(() => { if (authed) refresh(); }, [authed, refresh]);

  if (!authed) return <LoginPage onLogin={() => setAuthed(true)} />;

  const diaHoje = new Date().getDate();
  const vencendoHoje = inadimplentes.filter(a => {
    const v = parseInt((a as any).vencimento || '10');
    return Math.abs(v - diaHoje) <= 3;
  }).length;

  const badges = {
    "badge-inad": inadimplentes.length,
    "badge-renov": renovacoes.filter(r => r.urgencia === "critico" || r.urgencia === "vencido").length,
    "badge-susp": alunas.filter(a => a.suspenso).length,
    "badge-vcto": vencendoHoje,
  };

  const breadcrumbs: Record<string, string> = {
    dashboard: "Visão Geral", alunos: "Alunas", turmas: "Turmas & Horários",
    cobrancas: "Cobranças WhatsApp", cobrancas_efi: "Boletos & Pix — Efí Bank",
    boletos_internos: "Boletos Internos", pagamentos: "Pagamentos", relatorios: "Relatórios",
    mensalidades: "Mensalidades",
    renovacoes: "Renovações", suspensos: "Sem Rematrícula", presenca: "Presença",
    avisos: "Avisos em Massa", admin: "Administração", ia_assistente: "✦ Assistente IA",
    arquivo_morto: "Arquivo Morto", importacao: "Importar Dados", telegram: "Bot Telegram",
    monitor: "📷 Monitor de Câmeras",
    cameras: "📷 Câmeras", financeiro: "💰 Financeiro", estoque: "👗 Estoque & Fantasias",
  };

  const navigate = (p: string) => {
    setPage(p);
    setSidebarOpen(false);
    window.scrollTo(0, 0);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f0" }}>
      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(o => !o)}
        style={{ display: "none", position: "fixed", top: 13, left: 13, zIndex: 200, background: "#1e2d2b", border: "none", borderRadius: 6, padding: 9, cursor: "pointer", color: "#d4af64", fontSize: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}
        className="mobile-toggle"
        id="mobile-toggle"
      >☰</button>

      <Sidebar
        currentPage={page}
        onNavigate={navigate}
        config={config}
        badges={badges}
        collapsed={sidebarCollapsed}
        mobileOpen={sidebarOpen}
        onToggleMobile={() => setSidebarOpen(o => !o)}
      />

      {/* Main */}
      <div style={{ marginLeft: sidebarCollapsed ? 0 : 256, minHeight: "100vh", transition: "margin-left 0.3s cubic-bezier(0.4,0,0.2,1)" }}>
        {/* Topbar */}
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Mobile menu btn */}
            <button
              id="mobile-toggle"
              className="mobile-only"
              onClick={() => setSidebarOpen(o => !o)}
              style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg2)", border: "1px solid var(--border)", cursor: "pointer", display: "none", alignItems: "center", justifyContent: "center", fontSize: 16, color: "var(--text2)" }}
            >☰</button>
            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 500 }}>Splendore</span>
              <span style={{ color: "var(--border2)" }}>/</span>
              <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{breadcrumbs[page] || page}</span>
              {loadingData && <div className="spinner" style={{ marginLeft: 8 }} />}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={refresh} className="btn btn-secondary btn-sm btn-icon" title="Atualizar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
            </button>
            <button onClick={() => { navigate("pagamentos"); setPagModalOpen(true); }} className="btn btn-secondary btn-sm">
              + Pagamento
            </button>
            <button onClick={() => navigate("alunos")} className="btn btn-primary btn-sm">
              + Nova Aluna
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "28px 32px" }}>
          {page === "dashboard" && <Dashboard alunas={alunas} pagamentos={pagamentos} inadimplentes={inadimplentes} onNavigate={navigate} />}
          {page === "alunos" && <AlunosPage alunas={alunas} pagamentos={pagamentos} turmas={turmas} onRefresh={refresh} onToast={showToast} onNavigate={navigate} />}
          {page === "cobrancas" && <CobrancasPage inadimplentes={inadimplentes} config={config} onRefresh={refresh} onToast={showToast} />}
          {page === "pagamentos" && <PagamentosPage pagamentos={pagamentos} alunas={alunas} config={config} onRefresh={refresh} onToast={showToast} onOpenPagamento={() => setPagModalOpen(true)} />}
          {page === "relatorios" && <RelatoriosPage alunas={alunas} pagamentos={pagamentos} inadimplentes={inadimplentes} config={config} />}
          {page === "renovacoes" && <RenovacoesPage renovacoes={renovacoes} config={config} onRefresh={refresh} onToast={showToast} />}
          {page === "avisos" && <AvisosPage avisos={avisos} alunas={alunas} config={config} onRefresh={refresh} onToast={showToast} />}
          {page === "admin" && <AdminPage config={config} onConfigChange={setConfig} onToast={showToast} />}
          {page === "ia_assistente" && <IAPage alunas={alunas} pagamentos={pagamentos} inadimplentes={inadimplentes} config={config} onRefresh={refresh} onToast={showToast} />}
          {page === "importacao" && <ImportacaoPage onRefresh={refresh} onToast={showToast} onNavigate={navigate} />}
          {page === "suspensos" && <SemRematriculaPage config={config} onRefresh={refresh} onToast={showToast} />}
          {page === "boletos_internos" && <BoletosInternosPage alunas={alunas} inadimplentes={inadimplentes} onToast={showToast} />}
          {page === "cobrancas_efi" && <CobrancasEfiPage inadimplentes={inadimplentes} config={config} onRefresh={refresh} onToast={showToast} onNavigate={navigate} />}
          {page === "mensalidades" && <MensalidadesPage alunas={alunas} onToast={showToast} onRefresh={refresh} />}
          {page === "turmas" && <TurmasPage turmas={turmas} alunas={alunas} onRefresh={refresh} onToast={showToast} />}
          {page === "presenca" && <PresencaPage turmas={turmas} alunas={alunas} onToast={showToast} />}
          {page === "arquivo_morto" && <ArquivoMortoPage config={config} onRefresh={refresh} onToast={showToast} />}
          {page === "telegram" && <TelegramPage config={config} onToast={showToast} onConfigChange={setConfig} />}
          {page === "cameras" && <CamerasPage onToast={showToast} />}
          {page === "financeiro" && <FinanceiroPage onToast={showToast} />}
          {page === "estoque" && <EstoquePage alunas={alunas} onToast={showToast} />}
          {page === "monitor" && <MonitorPage turmas={turmas} alunas={alunas} onToast={showToast} />}
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={remove} />
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <ErrorBoundary>
      <Provider>
        <Switch>
          <Route path="/portal" component={PortalPage} />
          <Route path="/professor" component={ProfessorPage} />
          <Route path="/contratos/assinar/:token" component={AssinarContratoPage} />
          <Route path="/" component={Sistema} />
        </Switch>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;