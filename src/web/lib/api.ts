// Todos os fetches vão para o backend — nunca expõe credenciais no frontend

const BASE = '/api';

export function getToken(): string | null {
  return localStorage.getItem('spl_token');
}

export async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = getToken();
  const r = await fetch(BASE + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
    ...opts,
  });
  if (r.status === 401) {
    localStorage.removeItem('spl_token');
    window.location.reload();
    throw new Error('Sessão expirada');
  }
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'Erro de rede' }));
    throw new Error((err as any).error || `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
export const authLogin = (senha: string, email?: string) =>
  req<{ ok: boolean; token?: string; error?: string }>('/auth/login', {
    method: 'POST', body: JSON.stringify(email ? { email, senha } : { senha }),
  });

export const portalAuth = (cpf: string) =>
  req<{ ok: boolean; aluna?: any; error?: string }>('/portal/auth', {
    method: 'POST', body: JSON.stringify({ cpf }),
  });

export const portalDados = (id: string) =>
  req<{ aluna: any; pagamentos: any[]; config: any; avisos: any[] }>(`/portal/aluna/${id}`);

// ── CONFIG ────────────────────────────────────────────────────────────────────
export const getConfig = () => req<any>('/config');
export const saveConfig = (data: any) => req<any>('/config', { method: 'POST', body: JSON.stringify(data) });
export const changeSenha = (senhaAtual: string, novaSenha: string) =>
  req<any>('/config/senha', { method: 'POST', body: JSON.stringify({ senhaAtual, novaSenha }) });

// ── ALUNAS ────────────────────────────────────────────────────────────────────
export const getAlunas = () => req<any[]>('/alunas');
export const saveAluna = (data: any) => req<any>('/alunas', { method: 'POST', body: JSON.stringify(data) });
export const updateAluna = (id: string, data: any) => req<any>(`/alunas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteAluna = (id: string) => req<any>(`/alunas/${id}`, { method: 'DELETE' });

// ── PAGAMENTOS ────────────────────────────────────────────────────────────────
export const getPagamentos = () => req<any[]>('/pagamentos');
export const getInadimplentes = () => req<any[]>('/inadimplentes');
export const savePagamento = (data: any) => req<any>('/pagamentos', { method: 'POST', body: JSON.stringify(data) });
export const deletePagamento = (id: string) => req<any>(`/pagamentos/${id}`, { method: 'DELETE' });

// ── TURMAS ────────────────────────────────────────────────────────────────────
export const getTurmas = () => req<any[]>('/turmas');
export const saveTurma = (data: any) => req<any>('/turmas', { method: 'POST', body: JSON.stringify(data) });
export const updateTurma = (id: string, data: any) => req<any>(`/turmas/${id}`, { method: 'PUT', body: JSON.stringify(data) }); // BUG-M4
export const deleteTurma = (id: string) => req<any>(`/turmas/${id}`, { method: 'DELETE' });

// ── AVISOS ────────────────────────────────────────────────────────────────────
export const getAvisos = () => req<any[]>('/avisos');
export const saveAviso = (data: any) => req<any>('/avisos', { method: 'POST', body: JSON.stringify(data) });
export const deleteAviso = (id: string) => req<any>(`/avisos/${id}`, { method: 'DELETE' });

// ── RENOVAÇÕES ────────────────────────────────────────────────────────────────
export const getRenovacoes = () => req<any[]>('/renovacoes');

// ── ARQUIVO MORTO ─────────────────────────────────────────────────────────────
export const getArquivoMorto = () => req<any[]>('/arquivo-morto');
export const restaurarAluna = (id: string) => req<any>(`/alunas/${id}/restaurar`, { method: 'POST' });

// ── IMPORTAR ──────────────────────────────────────────────────────────────────
export const importarDados = (data: any) =>
  req<any>('/importar', { method: 'POST', body: JSON.stringify(data) });

// ── IA ────────────────────────────────────────────────────────────────────────
// Server-side: a chave fica no servidor, nunca exposta
export const chatIA = async (messages: { role: string; content: string }[]) =>
  req<{ resposta: string; acao?: any; inadimplentes?: any[]; alunas?: any[] }>('/ia/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });

// Client-side fallback (legado)
// callIA removida — substituída por chatIA (server-side, chave não exposta)

// ── PORTAL FOTO ───────────────────────────────────────────────────────────────
export const uploadFotoPortal = async (alunaId: string, file: File) => {
  const form = new FormData();
  form.append('foto', file);
  const r = await fetch(`/api/portal/upload-foto/${alunaId}`, { method: 'POST', body: form });
  if (!r.ok) { const e = await r.json().catch(() => ({ error: 'Erro' })); throw new Error((e as any).error); }
  return r.json() as Promise<{ ok: boolean; fotoUrl: string }>;
};

export const enviarComprovante = (data: any) =>
  req<any>('/portal/enviar-comprovante', { method: 'POST', body: JSON.stringify(data) });

// ── BOLSISTA ──────────────────────────────────────────────────────────────────
export const toggleBolsista = (id: string, bolsista: boolean, desconto?: number) =>
  req<any>(`/alunas/${id}/bolsista`, { method: 'POST', body: JSON.stringify({ bolsista, desconto }) });

// ── RELATÓRIOS ────────────────────────────────────────────────────────────────
export const getRelatorioFinanceiro = (mes?: string) =>
  req<any>('/relatorios/financeiro' + (mes ? `?mes=${mes}` : ''));

export const getAnalytics = () => req<any>('/analytics');

// ── HELPERS ───────────────────────────────────────────────────────────────────
// ID único centralizado — evita duplicação em múltiplos arquivos
export const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
};

export const fmt = (v: number) =>
  'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export const initials = (n: string) =>
  n.split(' ').slice(0,2).map(w => w[0] || '').join('').toUpperCase();

export const nomeDoMes = (mes: string) => {
  const [y, m] = mes.split('-');
  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return (nomes[parseInt(m)-1] || m) + '/' + y;
};

export const escapeHtml = (s: string) =>
  s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');

// ── EFÍ BANK ──────────────────────────────────────────────────────────────────
export const efiGerarBoleto = (data: any) =>
  req<any>('/efi/boleto', { method: 'POST', body: JSON.stringify(data) });

export const efiGerarPix = (data: any) =>
  req<any>('/efi/pix', { method: 'POST', body: JSON.stringify(data) });

export const efiVerificar = (id: string) =>
  req<any>(`/efi/verificar/${id}`, { method: 'POST' });

export const getCobrancas = () => req<any[]>('/cobrancas');

// ── SEM REMATRÍCULA ───────────────────────────────────────────────────────────
export const getSemRematricula = () =>
  req<{ arquivoMorto: any[]; suspeitasSemRemat: any[] }>('/sem-rematricula');

// ── RECÁLCULO / PARCELAMENTO
export const recalcularPlano = (alunaId: string, data: any) =>
  req<any>(`/recalcular/${alunaId}`, { method: 'POST', body: JSON.stringify(data) });

export const editarLoteMensalidades = (data: any) =>
  req<any>('/mensalidades/editar-lote', { method: 'POST', body: JSON.stringify(data) });

export const getDiagnostico = (alunaId: string) =>
  req<any>(`/diagnostico/${alunaId}`);

export const corrigirInconsistencias = (alunaId: string, valorCorreto?: number) =>
  req<any>(`/corrigir-inconsistencias/${alunaId}`, { method: 'POST', body: JSON.stringify({ valorCorreto }) });

export const editarMensalidade = (id: string, data: any) =>
  req<any>(`/mensalidades/editar/${id}`, { method: 'PUT', body: JSON.stringify(data) });


// ── BACKUP / ADMIN (M2) ───────────────────────────────────────────────────────
export const exportarDados = async () => {
  const token = getToken();
  const r = await fetch('/api/admin/export', { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('Erro ao exportar');
  return r.blob();
};

// ── CONTRATOS (M3) ────────────────────────────────────────────────────────────
export const gerarContrato = (alunaId: string) =>
  req<{ ok: boolean; id: string; tokenAssinatura: string; linkAssinatura: string; codigoConfirmacao: string }>(
    `/contratos/gerar/${alunaId}`, { method: 'POST', body: JSON.stringify({}) }
  );

export const getContratoPublico = (token: string) =>
  fetch(`/api/contratos/ver/${token}`).then(r => r.json()) as Promise<any>;

export const assinarContrato = (token: string, data: { nomeAssinatura: string; codigo: string }) =>
  fetch(`/api/contratos/assinar/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()) as Promise<any>;

export const getContratosByAluna = (alunaId: string) =>
  req<any[]>(`/contratos/aluna/${alunaId}`);

// ── RESPONSÁVEIS (M4) ─────────────────────────────────────────────────────────
export const getResponsaveis = (alunaId: string) =>
  req<any[]>(`/responsaveis/${alunaId}`);

export const addResponsavel = (data: any) =>
  req<{ ok: boolean; id: string }>('/responsaveis', { method: 'POST', body: JSON.stringify(data) });

export const updateResponsavel = (id: string, data: any) =>
  req<{ ok: boolean }>(`/responsaveis/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteResponsavel = (id: string) =>
  req<{ ok: boolean }>(`/responsaveis/${id}`, { method: 'DELETE' });

// ── CÂMERAS (M4) ──────────────────────────────────────────────────────────────
export const getCameras = () => req<any[]>('/cameras');
export const upsertCamera = (data: any) =>
  req<{ ok: boolean }>('/cameras', { method: 'POST', body: JSON.stringify(data) });
export const updateCamera = (id: string, data: any) =>
  req<{ ok: boolean }>(`/cameras/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const desativarCamera = (id: string) =>
  req<{ ok: boolean }>(`/cameras/${id}`, { method: 'DELETE' });

// ── ALERTAS (M4) ──────────────────────────────────────────────────────────────
export const getAlertas = (resolvido?: boolean) =>
  req<any[]>('/alertas' + (resolvido !== undefined ? `?resolvido=${resolvido}` : ''));
export const addAlerta = (data: any) =>
  req<{ ok: boolean }>('/alertas', { method: 'POST', body: JSON.stringify(data) });
export const resolverAlerta = (id: string) =>
  req<{ ok: boolean }>(`/alertas/${id}/resolver`, { method: 'PUT' });

// ── AVALIAÇÕES (M5) ───────────────────────────────────────────────────────────
export const getAvaliacoes = (alunaId: string) =>
  req<any[]>(`/avaliacoes/${alunaId}`);
export const addAvaliacao = (data: any) =>
  req<{ ok: boolean; id: string }>('/avaliacoes', { method: 'POST', body: JSON.stringify(data) });
export const updateAvaliacao = (id: string, data: any) =>
  req<{ ok: boolean }>(`/avaliacoes/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// ── DESPESAS (M6) ─────────────────────────────────────────────────────────────
export const getDespesas = (mes?: string) =>
  req<any[]>('/despesas' + (mes ? `?mes=${mes}` : ''));
export const addDespesa = (data: any) =>
  req<{ ok: boolean; id: string }>('/despesas', { method: 'POST', body: JSON.stringify(data) });
export const updateDespesa = (id: string, data: any) =>
  req<{ ok: boolean }>(`/despesas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteDespesa = (id: string) =>
  req<{ ok: boolean }>(`/despesas/${id}`, { method: 'DELETE' });
export const getDRE = (mes?: string) =>
  req<any>('/financeiro/dre' + (mes ? `?mes=${mes}` : ''));
export const getFluxoCaixa = () => req<any[]>('/financeiro/fluxo');

// ── MÉTRICAS DE RETENÇÃO (M7) ─────────────────────────────────────────────────
export const getMetricasRetencao = () => req<any>('/metricas/retencao');

// ── ESTOQUE (M8) ──────────────────────────────────────────────────────────────
export const getEstoque = (categoria?: string) =>
  req<any[]>('/estoque' + (categoria ? `?categoria=${categoria}` : ''));
export const addItemEstoque = (data: any) =>
  req<{ ok: boolean; id: string }>('/estoque', { method: 'POST', body: JSON.stringify(data) });
export const updateItemEstoque = (id: string, data: any) =>
  req<{ ok: boolean }>(`/estoque/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteItemEstoque = (id: string) =>
  req<{ ok: boolean }>(`/estoque/${id}`, { method: 'DELETE' });

export const getEmprestimos = (params?: { alunaId?: string; devolvido?: boolean }) => {
  const q = params?.alunaId ? `?alunaId=${params.alunaId}` : params?.devolvido !== undefined ? `?devolvido=${params.devolvido}` : '';
  return req<any[]>('/emprestimos' + q);
};
export const addEmprestimo = (data: any) =>
  req<{ ok: boolean; id: string }>('/emprestimos', { method: 'POST', body: JSON.stringify(data) });
export const devolverEmprestimo = (id: string) =>
  req<{ ok: boolean }>(`/emprestimos/${id}/devolver`, { method: 'PUT' });
