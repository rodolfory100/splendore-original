import { Hono } from 'hono';
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, like, or, ne, isNull } from "drizzle-orm";
import * as schema from "./database/schema";

type Bindings = { DB: D1Database; BUCKET: R2Bucket };
const app = new Hono<{ Bindings: Bindings }>().basePath("api");

app.use(cors({
  origin: (origin) => {
    // Permite localhost (dev), runable.site e domínio próprio
    if (!origin) return origin;
    if (origin.includes('localhost') || origin.includes('runable.site') || origin.includes('balletsplendore')) return origin;
    return null;
  },
  allowMethods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowHeaders: ['Content-Type','Authorization'],
  maxAge: 600,
}));

const db = (c: any) => drizzle(c.env.DB, { schema });
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };

// ─── SEGURANÇA: Web Crypto (nativo Cloudflare Workers) ───────────────────────
// SEC-1: JWT_SECRET — fallback para dev, em produção configure JWT_SECRET no wrangler.json [vars]
const JWT_SECRET_DEFAULT = 'splendore_jwt_secret_2026_producao';
const getJwtSecret = (c?: any) => (c?.env?.JWT_SECRET as string) || JWT_SECRET_DEFAULT;

async function hashSenha(senha: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(senha + 'splendore_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  // Suporte legado: senha em texto puro (migração automática)
  if (hash === senha) return true;
  const novoHash = await hashSenha(senha);
  return novoHash === hash;
}

async function gerarJWT(payload: { role: string; escola: string }, secret?: string): Promise<string> {
  const s = secret || JWT_SECRET_DEFAULT;
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, exp: Date.now() + 8 * 60 * 60 * 1000, iat: Date.now() }));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${header}.${body}.${sig}`;
}

async function verificarJWT(token: string, secret?: string): Promise<any | null> {
  try {
    const s = secret || JWT_SECRET_DEFAULT;
    const [header, body, sig] = token.split('.');
    if (!header || !body || !sig) return null;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const signature = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(`${header}.${body}`));
    if (!valid) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

// Rate limiting em memória (por IP)
const tentativasLogin = new Map<string, { count: number; primeiraTs: number }>();
function verificarRateLimit(ip: string): boolean {
  const agora = Date.now();
  const janela = 15 * 60 * 1000;
  const entrada = tentativasLogin.get(ip);
  if (!entrada || agora - entrada.primeiraTs > janela) {
    tentativasLogin.set(ip, { count: 1, primeiraTs: agora });
    return true;
  }
  if (entrada.count >= 10) return false;
  entrada.count++;
  return true;
}

// ─── MIDDLEWARE DE AUTENTICAÇÃO JWT ──────────────────────────────────────────
const ROTAS_PUBLICAS = ['/ping', '/portal/', '/auth/', '/telegram/webhook', '/contratos/ver/', '/contratos/assinar/', '/professor/', '/config'];
app.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname.replace('/api', '');
  const isPublica = ROTAS_PUBLICAS.some(p => path.startsWith(p));
  if (isPublica) return next();

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Não autorizado' }, 401);

  const token = authHeader.slice(7);
  const payload = await verificarJWT(token, getJwtSecret(c));
  if (!payload) return c.json({ error: 'Token inválido ou expirado' }, 401);

  return next();
});

// ─── PING ───────────────────────────────────────────────────────────────────
app.get('/ping', (c) => c.json({ ok: true, ts: Date.now() }));

// ─── AUTH SISTEMA (diretora) ─────────────────────────────────────────────────
app.post('/auth/login', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  if (!verificarRateLimit(ip)) {
    return c.json({ ok: false, error: 'Muitas tentativas. Aguarde 15 minutos.' }, 429);
  }
  const { senha } = await c.req.json();
  if (!senha) return c.json({ ok: false, error: 'Senha obrigatória' }, 400);
  const d = db(c);
  const cfg = await d.select().from(schema.config).limit(1);
  const hashArmazenado = cfg[0]?.senhaHash ?? 'splendore2026';

  const senhaValida = await verificarSenha(senha, hashArmazenado);
  if (!senhaValida) return c.json({ ok: false, error: 'Senha incorreta' }, 401);

  // Migrar senha em texto puro para hash SHA-256
  if (cfg[0] && (hashArmazenado === senha || hashArmazenado.length < 40)) {
    const novoHash = await hashSenha(senha);
    await d.update(schema.config).set({ senhaHash: novoHash }).where(eq(schema.config.id, cfg[0].id));
  }

  const token = await gerarJWT({ role: 'admin', escola: cfg[0]?.escola || 'Splendore' }, getJwtSecret(c));
  return c.json({ ok: true, token });
});

// ─── AUTH PORTAL (pais) — SEGURO: não expõe outras alunas ────────────────────
app.post('/portal/auth', async (c) => {
  const { cpf } = await c.req.json();
  if (!cpf || cpf.replace(/\D/g,'').length < 11) {
    return c.json({ ok: false, error: 'CPF inválido' }, 400);
  }
  const cpfLimpo = cpf.replace(/\D/g,'');
  const d = db(c);
  // Busca apenas por cpf_responsavel — campo dedicado, server-side
  const aluna = await d.select({
    id: schema.alunas.id,
    nome: schema.alunas.nome,
    responsavel: schema.alunas.responsavel,
    modalidade: schema.alunas.modalidade,
    nivel: schema.alunas.nivel,
    valor: schema.alunas.valor,
    vencimento: schema.alunas.vencimento,
    turmaId: schema.alunas.turmaId,
  }).from(schema.alunas)
    .where(and(
      eq(schema.alunas.ativo, true),
      or(
        eq(schema.alunas.cpfResponsavel, cpfLimpo),
        eq(schema.alunas.cpfResponsavel2, cpfLimpo),
      )
    ))
    .limit(1);

  if (!aluna.length) return c.json({ ok: false, error: 'CPF não encontrado. Verifique com a escola.' }, 404);
  return c.json({ ok: true, aluna: aluna[0] });
});

// ─── HELPER: getConfig ───────────────────────────────────────────────────────
async function getConfig(c: any) {
  const cfg = await db(c).select().from(schema.config).limit(1);
  return cfg[0] as any ?? null;
}

// BUG-2 FIX: Helper para verificar se pagamento está realmente pago (não é apenas "pendente" marcado como pago)
const isPagoReal = (p: any) => p.status === 'pago' && p.forma !== 'Pendente';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
app.get('/config', async (c) => {
  const cfg = await db(c).select().from(schema.config).limit(1);
  if (!cfg.length) return c.json({});
  const { senhaHash, ...safe } = cfg[0] as any;
  return c.json(safe);
});

app.post('/config', async (c) => {
  const body = await c.req.json();
  const d = db(c);
  const existing = await d.select({ id: schema.config.id }).from(schema.config).limit(1);
  if (existing.length) {
    await d.update(schema.config).set({ ...body, updatedAt: new Date().toISOString() }).where(eq(schema.config.id, existing[0].id));
  } else {
    await d.insert(schema.config).values({ ...body });
  }
  return c.json({ ok: true });
});

app.post('/config/senha', async (c) => {
  const { senhaAtual, novaSenha } = await c.req.json();
  const d = db(c);
  const cfg = await d.select().from(schema.config).limit(1);
  const hashArmazenado = cfg[0]?.senhaHash ?? 'splendore2026';
  const senhaValida = await verificarSenha(senhaAtual, hashArmazenado);
  if (!senhaValida) return c.json({ ok: false, error: 'Senha atual incorreta' }, 401);
  if (!novaSenha || novaSenha.length < 4) return c.json({ ok: false, error: 'Nova senha muito curta' }, 400);
  const novoHash = await hashSenha(novaSenha);
  await d.update(schema.config).set({ senhaHash: novoHash }).where(eq(schema.config.id, cfg[0].id));
  return c.json({ ok: true });
});

// ─── ALUNAS ──────────────────────────────────────────────────────────────────
app.get('/alunas', async (c) => {
  const data = await db(c).select().from(schema.alunas)
    .where(eq(schema.alunas.ativo, true))
    .orderBy(schema.alunas.nome);
  return c.json(data);
});

app.get('/alunas/todas', async (c) => {
  const data = await db(c).select().from(schema.alunas).orderBy(schema.alunas.nome);
  return c.json(data);
});

app.post('/alunas', async (c) => {
  const body = await c.req.json();
  const id = body.id || genId();
  const cpf1 = (body.cpfResponsavel || '').replace(/\D/g,'') || null;
  const cpf2 = (body.cpfResponsavel2 || '').replace(/\D/g,'') || null;
  await db(c).insert(schema.alunas).values({ ...body, id, cpfResponsavel: cpf1, cpfResponsavel2: cpf2 })
    .onConflictDoUpdate({ target: schema.alunas.id, set: { ...body, cpfResponsavel: cpf1, cpfResponsavel2: cpf2, updatedAt: new Date().toISOString() } });
  return c.json({ ok: true, id });
});

app.put('/alunas/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const cpf1 = (body.cpfResponsavel || '').replace(/\D/g,'') || null;
  const cpf2 = (body.cpfResponsavel2 || '').replace(/\D/g,'') || null;
  await db(c).update(schema.alunas).set({ ...body, cpfResponsavel: cpf1, cpfResponsavel2: cpf2, updatedAt: new Date().toISOString() }).where(eq(schema.alunas.id, id));
  return c.json({ ok: true });
});

app.delete('/alunas/:id', async (c) => {
  const id = c.req.param('id');
  const d = db(c);
  const aluna = await d.select().from(schema.alunas).where(eq(schema.alunas.id, id)).limit(1);
  if (aluna.length) {
    // Move to arquivo morto
    await d.insert(schema.arquivoMorto).values({
      id: genId(),
      alunaId: id,
      nome: aluna[0].nome,
      responsavel: aluna[0].responsavel ?? '',
      whatsapp: aluna[0].whatsapp ?? '',
      modalidade: aluna[0].modalidade ?? '',
      valor: aluna[0].valor ?? 0,
      dados: JSON.stringify(aluna[0]),
    });
    await d.update(schema.alunas).set({ ativo: false }).where(eq(schema.alunas.id, id));
  }
  return c.json({ ok: true });
});

// ─── PAGAMENTOS ──────────────────────────────────────────────────────────────
app.get('/pagamentos', async (c) => {
  const data = await db(c).select().from(schema.pagamentos).orderBy(desc(schema.pagamentos.data)).limit(200);
  return c.json(data);
});

app.get('/pagamentos/mes/:mes', async (c) => {
  const mes = c.req.param('mes');
  const data = await db(c).select().from(schema.pagamentos).where(eq(schema.pagamentos.mes, mes));
  return c.json(data);
});

// Inadimplência inteligente:
// Só conta como inadimplente quem TEM histórico de pagamento nos últimos 3 meses
// mas não pagou o mês atual. Quem nunca pagou no sistema = provavelmente paga
// em dinheiro presencialmente, não aparece como inadimplente automático.
app.get('/inadimplentes', async (c) => {
  const d = db(c);
  const alunasList = await d.select().from(schema.alunas).where(eq(schema.alunas.ativo, true));
  const pagsList   = await d.select().from(schema.pagamentos);

  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;

  // Meses de referência para verificar histórico (últimos 3)
  const mesesHistorico: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const d2 = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    mesesHistorico.push(`${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}`);
  }

  // Quem pagou o mês atual
  // Só considera pago quem tem status='pago' E forma real (não 'Pendente' gerado automaticamente)
  const pagouMesAtual = new Set(
    pagsList.filter(p => p.mes === mesAtual && p.status === 'pago' && p.forma !== 'Pendente').map(p => p.alunaId)
  );

  // Quem tem histórico nos últimos 3 meses
  // Histórico real = pagamentos com forma real (não gerados automaticamente)
  const temHistoricoRecente = new Set(
    pagsList.filter(p => mesesHistorico.includes(p.mes) && p.forma !== 'Pendente').map(p => p.alunaId)
  );

  // Pré-calcular meses anteriores sem pagamento (até 12 meses atrás)
  const mesesAnteriores: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const d2 = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    mesesAnteriores.push(`${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}`);
  }

  const inadimplentes = alunasList.filter(aluna => {
    if (pagouMesAtual.has(aluna.id)) return false;
    // BUG-01 FIX: bolsistas nunca são inadimplentes
    if (aluna.bolsista) return false;
    return temHistoricoRecente.has(aluna.id);
  }).map(aluna => {
    // BUG-02 FIX: calcular meses acumulados reais
    const pagAluna = new Set(
      pagsList.filter(p => p.alunaId === aluna.id && p.status === 'pago' && p.forma !== 'Pendente').map(p => p.mes)
    );
    const mesesDevendoList = [mesAtual];
    for (const m of mesesAnteriores) {
      if (!pagAluna.has(m)) mesesDevendoList.push(m);
      else break; // para no primeiro mês pago (sem gaps)
    }
    const qtd = mesesDevendoList.length;
    return {
      ...aluna,
      mesesDevendo: mesesDevendoList,
      totalDebito: (aluna.valor ?? 0) * qtd,
      quantidadeMeses: qtd,
    };
  });

  return c.json(inadimplentes.sort((a, b) => b.quantidadeMeses - a.quantidadeMeses));
});

app.post('/pagamentos', async (c) => {
  const body = await c.req.json();
  const id = body.id || genId();
  const existing = await db(c).select({ id: schema.pagamentos.id })
    .from(schema.pagamentos)
    .where(and(eq(schema.pagamentos.alunaId, body.alunaId), eq(schema.pagamentos.mes, body.mes)));
  if (existing.length) return c.json({ ok: false, error: 'Pagamento já registrado para este mês' }, 409);

  // Calcular data de vencimento real baseada no dia da aluna
  let dataVencimento = body.dataVencimento || null;
  if (!dataVencimento && body.mes) {
    const alunaData = await db(c).select({ vencimento: schema.alunas.vencimento })
      .from(schema.alunas).where(eq(schema.alunas.id, body.alunaId)).limit(1);
    if (alunaData.length) {
      const dia = parseInt(alunaData[0].vencimento || '10');
      const [ano, mes] = body.mes.split('-');
      dataVencimento = `${ano}-${mes}-${String(dia).padStart(2,'0')}`;
    }
  }
  
  // Garantir que forma não fica vazia
  const forma = body.forma || 'Pix';
  
  await db(c).insert(schema.pagamentos).values({ 
    id,
    alunaId: body.alunaId,
    mes: body.mes,
    data: body.data,
    dataVencimento,
    valor: parseFloat(String(body.valor || 0)),
    status: 'pago',
    forma,
    observacao: body.observacao || null,
  });
  return c.json({ ok: true, id });
});

// ─── MENSALIDADES: visão completa do aluno (12 meses gerados) ────────────────
app.get('/mensalidades/:alunaId', async (c) => {
  const alunaId = c.req.param('alunaId');
  const anoParam = c.req.query('ano');
  const d = db(c);

  const alunaList = await d.select().from(schema.alunas).where(eq(schema.alunas.id, alunaId)).limit(1);
  if (!alunaList.length) return c.json({ error: 'Aluna não encontrada' }, 404);
  const aluna = alunaList[0];

  const pagsList = await d.select().from(schema.pagamentos)
    .where(eq(schema.pagamentos.alunaId, alunaId))
    .orderBy(desc(schema.pagamentos.mes));

  const hoje = new Date();
  const diaVcto = parseInt(aluna.vencimento || '10');

  // Usar ano do query param ou ano atual como fallback
  const anoAlvo = anoParam ? parseInt(anoParam) : hoje.getFullYear();
  const meses = [];

  for (let m = 1; m <= 12; m++) {
    const mesStr = `${anoAlvo}-${String(m).padStart(2,'0')}`;
    const dataVcto = new Date(anoAlvo, m - 1, diaVcto);
    const dataVctoStr = `${anoAlvo}-${String(m).padStart(2,'0')}-${String(diaVcto).padStart(2,'0')}`;

    const pag = pagsList.find(p => p.mes === mesStr);
    
    // Determinar status real
    let status: string;
    let isPago = false;
    if (pag && isPagoReal(pag)) {
      status = 'pago';
      isPago = true;
    } else if (pag && pag.status && pag.status !== 'pago') {
      status = pag.status;
    } else if (dataVcto < hoje) {
      status = 'atrasado';
    } else {
      status = 'pendente';
    }

    meses.push({
      mes: mesStr, diaVencimento: diaVcto, dataVencimento: dataVctoStr,
      valor: pag?.valor ?? aluna.valor ?? 160,
      status,
      pagamento: isPago ? pag : null,
    });
  }

  // Também incluir meses anteriores com pagamento
  const mesesGerados = new Set(meses.map(m => m.mes));
  const pagsExtras = pagsList.filter(p => !mesesGerados.has(p.mes));

  return c.json({ aluna, mensalidades: meses, pagamentosExtras: pagsExtras });
});

// ─── CORRIGIR VENCIMENTO DE ALUNA E MENSALIDADES FUTURAS ─────────────────────
app.put('/alunas/:id/vencimento', async (c) => {
  const id = c.req.param('id');
  const { diaVencimento } = await c.req.json();
  const dia = parseInt(String(diaVencimento));
  if (!dia || dia < 1 || dia > 31) return c.json({ error: 'Dia inválido' }, 400);

  const d = db(c);
  await d.update(schema.alunas).set({ vencimento: String(dia) }).where(eq(schema.alunas.id, id));

  // BUG-1 FIX: Atualizar dataVencimento das mensalidades NÃO PAGAS (pendente OU atrasado)
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
  const pagsPendentes = await d.select().from(schema.pagamentos)
    .where(and(eq(schema.pagamentos.alunaId, id), ne(schema.pagamentos.status, 'pago')));

  for (const p of pagsPendentes) {
    if (p.mes >= mesAtual) {
      const [ano, mes] = p.mes.split('-');
      const novaData = `${ano}-${mes}-${String(dia).padStart(2,'0')}`;
      await d.update(schema.pagamentos).set({ dataVencimento: novaData })
        .where(eq(schema.pagamentos.id, p.id));
    }
  }

  return c.json({ ok: true, diaVencimento: dia });
});

// ─── GERAR MENSALIDADES PENDENTES PARA UM ANO ────────────────────────────────
app.post('/mensalidades/gerar/:alunaId', async (c) => {
  const alunaId = c.req.param('alunaId');
  const { ano } = await c.req.json();
  const anoRef = ano || new Date().getFullYear();
  const d = db(c);

  const alunaList = await d.select().from(schema.alunas).where(eq(schema.alunas.id, alunaId)).limit(1);
  if (!alunaList.length) return c.json({ error: 'Aluna não encontrada' }, 404);
  const aluna = alunaList[0];

  const pagExistentes = await d.select({ mes: schema.pagamentos.mes })
    .from(schema.pagamentos).where(eq(schema.pagamentos.alunaId, alunaId));
  const mesesExistentes = new Set(pagExistentes.map(p => p.mes));

  const diaVcto = parseInt(aluna.vencimento || '10');
  const hoje = new Date();
  let gerados = 0;

  for (let m = 1; m <= 12; m++) {
    const mesStr = `${anoRef}-${String(m).padStart(2,'0')}`;
    if (mesesExistentes.has(mesStr)) continue; // já existe

    const dataVcto = new Date(anoRef, m - 1, diaVcto);
    const status = dataVcto < hoje ? 'atrasado' : 'pendente';
    const dataVctoStr = `${anoRef}-${String(m).padStart(2,'0')}-${String(diaVcto).padStart(2,'0')}`;

    await d.insert(schema.pagamentos).values({
      id: genId(),
      alunaId,
      mes: mesStr,
      data: dataVctoStr, // data de vencimento como placeholder
      dataVencimento: dataVctoStr,
      valor: aluna.valor ?? 160,
      status,
      forma: 'Pendente',
      observacao: 'Gerado automaticamente',
    });
    gerados++;
  }

  return c.json({ ok: true, gerados });
});

// ─── GERAR MENSALIDADES EM MASSA PARA TODAS AS ALUNAS ─────────────────────────
app.post('/mensalidades/gerar-todas', async (c) => {
  const { ano } = await c.req.json();
  const anoRef = ano || new Date().getFullYear();
  const d = db(c);

  const alunasList = await d.select().from(schema.alunas).where(eq(schema.alunas.ativo, true));
  const pagExistentes = await d.select({ alunaId: schema.pagamentos.alunaId, mes: schema.pagamentos.mes })
    .from(schema.pagamentos);

  const mesesPorAluna = new Map<string, Set<string>>();
  for (const p of pagExistentes) {
    if (!mesesPorAluna.has(p.alunaId)) mesesPorAluna.set(p.alunaId, new Set());
    mesesPorAluna.get(p.alunaId)!.add(p.mes);
  }

  const hoje = new Date();
  let totalGerados = 0;
  const inserts: any[] = [];

  for (const aluna of alunasList) {
    const diaVcto = parseInt(aluna.vencimento || '10');
    const mesesAluna = mesesPorAluna.get(aluna.id) || new Set();

    for (let m = 1; m <= 12; m++) {
      const mesStr = `${anoRef}-${String(m).padStart(2,'0')}`;
      if (mesesAluna.has(mesStr)) continue;

      const dataVcto = new Date(anoRef, m - 1, diaVcto);
      const status = dataVcto < hoje ? 'atrasado' : 'pendente';
      const dataVctoStr = `${anoRef}-${String(m).padStart(2,'0')}-${String(diaVcto).padStart(2,'0')}`;

      inserts.push({
        id: genId(),
        alunaId: aluna.id,
        mes: mesStr,
        data: dataVctoStr,
        dataVencimento: dataVctoStr,
        valor: aluna.valor ?? 160,
        status,
        forma: 'Pendente',
        observacao: 'Gerado automaticamente',
      });
      totalGerados++;
    }
  }

  // Inserir em lotes
  for (let i = 0; i < inserts.length; i += 100) {
    const lote = inserts.slice(i, i + 100);
    for (const item of lote) {
      await d.insert(schema.pagamentos).values(item).onConflictDoNothing();
    }
  }

  return c.json({ ok: true, gerados: totalGerados, alunas: alunasList.length });
});

// ─── DAR BAIXA (confirmar pagamento de mensalidade pendente) ──────────────────
app.put('/pagamentos/:id/pagar', async (c) => {
  const id = c.req.param('id');
  const { data, forma, valor, observacao } = await c.req.json();
  const d = db(c);
  const hoje = new Date().toISOString().split('T')[0];

  // Verificar se existe
  const pag = await d.select().from(schema.pagamentos).where(eq(schema.pagamentos.id, id)).limit(1);
  if (!pag.length) return c.json({ error: 'Pagamento não encontrado' }, 404);

  // Bloquear apenas se já pago COM forma real (não 'Pendente' automático)
  if (pag[0].status === 'pago' && pag[0].forma !== 'Pendente') {
    return c.json({ error: 'Pagamento já quitado' }, 409);
  }

  await d.update(schema.pagamentos).set({
    status: 'pago',
    data: data || hoje,
    forma: forma || 'Pix',
    valor: valor ? parseFloat(String(valor)) : pag[0].valor,
    observacao: observacao || null,
  }).where(eq(schema.pagamentos.id, id));

  return c.json({ ok: true });
});

app.delete('/pagamentos/:id', async (c) => {
  await db(c).delete(schema.pagamentos).where(eq(schema.pagamentos.id, c.req.param('id')));
  return c.json({ ok: true });
});

// ─── PORTAL: dados completos da aluna (autenticado por ID após login seguro) ─
app.get('/portal/aluna/:id', async (c) => {
  const id = c.req.param('id');
  const d = db(c);

  const [alunaList, pags, cfg, avisosData] = await Promise.all([
    d.select().from(schema.alunas).where(eq(schema.alunas.id, id)).limit(1),
    d.select().from(schema.pagamentos).where(eq(schema.pagamentos.alunaId, id)).orderBy(desc(schema.pagamentos.mes)),
    d.select({ pix: schema.config.pix, whatsapp: schema.config.whatsapp, escola: schema.config.escola, instagram: schema.config.instagram }).from(schema.config).limit(1),
    d.select().from(schema.avisos).orderBy(desc(schema.avisos.createdAt)).limit(20),
  ]);

  if (!alunaList.length) return c.json({ error: 'Aluna não encontrada' }, 404);
  const aluna = alunaList[0];

  // Gerar grid de 12 mensalidades do ano corrente
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const diaVcto = parseInt(aluna.vencimento || '10');
  const mensalidades = [];

  for (let m = 1; m <= 12; m++) {
    const mesStr = `${anoAtual}-${String(m).padStart(2,'0')}`;
    const dataVctoStr = `${anoAtual}-${String(m).padStart(2,'0')}-${String(diaVcto).padStart(2,'0')}`;
    const dataVcto = new Date(anoAtual, m - 1, diaVcto);
    const pag = pags.find(p => p.mes === mesStr);

    // Bolsista: todas as mensalidades são 'pago' — nunca mostrar débito
    if (aluna.bolsista) {
      mensalidades.push({
        mes: mesStr, diaVencimento: diaVcto, dataVencimento: dataVctoStr,
        valor: 0, status: 'pago', pagamento: null,
      });
      continue;
    }
    // Determinar status real:
    // - pago REAL = status='pago' E forma é uma forma de pagamento (não 'Pendente')
    // - 'Pendente' como forma = mensalidade gerada automaticamente, não é pagamento real
    const ehPagoReal = pag && isPagoReal(pag);
    let status = isPagoReal ? 'pago' : (dataVcto < hoje ? 'atrasado' : 'pendente');
    // Se tem registro com status vindo do banco (atrasado/pendente explícito), respeitar
    if (pag && !isPagoReal && pag.status && pag.status !== 'pago') status = pag.status;

    mensalidades.push({
      mes: mesStr,
      diaVencimento: diaVcto,
      dataVencimento: dataVctoStr,
      valor: aluna.valor ?? 160,
      status,
      pagamento: (pag && pag.status === 'pago' && pag.forma !== 'Pendente') ? pag : null,
    });
  }

  return c.json({
    aluna,
    pagamentos: pags.filter(p => p.status === 'pago' && p.forma !== 'Pendente'),
    mensalidades,
    config: cfg[0] ?? {},
    avisos: avisosData,
  });
});

// ─── TURMAS ──────────────────────────────────────────────────────────────────
app.get('/turmas', async (c) => {
  const data = await db(c).select().from(schema.turmas).orderBy(schema.turmas.nome);
  return c.json(data);
});

app.post('/turmas', async (c) => {
  const body = await c.req.json();
  const id = body.id || genId();
  await db(c).insert(schema.turmas).values({ ...body, id })
    .onConflictDoUpdate({ target: schema.turmas.id, set: body });
  return c.json({ ok: true, id });
});

// BUG-4 FIX: PUT /turmas/:id para edição de turmas
app.put('/turmas/:id', async (c) => {
  const body = await c.req.json();
  await db(c).update(schema.turmas).set(body).where(eq(schema.turmas.id, c.req.param('id')));
  return c.json({ ok: true });
});

app.delete('/turmas/:id', async (c) => {
  await db(c).delete(schema.turmas).where(eq(schema.turmas.id, c.req.param('id')));
  return c.json({ ok: true });
});

// ─── AVISOS ──────────────────────────────────────────────────────────────────
app.get('/avisos', async (c) => {
  const data = await db(c).select().from(schema.avisos).orderBy(desc(schema.avisos.createdAt));
  return c.json(data);
});

app.post('/avisos', async (c) => {
  const body = await c.req.json();
  await db(c).insert(schema.avisos).values({ id: genId(), ...body });
  return c.json({ ok: true });
});

app.delete('/avisos/:id', async (c) => {
  await db(c).delete(schema.avisos).where(eq(schema.avisos.id, c.req.param('id')));
  return c.json({ ok: true });
});

// ─── PRESENÇA ─────────────────────────────────────────────────────────────────
app.get('/presencas/:turmaId/:data', async (c) => {
  const { turmaId, data } = c.req.param();
  const result = await db(c).select().from(schema.presencas)
    .where(and(eq(schema.presencas.turmaId, turmaId), eq(schema.presencas.data, data)));
  return c.json(result);
});

app.post('/presencas', async (c) => {
  const body = await c.req.json();
  const id = genId();
  // PERF-4: upsert real por (alunaId, turmaId, data) — evita duplicatas silenciosas
  const existing = await db(c).select({ id: schema.presencas.id }).from(schema.presencas)
    .where(and(
      eq(schema.presencas.alunaId, body.alunaId),
      eq(schema.presencas.turmaId, body.turmaId || ''),
      eq(schema.presencas.data, body.data)
    )).limit(1);
  if (existing.length) {
    await db(c).update(schema.presencas).set({ presente: body.presente }).where(eq(schema.presencas.id, existing[0].id));
  } else {
    await db(c).insert(schema.presencas).values({ ...body, id });
  }
  return c.json({ ok: true });
});

// ─── ARQUIVO MORTO ────────────────────────────────────────────────────────────
app.get('/arquivo-morto', async (c) => {
  const data = await db(c).select().from(schema.arquivoMorto).orderBy(desc(schema.arquivoMorto.arquivadaEm));
  return c.json(data);
});

app.post('/arquivo-morto/:id/restaurar', async (c) => {
  const id = c.req.param('id');
  const d = db(c);
  const entry = await d.select().from(schema.arquivoMorto).where(eq(schema.arquivoMorto.id, id)).limit(1);
  if (!entry.length) return c.json({ error: 'Não encontrado' }, 404);
  await d.update(schema.alunas).set({ ativo: true, suspenso: false }).where(eq(schema.alunas.id, entry[0].alunaId));
  await d.delete(schema.arquivoMorto).where(eq(schema.arquivoMorto.id, id));
  return c.json({ ok: true });
});

// ─── RENOVAÇÕES: alunas com contrato próximo ao vencimento ───────────────────
app.get('/renovacoes', async (c) => {
  const alunasList = await db(c).select().from(schema.alunas).where(eq(schema.alunas.ativo, true));
  const hoje = new Date();
  
  // BUG-M1: só retorna quem tem contrato E vence em até 90 dias (ou já vencido)
  const resultado = alunasList
    .filter(aluna => {
      if (!aluna.contratoAte) return false;
      const dias = Math.floor((new Date(aluna.contratoAte).getTime() - hoje.getTime()) / 86400000);
      return dias <= 90;
    })
    .map(aluna => {
      const contratoAte = new Date(aluna.contratoAte!);
      const diasRestantes = Math.floor((contratoAte.getTime() - hoje.getTime()) / 86400000);
      let urgencia = 'ok';
      if (diasRestantes < 0) urgencia = 'vencido';
      else if (diasRestantes <= 30) urgencia = 'critico';
      else if (diasRestantes <= 60) urgencia = 'atencao';
      else urgencia = 'aviso';
      return { ...aluna, diasRestantes, urgencia };
    });

  return c.json(resultado.sort((a, b) => a.diasRestantes - b.diasRestantes));
});

// ─── IMPORTAR DADOS (migração completa) ──────────────────────────────────────
app.post('/importar', async (c) => {
  try {
    const body = await c.req.json();
    const al   = body.alunas       || [];
    const pags = body.pagamentos   || [];
    const ts   = body.turmas       || [];
    const cfg  = body.config       || {};
    const d    = db(c);
    let count  = 0;

    // 1. Turmas primeiro (alunas referenciam turmaId)
    for (const t of ts) {
      if (!t.id || !t.nome) continue;
      await d.insert(schema.turmas).values({
        id: t.id, nome: t.nome,
        modalidade: t.modalidade || 'Ballet',
        nivel: t.nivel || null,
        dias: t.dias || null,
        horario: t.horario || null,
        professor: t.professor || null,
        vagas: t.vagas ? parseInt(String(t.vagas)) : null,
        faixaEtaria: t.faixaEtaria || t.faixa || null,
        observacao: t.observacao || t.obs || null,
      }).onConflictDoNothing();
    }

    // 2. Alunas (ativas + inativas)
    for (const a of al) {
      if (!a.id || !a.nome) continue;
      const cpf1 = (a.cpfResponsavel || a.cpf_responsavel || '').replace(/\D/g,'') || null;
      const cpf2 = (a.cpfResponsavel2 || '').replace(/\D/g,'') || null;
      await d.insert(schema.alunas).values({
        id: a.id,
        nome: a.nome,
        responsavel: a.responsavel || a.nome,
        whatsapp: a.whatsapp || null,
        email: a.email || null,
        cpfResponsavel: cpf1,
        cpfResponsavel2: cpf2,
        modalidade: a.modalidade || 'Ballet',
        nivel: a.nivel || null,
        valor: parseFloat(String(a.valor)) || 160,
        vencimento: String(a.vencimento || '10'),
        nascimento: a.nascimento || null,
        turmaId: a.turmaId || a.turma_id || null,
        observacao: a.observacao || a.obs || null,
        ativo: a.ativo !== false,
        suspenso: !!a.suspenso,
        bolsista: !!a.bolsista,                         // BUG-11 FIX
        bolsaDesconto: a.bolsaDesconto ?? 0,
        valorOriginal: a.valorOriginal ?? null,
        autorizaImagem: a.autorizaImagem !== false,     // BUG-12 FIX: expr simplificada
        contratoNum: a.contratoNum || a.contrato_num || null,
        contratoDe: a.contratoDe || null,
        contratoAte: a.contratoAte || null,
        cadastro: a.cadastro || null,
      }).onConflictDoNothing();
      count++;
    }

    // 3. Pagamentos — aceita tanto 'alunaId' quanto 'alunoId' quanto 'aluna_id'
    // Buscar dias de vencimento por aluna para calcular dataVencimento
    const alunaVctoMap = new Map<string, string>();
    for (const a of al) {
      const aid = a.id;
      const dia = String(a.vencimento || '10');
      if (aid) alunaVctoMap.set(aid, dia);
    }

    let pagCount = 0;
    for (const p of pags) {
      const alunaId = p.alunaId || p.alunoId || p.aluna_id;
      if (!p.id || !alunaId || !p.mes) continue;
      const valor = parseFloat(String(p.valor));
      if (!valor || isNaN(valor)) continue;

      // Calcular dataVencimento real
      let dataVencimento = p.dataVencimento || null;
      if (!dataVencimento && p.mes) {
        const dia = alunaVctoMap.get(alunaId) || '10';
        const [ano, mes] = p.mes.split('-');
        dataVencimento = `${ano}-${mes}-${dia.padStart(2,'0')}`;
      }

      await d.insert(schema.pagamentos).values({
        id: p.id,
        alunaId,
        mes: p.mes,
        data: p.data || p.mes + '-01',
        dataVencimento,
        valor,
        status: 'pago',
        forma: p.forma || 'Pix',
        observacao: p.observacao || p.obs || null,
      }).onConflictDoNothing();
      pagCount++;
    }

    // 4. Config
    if (cfg && (cfg.escola || cfg.nomeAdmin)) {
      const existing = await d.select({ id: schema.config.id }).from(schema.config).limit(1);
      if (existing.length) {
        await d.update(schema.config).set({
          escola: cfg.escola || undefined,
          nomeAdmin: cfg.nomeAdmin || undefined,
          whatsapp: cfg.whatsapp || cfg.wpp || undefined,
          email: cfg.email || undefined,
          cidade: cfg.cidade || undefined,
          pix: cfg.pix || undefined,
        }).where(eq(schema.config.id, existing[0].id));
      } else {
        await d.insert(schema.config).values({
          escola: cfg.escola || 'Splendore Escola de Dança',
          nomeAdmin: cfg.nomeAdmin || 'Diretora',
          cidade: cfg.cidade || 'Cuiabá - MT',
        });
      }
    }

    return c.json({ ok: true, importados: count, pagamentos: pagCount });
  } catch (e: any) {
    console.error('Importar error:', e);
    return c.json({ ok: false, error: e.message || 'Erro interno' }, 500);
  }
});

// ─── SEM REMATRÍCULA ──────────────────────────────────────────────────────────
// Alunas inativas (arquivo morto) que podem ser recuperadas
app.get('/sem-rematricula', async (c) => {
  const d = db(c);
  const arquivo = await d.select().from(schema.arquivoMorto).orderBy(desc(schema.arquivoMorto.arquivadaEm));
  const pags = await d.select().from(schema.pagamentos);

  // Também buscar alunas ativas com contrato vencido há mais de 30 dias sem pagamento recente
  const alunasList = await d.select().from(schema.alunas).where(eq(schema.alunas.ativo, true));
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
  const mesAnterior = (() => { const d = new Date(hoje.getFullYear(), hoje.getMonth()-1, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })();

  const pagouRecente = new Set(
    pags.filter(p => p.mes === mesAtual || p.mes === mesAnterior).map(p => p.alunaId)
  );

  const suspeitasSemRemat = alunasList.filter(a => {
    if (pagouRecente.has(a.id)) return false;
    if (!a.contratoAte) return false;
    const vcto = new Date(a.contratoAte);
    const diff = Math.floor((hoje.getTime() - vcto.getTime()) / 86400000);
    return diff > 30; // contrato vencido há mais de 30 dias e não pagou recentemente
  }).map(a => ({
    id: genId(),
    alunaId: a.id,
    nome: a.nome,
    responsavel: a.responsavel,
    whatsapp: a.whatsapp,
    modalidade: a.modalidade,
    valor: a.valor,
    dados: JSON.stringify(a),
    arquivadaEm: a.contratoAte,
    motivo: 'Contrato vencido sem pagamento recente',
    _tipo: 'suspeita',
  }));

  return c.json({
    arquivoMorto: arquivo.map(a => ({ ...a, _tipo: 'inativa' })),
    suspeitasSemRemat,
  });
});

// ─── EFÍ BANK — BOLETOS & PIX ────────────────────────────────────────────────

// Busca token OAuth da Efí
async function efiGetToken(clientId: string, clientSecret: string, sandbox: boolean): Promise<string> {
  const base = sandbox ? 'https://sandbox.sejaefi.com.br' : 'https://api.sejaefi.com.br';
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const r = await fetch(`${base}/v1/authorize`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });
  if (!r.ok) throw new Error(`Efí auth error: ${r.status} - ${await r.text()}`);
  const data: any = await r.json();
  return data.access_token;
}

// Gerar boleto bancário pela Efí
app.post('/efi/boleto', async (c) => {
  const d = db(c);
  const body = await c.req.json();
  const { alunaId, mes, valor, vencimento } = body;

  // Buscar config Efí
  const cfg = await d.select().from(schema.config).limit(1);
  const config_data = cfg[0] as any;
  const clientId = config_data?.efiClientId;
  const clientSecret = config_data?.efiClientSecret;
  const sandbox = config_data?.efiSandbox !== false;

  if (!clientId || !clientSecret) {
    return c.json({ ok: false, error: 'Configure as credenciais da Efí Bank em Administração' }, 400);
  }

  // Buscar aluna
  const alunaList = await d.select().from(schema.alunas).where(eq(schema.alunas.id, alunaId)).limit(1);
  if (!alunaList.length) return c.json({ ok: false, error: 'Aluna não encontrada' }, 404);
  const aluna = alunaList[0];

  // CPF do responsável (obrigatório para boleto)
  const cpf = aluna.cpfResponsavel?.replace(/\D/g,'');
  if (!cpf || cpf.length !== 11) {
    return c.json({ ok: false, error: `CPF do responsável inválido para ${aluna.nome}. Cadastre o CPF na ficha da aluna.` }, 400);
  }

  try {
    const token = await efiGetToken(clientId, clientSecret, sandbox);
    const base = sandbox ? 'https://sandbox.sejaefi.com.br' : 'https://api.sejaefi.com.br';

    // Calcular vencimento (padrão: dia de vencimento da aluna neste mês)
    const vcto = vencimento || (() => {
      const [y, m] = mes.split('-');
      const dia = aluna.vencimento || '10';
      return `${y}-${m}-${String(dia).padStart(2,'0')}`;
    })();

    const payload = {
      items: [{
        name: `Mensalidade ${mes} - ${aluna.nome}`,
        value: Math.round((valor || aluna.valor || 160) * 100), // centavos
        amount: 1,
      }],
      customer: {
        name: aluna.responsavel || aluna.nome,
        cpf: cpf,
        phone_number: (aluna.whatsapp || '').replace(/\D/g,'').replace(/^55/, ''),
        email: aluna.email || undefined,
      },
      expire_at: vcto,
      payment_token: '',
      message: `Mensalidade ${mes} - Splendore Escola de Dança`,
      configurations: {
        fine: { type: 'percentage', value: 200 },    // 2% de multa
        interest: { type: 'daily_percentage', value: 10 }, // 0,1% ao dia
      },
    };

    const r = await fetch(`${base}/v1/charge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const err = await r.text();
      return c.json({ ok: false, error: `Efí error: ${err}` }, 400);
    }

    const data: any = await r.json();
    const charge = data.data;

    // Buscar link do boleto
    const rLink = await fetch(`${base}/v1/charge/${charge.charge_id}/billet`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const linkData: any = rLink.ok ? await rLink.json() : {};

    // Salvar cobrança no banco
    const cobrancaId = genId();
    await d.insert(schema.cobrancas).values({
      id: cobrancaId,
      alunaId,
      tipo: 'boleto',
      mes,
      valor: valor || aluna.valor || 160,
      status: 'pendente',
      chargeId: charge.charge_id,
      nossoNumero: charge.nosso_numero,
      linkBoleto: linkData.data?.link || charge.link || null,
      vencimento: vcto,
    });

    return c.json({
      ok: true,
      cobrancaId,
      chargeId: charge.charge_id,
      nossoNumero: charge.nosso_numero,
      linkBoleto: linkData.data?.link || charge.link,
      vencimento: vcto,
      valor: valor || aluna.valor || 160,
    });

  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// Gerar Pix de cobrança pela Efí (mais simples e sem CPF obrigatório)
app.post('/efi/pix', async (c) => {
  const d = db(c);
  const body = await c.req.json();
  const { alunaId, mes, valor } = body;

  const cfg = await d.select().from(schema.config).limit(1);
  const config_data = cfg[0] as any;
  const clientId = config_data?.efiClientId;
  const clientSecret = config_data?.efiClientSecret;
  const chavePix = config_data?.efiChavePix || config_data?.pix;
  const sandbox = config_data?.efiSandbox !== false;

  if (!clientId || !clientSecret) {
    return c.json({ ok: false, error: 'Configure as credenciais da Efí Bank em Administração' }, 400);
  }
  if (!chavePix) {
    return c.json({ ok: false, error: 'Configure a Chave Pix da Efí em Administração' }, 400);
  }

  const alunaList = await d.select().from(schema.alunas).where(eq(schema.alunas.id, alunaId)).limit(1);
  if (!alunaList.length) return c.json({ ok: false, error: 'Aluna não encontrada' }, 404);
  const aluna = alunaList[0];

  try {
    const token = await efiGetToken(clientId, clientSecret, sandbox);
    const base = sandbox ? 'https://sandbox.sejaefi.com.br' : 'https://api.sejaefi.com.br';

    // Vencimento: 5 dias a partir de hoje
    const vcto = new Date();
    vcto.setDate(vcto.getDate() + 5);
    const vctoStr = vcto.toISOString().split('T')[0];

    const txid = `SPL${Date.now()}`.substring(0, 35);
    const valorFinal = (valor || aluna.valor || 160).toFixed(2);

    const payload = {
      calendario: { expiracao: 432000 }, // 5 dias em segundos
      devedor: {
        nome: aluna.responsavel || aluna.nome,
        cpf: (aluna.cpfResponsavel || '').replace(/\D/g,'') || undefined,
      },
      valor: { original: valorFinal },
      chave: chavePix,
      solicitacaoPagador: `Mensalidade ${mes} - ${aluna.nome} - Splendore`,
    };

    const r = await fetch(`${base}/v2/cob/${txid}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const err = await r.text();
      return c.json({ ok: false, error: `Efí Pix error: ${err}` }, 400);
    }

    const data: any = await r.json();

    // Buscar QR Code
    let qrCode = null;
    let pixCopiaECola = data.pixCopiaECola || null;
    const rQr = await fetch(`${base}/v2/loc/${data.loc?.id}/qrcode`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (rQr.ok) {
      const qrData: any = await rQr.json();
      qrCode = qrData.imagemQrcode || null;
      pixCopiaECola = qrData.qrcode || pixCopiaECola;
    }

    // Salvar cobrança
    const cobrancaId = genId();
    await d.insert(schema.cobrancas).values({
      id: cobrancaId,
      alunaId,
      tipo: 'pix',
      mes,
      valor: parseFloat(valorFinal),
      status: 'pendente',
      txid,
      pixCopiaECola,
      qrCodeBase64: qrCode,
      vencimento: vctoStr,
    });

    return c.json({
      ok: true,
      cobrancaId,
      txid,
      pixCopiaECola,
      qrCodeBase64: qrCode,
      vencimento: vctoStr,
      valor: parseFloat(valorFinal),
    });

  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// Listar cobranças geradas
app.get('/cobrancas', async (c) => {
  const data = await db(c).select().from(schema.cobrancas).orderBy(desc(schema.cobrancas.createdAt));
  return c.json(data);
});

// Verificar status de cobrança na Efí e atualizar
app.post('/efi/verificar/:id', async (c) => {
  const d = db(c);
  const cobrancaId = c.req.param('id');
  const cobranca = await d.select().from(schema.cobrancas).where(eq(schema.cobrancas.id, cobrancaId)).limit(1);
  if (!cobranca.length) return c.json({ error: 'Não encontrada' }, 404);

  const cfg = await d.select().from(schema.config).limit(1);
  const config_data = cfg[0] as any;
  const clientId = config_data?.efiClientId;
  const clientSecret = config_data?.efiClientSecret;
  const sandbox = config_data?.efiSandbox !== false;
  if (!clientId || !clientSecret) return c.json({ error: 'Efí não configurada' }, 400);

  try {
    const token = await efiGetToken(clientId, clientSecret, sandbox);
    const base = sandbox ? 'https://sandbox.sejaefi.com.br' : 'https://api.sejaefi.com.br';
    const cb = cobranca[0];

    let status = cb.status;
    if (cb.tipo === 'boleto' && cb.chargeId) {
      const r = await fetch(`${base}/v1/charge/${cb.chargeId}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (r.ok) {
        const data: any = await r.json();
        const s = data.data?.status;
        if (s === 'paid') status = 'pago';
        else if (s === 'canceled' || s === 'expired') status = s === 'expired' ? 'expirado' : 'cancelado';
      }
    } else if (cb.tipo === 'pix' && cb.txid) {
      const r = await fetch(`${base}/v2/cob/${cb.txid}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (r.ok) {
        const data: any = await r.json();
        if (data.status === 'CONCLUIDA') status = 'pago';
        else if (data.status === 'REMOVIDA_PELO_USUARIO_RECEBEDOR') status = 'cancelado';
      }
    }

    if (status !== cb.status) {
      await d.update(schema.cobrancas).set({ status, dataPagamento: status === 'pago' ? new Date().toISOString().split('T')[0] : null }).where(eq(schema.cobrancas.id, cobrancaId));
    }

    return c.json({ ok: true, status });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SISTEMA DE RECÁLCULO E PARCELAMENTO
// ═══════════════════════════════════════════════════════════════════════════

// ─── RECALCULAR PLANO: divide total por parcelas, atualiza mensalidades futuras
app.post('/recalcular/:alunaId', async (c) => {
  const alunaId = c.req.param('alunaId');
  const { valorTotal, parcelas, planoTipo, anoRef } = await c.req.json();

  if (!valorTotal || !parcelas || parcelas < 1 || parcelas > 12) {
    return c.json({ ok: false, error: 'Informe valorTotal e parcelas (1-12)' }, 400);
  }

  const d = db(c);
  const alunaList = await d.select().from(schema.alunas).where(eq(schema.alunas.id, alunaId)).limit(1);
  if (!alunaList.length) return c.json({ ok: false, error: 'Aluna não encontrada' }, 404);
  const aluna = alunaList[0];

  const valorParcela = Math.round((valorTotal / parcelas) * 100) / 100;
  const hoje = new Date();
  const anoAlvo = anoRef || hoje.getFullYear();
  const diaVcto = parseInt(aluna.vencimento || '10');

  // Atualizar campo valor e plano da aluna
  await d.update(schema.alunas).set({
    valor: valorParcela,
    planoTotal: valorTotal,
    planoParcelas: parcelas,
    planoTipo: planoTipo || (parcelas === 12 ? 'mensal' : parcelas === 6 ? 'semestral' : parcelas === 3 ? 'trimestral' : 'personalizado'),
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.alunas.id, alunaId));

  // Buscar mensalidades existentes
  const pagsList = await d.select().from(schema.pagamentos).where(eq(schema.pagamentos.alunaId, alunaId));

  // Determinar meses a gerar (baseado no tipo de parcelamento)
  const mesesAlvo: string[] = [];
  if (parcelas === 12) {
    for (let m = 1; m <= 12; m++) {
      mesesAlvo.push(`${anoAlvo}-${String(m).padStart(2,'0')}`);
    }
  } else {
    // Para 6 ou 3 parcelas, usar meses a partir do mês atual
    const mesInicio = hoje.getMonth(); // 0-indexed
    for (let i = 0; i < parcelas; i++) {
      const d2 = new Date(anoAlvo, mesInicio + i, 1);
      mesesAlvo.push(`${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}`);
    }
  }

  let atualizados = 0;
  let pulados = 0; // já pagos — não toca

  for (const mesStr of mesesAlvo) {
    const pagExistente = pagsList.find(p => p.mes === mesStr);
    const dataVcto = new Date(parseInt(mesStr.split('-')[0]), parseInt(mesStr.split('-')[1]) - 1, diaVcto);
    const dataVctoStr = `${mesStr}-${String(diaVcto).padStart(2,'0')}`;
    const status: string = dataVcto < hoje ? 'atrasado' : 'pendente';

    if (pagExistente) {
      // JÁ PAGO DE VERDADE (forma real, não 'Pendente') → preservar, não alterar
      const ehPagoReal = pagExistente.status === 'pago' && pagExistente.forma !== 'Pendente';
      if (ehPagoReal) {
        pulados++;
        continue;
      }
      // Pendente/atrasado → atualiza valor
      await d.update(schema.pagamentos).set({
        valor: valorParcela,
        dataVencimento: dataVctoStr,
        status,
      }).where(eq(schema.pagamentos.id, pagExistente.id));
      atualizados++;
    } else {
      // Não existe → criar
      await d.insert(schema.pagamentos).values({
        id: genId(),
        alunaId,
        mes: mesStr,
        data: dataVctoStr,
        dataVencimento: dataVctoStr,
        valor: valorParcela,
        status,
        forma: 'Pendente',
        observacao: `Plano ${planoTipo || 'recalculado'} — ${parcelas}x R$ ${valorParcela}`,
      }).onConflictDoNothing();
      atualizados++;
    }
  }

  return c.json({
    ok: true,
    valorParcela,
    mesesAlvo: mesesAlvo.length,
    atualizados,
    pulados,
    mensagem: `Plano recalculado: ${parcelas}x R$ ${valorParcela.toFixed(2)} | ${atualizados} meses atualizados | ${pulados} pagos (preservados)`,
  });
});

// ─── EDIÇÃO EM LOTE: alterar valor de múltiplas mensalidades (só pendentes)
app.post('/mensalidades/editar-lote', async (c) => {
  const body = await c.req.json();
  const { alunaId, mesIds, meses, novoValor, desconto, tipoDesconto = 'valor', motivo } = body; // BUG-3: tipoDesconto explícito

  if (!alunaId || (!mesIds?.length && !meses?.length)) {
    return c.json({ ok: false, error: 'Informe alunaId e mesIds ou meses' }, 400);
  }

  const d = db(c);
  let atualizados = 0;
  let pulados = 0;

  const pagsList = await d.select().from(schema.pagamentos).where(eq(schema.pagamentos.alunaId, alunaId));

  // Filtrar pelos IDs ou meses informados
  const alvos = mesIds?.length
    ? pagsList.filter(p => mesIds.includes(p.id))
    : pagsList.filter(p => meses.includes(p.mes));

  for (const pag of alvos) {
    // REGRA DE SEGURANÇA: nunca alterar pagamentos já quitados
    if (isPagoReal(pag)) { // BUG-2: usar isPagoReal
      pulados++;
      continue;
    }

    let valorFinal = novoValor ? parseFloat(String(novoValor)) : pag.valor;
    if (desconto) {
      const desc = parseFloat(String(desconto));
      // BUG-3 FIX: tipo explícito (valor ou percentual)
      if (tipoDesconto === 'percentual') {
        valorFinal = valorFinal * (1 - desc / 100);
      } else {
        valorFinal = valorFinal - desc;
      }
    }
    valorFinal = Math.round(valorFinal * 100) / 100;

    await d.update(schema.pagamentos).set({
      valor: valorFinal,
      observacao: motivo || `Valor ajustado manualmente`,
    }).where(eq(schema.pagamentos.id, pag.id));
    atualizados++;
  }

  return c.json({ ok: true, atualizados, pulados });
});

// ─── DIAGNÓSTICO: identifica inconsistências de valor
app.get('/diagnostico/:alunaId', async (c) => {
  const alunaId = c.req.param('alunaId');
  const d = db(c);

  const alunaList = await d.select().from(schema.alunas).where(eq(schema.alunas.id, alunaId)).limit(1);
  if (!alunaList.length) return c.json({ error: 'Não encontrada' }, 404);
  const aluna = alunaList[0];

  const pagsList = await d.select().from(schema.pagamentos)
    .where(eq(schema.pagamentos.alunaId, alunaId))
    .orderBy(schema.pagamentos.mes);

  const hoje = new Date();
  const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;

  // Agrupar por valor
  const valoresDist: Record<number, number> = {};
  const inconsistentes: any[] = [];

  for (const p of pagsList) {
    valoresDist[p.valor] = (valoresDist[p.valor] || 0) + 1;
  }

  const valorPrincipal = aluna.valor;
  for (const p of pagsList) {
    if (p.status !== 'pago' && Math.abs(p.valor - valorPrincipal) > 0.01) {
      inconsistentes.push({
        id: p.id, mes: p.mes, valorAtual: p.valor,
        valorCorreto: valorPrincipal,
        diferenca: p.valor - valorPrincipal,
        status: p.status,
      });
    }
  }

  const stats = {
    totalMeses: pagsList.length,
    pagos: pagsList.filter(p => p.status === 'pago' && p.forma !== 'Pendente').length,
    pendentes: pagsList.filter(p => p.status === 'pendente').length,
    atrasados: pagsList.filter(p => p.status === 'atrasado').length,
    valoresDiferentes: Object.keys(valoresDist).length,
    valorPrincipal,
    planoTotal: aluna.planoTotal,
    planoParcelas: aluna.planoParcelas,
    inconsistentes: inconsistentes.length,
  };

  return c.json({ aluna, stats, inconsistentes, valoresDist });
});

// ─── CORRIGIR INCONSISTÊNCIAS EM MASSA
app.post('/corrigir-inconsistencias/:alunaId', async (c) => {
  const alunaId = c.req.param('alunaId');
  const { valorCorreto } = await c.req.json();
  const d = db(c);

  const alunaList = await d.select().from(schema.alunas).where(eq(schema.alunas.id, alunaId)).limit(1);
  if (!alunaList.length) return c.json({ error: 'Não encontrada' }, 404);
  const aluna = alunaList[0];

  const valorAlvo = valorCorreto || aluna.valor;
  const pagsList = await d.select().from(schema.pagamentos).where(eq(schema.pagamentos.alunaId, alunaId));

  let corrigidos = 0;
  let pulados = 0;

  for (const p of pagsList) {
    // Só pular pagamentos REAIS — não pular os gerados automaticamente com forma='Pendente'
    if (p.status === 'pago' && p.forma !== 'Pendente') { pulados++; continue; }
    if (Math.abs(p.valor - valorAlvo) > 0.01) {
      await d.update(schema.pagamentos).set({
        valor: valorAlvo,
        observacao: `Valor corrigido de R$ ${p.valor} para R$ ${valorAlvo}`,
      }).where(eq(schema.pagamentos.id, p.id));
      corrigidos++;
    }
  }

  return c.json({ ok: true, corrigidos, pulados, valorAlvo });
});

// ─── EDIÇÃO RÁPIDA DE UMA MENSALIDADE
app.put('/mensalidades/editar/:id', async (c) => {
  const id = c.req.param('id');
  const { valor, observacao, dataVencimento } = await c.req.json();
  const d = db(c);

  const pag = await d.select().from(schema.pagamentos).where(eq(schema.pagamentos.id, id)).limit(1);
  if (!pag.length) return c.json({ error: 'Não encontrado' }, 404);
  if (isPagoReal(pag[0])) return c.json({ error: 'Pagamento já quitado — não pode ser alterado' }, 403); // BUG-2 FIX

  const updates: any = {};
  if (valor !== undefined) updates.valor = parseFloat(String(valor));
  if (observacao) updates.observacao = observacao;
  if (dataVencimento) updates.dataVencimento = dataVencimento;

  await d.update(schema.pagamentos).set(updates).where(eq(schema.pagamentos.id, id));
  return c.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// TELEGRAM BOT — Integração completa com IA (Claude/OpenRouter)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Helper: enviar mensagem para o Telegram ─────────────────────────────────
async function tgSend(token: string, chatId: string, text: string, parseMode = 'Markdown') {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
    });
  } catch {}
}

// ─── Helper: chamar IA (OpenRouter ou fallback) ────────────────────────────────
async function callIA(apiKey: string, systemPrompt: string, userMsg: string): Promise<string> {
  const model = 'openrouter/auto';
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Splendore Bot',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
      max_tokens: 800,
      temperature: 0.4,
    }),
  });
  if (!r.ok) throw new Error(`IA error ${r.status}`);
  const data: any = await r.json();
  return data.choices?.[0]?.message?.content || '(sem resposta)';
}

// ─── Processar comando do Telegram ───────────────────────────────────────────
async function processarComando(msg: string, d: any, token: string, chatId: string): Promise<string> {
  const texto = msg.trim();
  const cmd   = texto.toLowerCase();
  const hoje  = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
  const dataHoje  = hoje.toISOString().split('T')[0];
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const nomeMesAtual = MESES[hoje.getMonth()];

  // Buscar dados
  const alunas = await d.select().from(schema.alunas).where(eq(schema.alunas.ativo, true));
  const pags   = await d.select().from(schema.pagamentos);
  const avisos = await d.select().from(schema.avisos).orderBy(desc(schema.avisos.createdAt)).limit(5);
  const cfg    = await d.select().from(schema.config).limit(1);
  const escola = cfg[0]?.escola || 'Splendore';
  const wppEscola = cfg[0]?.whatsapp || '';

  const pagouMes = new Set(
    pags.filter((p:any) => p.mes===mesAtual && p.status==='pago' && p.forma!=='Pendente').map((p:any)=>p.alunaId)
  );
  const inad = alunas.filter((a:any) => !pagouMes.has(a.id) && !a.bolsista);
  const pagsMes = pags.filter((p:any) => p.mes===mesAtual && p.status==='pago' && p.forma!=='Pendente');
  const recebido = pagsMes.reduce((s:number,p:any)=>s+(p.valor||0),0);
  const aReceber = inad.reduce((s:number,a:any)=>s+(a.valor||0),0);
  const taxa = alunas.length ? Math.round(((alunas.length-inad.length)/alunas.length)*100) : 0;

  // ── AJUDA ─────────────────────────────────────────────────────────────────
  if (cmd === '/start' || cmd === '/ajuda' || cmd === '/help') {
    return `🩰 *${escola} — Assistente Inteligente*\n\n` +
      `📊 *Relatórios:*\n` +
      `/resumo — visão geral completa\n` +
      `/hoje — o que aconteceu hoje\n` +
      `/mes — relatório do mês\n` +
      `/alunas — lista por modalidade\n\n` +
      `💰 *Financeiro:*\n` +
      `/inadimplentes — quem não pagou\n` +
      `/pagamentos — pagamentos confirmados\n` +
      `/receber — total a receber\n` +
      `/cobrar — lista com telefones\n\n` +
      `✏️ *Ações:*\n` +
      `/pagar [nome] — registrar pagamento\n` +
      `/aviso [texto] — publicar aviso\n` +
      `/buscar [nome] — buscar aluna\n\n` +
      `🤖 *IA — pergunte qualquer coisa:*\n` +
      `_"Quem pagou hoje?"\n` +
      `"Qual turma tem mais inadimplentes?"\n` +
      `"Listar alunas do Ballet que não pagaram"\n` +
      `"Qual o total recebido esta semana?"_`;
  }

  // ── RESUMO ────────────────────────────────────────────────────────────────
  if (cmd === '/resumo') {
    const pagsHoje = pagsMes.filter((p:any) => p.data===dataHoje);
    const totalHoje = pagsHoje.reduce((s:number,p:any)=>s+(p.valor||0),0);
    return `📊 *Resumo — ${nomeMesAtual}/${hoje.getFullYear()}*\n\n` +
      `👥 Alunas ativas: *${alunas.length}*\n` +
      `✅ Pagaram este mês: *${pagsMes.length}* (${taxa}%)\n` +
      `⚠️ Inadimplentes: *${inad.length}*\n\n` +
      `💰 Recebido no mês: *R$ ${recebido.toFixed(2).replace('.',',')}*\n` +
      `📋 A receber: *R$ ${aReceber.toFixed(2).replace('.',',')}*\n` +
      (totalHoje>0 ? `\n📅 Hoje: *R$ ${totalHoje.toFixed(2).replace('.',',')}* (${pagsHoje.length} pag.)` : '\n📅 Hoje: nenhum pagamento ainda') +
      `\n\n_${dataHoje.split('-').reverse().join('/')}_`;
  }

  // ── HOJE ──────────────────────────────────────────────────────────────────
  if (cmd === '/hoje') {
    const pagsHoje = pags.filter((p:any) => p.data===dataHoje && p.status==='pago' && p.forma!=='Pendente');
    const totalHoje = pagsHoje.reduce((s:number,p:any)=>s+(p.valor||0),0);
    if (!pagsHoje.length) return `📅 *Hoje (${dataHoje.split('-').reverse().join('/')})*\n\nNenhum pagamento registrado ainda hoje.`;
    const lista = pagsHoje.map((p:any) => {
      const a = alunas.find((x:any)=>x.id===p.alunaId);
      return `  ✓ ${a?.nome?.split(' ').slice(0,2).join(' ')||'?'} — R$ ${p.valor.toFixed(0)} (${p.forma})`;
    }).join('\n');
    return `📅 *Hoje — ${dataHoje.split('-').reverse().join('/')}*\n\n${lista}\n\n💰 Total: *R$ ${totalHoje.toFixed(2).replace('.',',')}*`;
  }

  // ── MÊS ───────────────────────────────────────────────────────────────────
  if (cmd === '/mes') {
    // Últimos 5 pagamentos
    const ultimos = [...pagsMes].sort((a:any,b:any)=>(b.data||'').localeCompare(a.data||'')).slice(0,5);
    const lista = ultimos.map((p:any) => {
      const a = alunas.find((x:any)=>x.id===p.alunaId);
      return `  ✓ ${a?.nome?.split(' ')[0]||'?'} — R$ ${p.valor.toFixed(0)} (${(p.data||'').split('-').slice(1).reverse().join('/')})`;
    }).join('\n');
    return `📊 *${nomeMesAtual}/${hoje.getFullYear()}*\n\n` +
      `✅ Pagamentos: ${pagsMes.length}\n` +
      `💰 Recebido: *R$ ${recebido.toFixed(2).replace('.',',')}*\n` +
      `⚠️ A receber: *R$ ${aReceber.toFixed(2).replace('.',',')}*\n\n` +
      `*Últimos pagamentos:*\n${lista || '  _Nenhum ainda_'}`;
  }

  // ── ALUNAS ────────────────────────────────────────────────────────────────
  if (cmd === '/alunas') {
    const mods: Record<string,number> = {};
    const niveis: Record<string,number> = {};
    alunas.forEach((a:any) => {
      mods[a.modalidade]=(mods[a.modalidade]||0)+1;
      if (a.nivel) niveis[a.nivel]=(niveis[a.nivel]||0)+1;
    });
    const modStr = Object.entries(mods).map(([m,n])=>`  • ${m}: *${n}*`).join('\n');
    const nivStr = Object.entries(niveis).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,c])=>`  • ${n}: ${c}`).join('\n');
    return `👥 *${alunas.length} Alunas Ativas*\n\n*Por modalidade:*\n${modStr}\n\n*Por nível:*\n${nivStr}`;
  }

  // ── INADIMPLENTES ─────────────────────────────────────────────────────────
  if (cmd === '/inadimplentes' || cmd === '/inad') {
    if (!inad.length) return `✅ *Parabéns!*\nNenhuma inadimplente em ${nomeMesAtual}.`;
    const lista = inad.slice(0,15).map((a:any,i:number) =>
      `${i+1}\\. ${a.nome.split(' ').slice(0,2).join(' ')} — R$ ${(a.valor||160).toFixed(0)}`
    ).join('\n');
    return `⚠️ *${inad.length} inadimplentes — ${nomeMesAtual}*\n\n${lista}` +
      (inad.length>15 ? `\n_...e mais ${inad.length-15}_` : '') +
      `\n\n💰 Total: *R$ ${aReceber.toFixed(2).replace('.',',')}*`;
  }

  // ── PAGAMENTOS ────────────────────────────────────────────────────────────
  if (cmd === '/pagamentos' || cmd === '/pag') {
    const pagsHoje = pags.filter((p:any)=>p.data===dataHoje&&p.status==='pago'&&p.forma!=='Pendente');
    const totalHoje = pagsHoje.reduce((s:number,p:any)=>s+(p.valor||0),0);
    const listaHoje = pagsHoje.length
      ? pagsHoje.slice(0,8).map((p:any)=>{
          const a=alunas.find((x:any)=>x.id===p.alunaId);
          return `  ✓ ${a?.nome?.split(' ')[0]||'?'} — R$ ${p.valor.toFixed(0)}`;
        }).join('\n')
      : '  _Nenhum hoje_';
    return `✅ *Pagamentos — ${nomeMesAtual}*\n\n` +
      `📅 *Hoje:*\n${listaHoje}\nTotal hoje: *R$ ${totalHoje.toFixed(2).replace('.',',')}*\n\n` +
      `📊 *No mês:* ${pagsMes.length} confirmados\n` +
      `💰 Total mês: *R$ ${recebido.toFixed(2).replace('.',',')}*`;
  }

  // ── RECEBER ───────────────────────────────────────────────────────────────
  if (cmd === '/receber') {
    // Detalhar por modalidade
    const porMod: Record<string,{qtd:number,total:number}> = {};
    inad.forEach((a:any)=>{
      const m = a.modalidade||'Outro';
      if (!porMod[m]) porMod[m]={qtd:0,total:0};
      porMod[m].qtd++;
      porMod[m].total+=a.valor||160;
    });
    const lista = Object.entries(porMod).map(([m,v])=>`  • ${m}: ${v.qtd} alunas — R$ ${v.total.toFixed(0)}`).join('\n');
    return `💰 *A Receber — ${nomeMesAtual}*\n\n${lista}\n\n*Total: R$ ${aReceber.toFixed(2).replace('.',',')}*\n${inad.length} alunas pendentes`;
  }

  // ── COBRAR ────────────────────────────────────────────────────────────────
  if (cmd === '/cobrar') {
    const lista = inad.slice(0,10).map((a:any,i:number)=>{
      const wpp = (a.whatsapp||'').replace(/\D/g,'');
      const link = wpp ? `wa.me/55${wpp}` : 'sem telefone';
      return `${i+1}\\. *${a.nome.split(' ').slice(0,2).join(' ')}* — R$ ${(a.valor||160).toFixed(0)}\n   📱 ${link}`;
    }).join('\n');
    return `📱 *Cobrar — ${inad.length} inadimplentes*\n\n${lista}` +
      (inad.length>10?`\n\n_...e mais ${inad.length-10} no sistema_`:'');
  }

  // ── AVISO ─────────────────────────────────────────────────────────────────
  if (cmd.startsWith('/aviso ') || cmd.startsWith('/avisos ')) {
    const textoAviso = texto.slice(texto.indexOf(' ')+1).trim();
    if (!textoAviso) return `ℹ️ Use: /aviso [texto do comunicado]\n\nEx: /aviso Aula cancelada na sexta-feira`;
    try {
      await d.insert(schema.avisos).values({ id: genId(), mensagem: textoAviso, tipo: 'geral' });
      return `✅ *Aviso publicado!*\n\n📢 "${textoAviso}"\n\nTodas as famílias verão no Portal da Família.`;
    } catch { return `❌ Erro ao publicar aviso.`; }
  }

  // ── BUSCAR ALUNA ──────────────────────────────────────────────────────────
  if (cmd.startsWith('/buscar ') || cmd.startsWith('/aluna ')) {
    const busca = texto.slice(texto.indexOf(' ')+1).trim().toUpperCase();
    const encontradas = alunas.filter((a:any) =>
      a.nome.toUpperCase().includes(busca) || (a.responsavel||'').toUpperCase().includes(busca)
    );
    if (!encontradas.length) return `🔍 Nenhuma aluna encontrada para "${busca}"`;
    const lista = encontradas.slice(0,5).map((a:any) => {
      const pagou = pagouMes.has(a.id);
      const status = pagou ? '✅ Em dia' : '⚠️ Pendente';
      return `*${a.nome}*\n  ${a.modalidade}${a.nivel?' · '+a.nivel:''} · Dia ${a.vencimento||10}\n  R$ ${(a.valor||160).toFixed(0)}/mês · ${status}\n  📱 ${a.whatsapp||'sem tel'}\n  Resp: ${a.responsavel||'—'}`;
    }).join('\n\n');
    return `🔍 *${encontradas.length > 1 ? encontradas.length+' encontradas' : 'Encontrada'}*\n\n${lista}`;
  }

  // ── REGISTRAR PAGAMENTO ───────────────────────────────────────────────────
  if (cmd.startsWith('/pagar ')) {
    const nomeBusca = texto.slice(7).trim().toUpperCase();
    const encontradas = alunas.filter((a:any) => a.nome.toUpperCase().includes(nomeBusca));
    if (!encontradas.length) return `❌ Aluna não encontrada: "${nomeBusca}"\n\nUse: /pagar [nome]`;
    if (encontradas.length > 3) return `⚠️ Encontradas ${encontradas.length} alunas. Seja mais específico:\n${encontradas.slice(0,5).map((a:any)=>a.nome).join('\n')}`;
    const aluna = encontradas[0];
    if (pagouMes.has(aluna.id)) return `✅ *${aluna.nome.split(' ')[0]}* já pagou ${nomeMesAtual}!`;
    // Registrar pagamento
    try {
      const diaVcto = aluna.vencimento||'10';
      const dataVcto = `${mesAtual}-${diaVcto.padStart(2,'0')}`;
      await d.insert(schema.pagamentos).values({
        id: genId(), alunaId: aluna.id, mes: mesAtual,
        data: dataHoje, dataVencimento: dataVcto,
        valor: aluna.valor||160, status: 'pago', forma: 'Pix',
        observacao: 'Registrado via Telegram',
      }).onConflictDoNothing();
      return `✅ *Pagamento registrado!*\n\n🩰 ${aluna.nome}\n💰 R$ ${(aluna.valor||160).toFixed(2).replace('.',',')}\n📅 ${dataHoje.split('-').reverse().join('/')}\n🔑 Forma: Pix\n\n_Registrado via Telegram_`;
    } catch(e:any) { return `❌ Erro: ${e.message}`; }
  }

  // ── AVISOS EXISTENTES ─────────────────────────────────────────────────────
  if (cmd === '/avisos') {
    if (!avisos.length) return `📢 Nenhum aviso publicado ainda.\n\nPara publicar: /aviso [texto]`;
    const lista = avisos.map((a:any) => {
      const dt = a.createdAt ? new Date(a.createdAt).toLocaleDateString('pt-BR') : '';
      return `📢 _${dt}_ — ${a.mensagem.slice(0,80)}${a.mensagem.length>80?'...':''}`;
    }).join('\n\n');
    return `📢 *Últimos Avisos*\n\n${lista}`;
  }

  // ── TURMAS ────────────────────────────────────────────────────────────────
  if (cmd === '/turmas') {
    const turmas = await d.select().from(schema.turmas).orderBy(schema.turmas.nome);
    if (!turmas.length) return `🎭 Nenhuma turma cadastrada ainda.`;
    const lista = turmas.map((t:any) => {
      const cnt = alunas.filter((a:any)=>a.turmaId===t.id).length;
      return `  • *${t.nome}* — ${t.dias||'?'} ${t.horario||''} (${cnt} alunas)`;
    }).join('\n');
    return `🎭 *${turmas.length} Turmas*\n\n${lista}`;
  }

  // ── Se nada bateu → retorna null para usar IA ─────────────────────────────
  return null as any;
}

// ─── WEBHOOK do Telegram ───────────────────────────────────────────────────────
app.post('/telegram/webhook', async (c) => {
  try {
    const update = await c.req.json();
    const d = db(c);

    const cfg = await d.select().from(schema.config).limit(1);
    const config_data = cfg[0] as any;

    if (!config_data?.telegramToken || !config_data?.telegramAtivo) {
      return c.json({ ok: true });
    }

    const token   = config_data.telegramToken;
    const chatId  = config_data.telegramChatId;

    const message = update.message || update.edited_message;
    if (!message?.text) return c.json({ ok: true });

    const fromId  = String(message.from?.id || '');
    const msgText = message.text;
    const msgChatId = String(message.chat?.id || '');

    // Segurança: só aceita mensagens do chat ID autorizado
    if (chatId && fromId !== chatId && msgChatId !== chatId) {
      await tgSend(token, msgChatId, '🚫 Acesso não autorizado.');
      return c.json({ ok: true });
    }

    // Processar comando (passa token e chatId para poder fazer ações)
    let resposta = await processarComando(msgText, d, token, msgChatId);

    // Se não era comando direto → usar IA com contexto completo
    if (!resposta) {
      const apiKey = config_data.openrouterKey;

      if (!apiKey) {
        resposta = `❓ Não reconheci esse comando.\n\nUse /ajuda para ver tudo que posso fazer.\n\nPara respostas com IA, configure a API Key do OpenRouter em *Bot Telegram* no sistema.`;
      } else {
        // Contexto rico para a IA
        const alunas = await d.select().from(schema.alunas).where(eq(schema.alunas.ativo, true));
        const pags   = await d.select().from(schema.pagamentos);
        const hoje   = new Date();
        const mes    = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
        const dataHoje = hoje.toISOString().split('T')[0];
        const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        const nomeMes = MESES[hoje.getMonth()];
        const pagouMes = new Set(pags.filter((p:any)=>p.mes===mes&&p.status==='pago'&&p.forma!=='Pendente').map((p:any)=>p.alunaId));
        const inad = alunas.filter((a:any)=>!pagouMes.has(a.id) && !a.bolsista);
        const recebido = pags.filter((p:any)=>p.mes===mes&&p.status==='pago'&&p.forma!=='Pendente').reduce((s:number,p:any)=>s+(p.valor||0),0);
        const pagsHoje = pags.filter((p:any)=>p.data===dataHoje&&p.status==='pago'&&p.forma!=='Pendente');
        const totalHoje = pagsHoje.reduce((s:number,p:any)=>s+(p.valor||0),0);
        const mods: Record<string,number> = {};
        alunas.forEach((a:any)=>{mods[a.modalidade]=(mods[a.modalidade]||0)+1;});
        const inadNomes = inad.slice(0,20).map((a:any)=>`${a.nome} (${a.modalidade}, R$ ${a.valor||160}, tel:${a.whatsapp||'sem'})`).join('\n');
        const pagsHojeNomes = pagsHoje.map((p:any)=>{const a=alunas.find((x:any)=>x.id===p.alunaId);return `${a?.nome||'?'} R$ ${p.valor}`;}).join(', ');

        const systemPrompt = `Você é assistente inteligente da ${config_data.escola||'Splendore Escola de Dança'} em Cuiabá-MT.
Responda SEMPRE em português brasileiro, de forma direta, amigável e com emojis.
Resposta máxima: 300 palavras. Use negrito (*texto*) para destacar.

═══ DADOS ATUAIS ═══
Data: ${dataHoje} | Mês: ${nomeMes}/${hoje.getFullYear()}

ALUNAS:
- Total ativas: ${alunas.length}
- Por modalidade: ${Object.entries(mods).map(([m,n])=>`${m}(${n})`).join(', ')}

FINANCEIRO DO MÊS:
- Pagaram: ${pagouMes.size} de ${alunas.length} (${Math.round(pagouMes.size/alunas.length*100)}%)
- Inadimplentes: ${inad.length}
- Recebido: R$ ${recebido.toFixed(2)}
- A receber: R$ ${inad.reduce((s:number,a:any)=>s+(a.valor||0),0).toFixed(2)}

HOJE (${dataHoje}):
- Pagamentos: ${pagsHoje.length} totalizando R$ ${totalHoje.toFixed(2)}
${pagsHoje.length > 0 ? `- Quem pagou: ${pagsHojeNomes}` : '- Nenhum pagamento ainda hoje'}

INADIMPLENTES (top 20):
${inadNomes || 'Nenhum'}
═══════════════════

Responda a pergunta do usuário com base nesses dados reais.
Se pedirem para registrar pagamento, diga para usar: /pagar [nome]
Se pedirem lista de inadimplentes, use os dados acima.`;

        try {
          resposta = await callIA(apiKey, systemPrompt, msgText);
        } catch(e:any) {
          resposta = `❌ Erro na IA: ${e.message}\n\nUse /ajuda para comandos diretos.`;
        }
      }
    }

    await tgSend(token, msgChatId, resposta);
    return c.json({ ok: true });

  } catch (e: any) {
    console.error('Telegram webhook error:', e);
    return c.json({ ok: true }); // sempre retorna 200 para o Telegram
  }
});

// ─── Configurar webhook do Telegram ───────────────────────────────────────────
app.post('/telegram/setup', async (c) => {
  const { token, chatId, webhookUrl, openrouterKey } = await c.req.json();
  if (!token) return c.json({ ok: false, error: 'Token obrigatório' }, 400);

  const d = db(c);

  // Registrar webhook no Telegram
  const webhookEndpoint = `${webhookUrl}/api/telegram/webhook`;
  const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookEndpoint, allowed_updates: ['message'] }),
  });
  const result: any = await r.json();

  if (!result.ok) return c.json({ ok: false, error: result.description }, 400);

  // Salvar no banco
  const existing = await d.select({ id: schema.config.id }).from(schema.config).limit(1);
  const updates = {
    telegramToken: token,
    telegramChatId: chatId || '',
    telegramAtivo: true,
    openrouterKey: openrouterKey || null,
  };

  if (existing.length) {
    await d.update(schema.config).set(updates).where(eq(schema.config.id, existing[0].id));
  } else {
    await d.insert(schema.config).values({ ...updates, escola: 'Splendore Escola de Dança' });
  }

  // Enviar mensagem de boas-vindas
  if (chatId) {
    await tgSend(token, chatId,
      `🩰 *Bot Splendore ativado!*\n\nEnvie /ajuda para ver os comandos disponíveis.\n\n_Você também pode fazer perguntas livres como "Quem não pagou este mês?"_`
    );
  }

  return c.json({ ok: true, webhook: webhookEndpoint, message: result.description });
});

// ─── Testar bot ──────────────────────────────────────────────────────────────
app.get('/telegram/status', async (c) => {
  const d = db(c);
  const cfg = await d.select().from(schema.config).limit(1);
  const config_data = cfg[0] as any;

  if (!config_data?.telegramToken) return c.json({ ativo: false, erro: 'Bot não configurado' });

  try {
    const r = await fetch(`https://api.telegram.org/bot${config_data.telegramToken}/getMe`);
    const bot: any = await r.json();
    return c.json({
      ativo: config_data.telegramAtivo,
      bot: bot.result,
      chatId: config_data.telegramChatId,
      temIA: !!config_data.openrouterKey,
    });
  } catch {
    return c.json({ ativo: false, erro: 'Erro ao conectar com Telegram' });
  }
});

// ── BOLSISTA: converter aluna ──────────────────────────────────────────────────
app.post('/alunas/:id/bolsista', async (c) => {
  const id = c.req.param('id');
  const { bolsista, desconto } = await c.req.json(); // desconto: 0-100
  const d = db(c);

  const [aluna] = await d.select().from(schema.alunas).where(eq(schema.alunas.id, id)).limit(1);
  if (!aluna) return c.json({ ok: false, error: 'Aluna não encontrada' }, 404);

  if (bolsista) {
    // Convertendo para bolsista
    const pct = typeof desconto === 'number' ? Math.min(100, Math.max(0, desconto)) : 100;
    const valorOrig = aluna.valorOriginal || aluna.valor; // preserva o original se já tiver sido alterado
    const novoValor = pct >= 100 ? 0 : Math.round(valorOrig * (1 - pct / 100) * 100) / 100;
    await d.update(schema.alunas).set({
      bolsista: true,
      bolsaDesconto: pct,
      valorOriginal: valorOrig,
      valor: novoValor,
      updatedAt: new Date().toISOString(),
    }).where(eq(schema.alunas.id, id));
    return c.json({ ok: true, novoValor, valorOriginal: valorOrig, desconto: pct });
  } else {
    // Revertendo para pagante — restaura valor original
    const valorRestaurado = aluna.valorOriginal || aluna.valor;
    await d.update(schema.alunas).set({
      bolsista: false,
      bolsaDesconto: 0,
      valorOriginal: null,
      valor: valorRestaurado,
      updatedAt: new Date().toISOString(),
    }).where(eq(schema.alunas.id, id));
    return c.json({ ok: true, valorRestaurado });
  }
});

// ── IA CHAT (server-side, sem expor API key ao cliente) ───────────────────────
app.post('/ia/chat', async (c) => {
  const d = db(c);
  const config_data = await getConfig(c);
  const apiKey = config_data?.openrouterKey;

  if (!apiKey) {
    return c.json({ error: 'API Key do OpenRouter não configurada. Vá em Bot Telegram → configure a chave OpenRouter.' }, 400);
  }

  const { messages } = await c.req.json();

  // Contexto atual do sistema
  const ativas = await d.select().from(schema.alunas).where(eq(schema.alunas.ativo, true));
  const pagamentos_all = await d.select().from(schema.pagamentos)
    .orderBy(desc(schema.pagamentos.data)).limit(500); // BUG-C2: limit para evitar timeout CF Workers
  const mes = new Date().toISOString().slice(0, 7);

  const pagsMes = pagamentos_all.filter(p => p.mes === mes);
  const pagasIds = new Set(pagsMes.filter(p => p.status === 'pago' || (p.status !== 'pendente' && p.status !== 'atrasado')).map(p => p.alunaId));
  const inadimplentes = ativas.filter(a => !a.bolsista && !pagasIds.has(a.id));
  const bolsistas = ativas.filter(a => a.bolsista);
  const recebido = pagsMes.reduce((s, p) => s + (p.valor || 0), 0);

  const listaAlunos = ativas.slice(0, 40).map(a =>
    `- ${a.nome} | ${a.modalidade} | R$ ${a.valor} | ${a.bolsista ? 'BOLSISTA' : pagasIds.has(a.id) ? 'PAGO' : 'DEVENDO'} | WhatsApp: ${a.whatsapp || 'N/A'}`
  ).join('\n');

  const listaInad = inadimplentes.slice(0, 20).map(a =>
    `- ${a.nome} | R$ ${a.valor} | WhatsApp: ${a.whatsapp || 'N/A'} | Resp: ${a.responsavel}`
  ).join('\n');

  const listaBolsistas = bolsistas.map(a =>
    `- ${a.nome} | ${a.modalidade}`
  ).join('\n');

  const sistemCtx = `Você é RunClaw, assistente administrativo inteligente da ${config_data?.escola || 'Splendore Escola de Dança'} em ${config_data?.cidade || 'Cuiabá-MT'}.
Você tem acesso completo ao sistema e pode executar ações administrativas.

DADOS ATUAIS (${mes}):
- Alunas ativas: ${ativas.length} (${ativas.length - bolsistas.length} pagantes, ${bolsistas.length} bolsistas)
- Inadimplentes: ${inadimplentes.length}
- Em dia: ${ativas.length - inadimplentes.length - bolsistas.length}
- Receita confirmada: R$ ${recebido.toFixed(2)}
- A receber: R$ ${inadimplentes.reduce((s, a) => s + (a.valor || 0), 0).toFixed(2)}

TODAS AS ALUNAS:
${listaAlunos}

INADIMPLENTES (${inadimplentes.length}):
${listaInad || 'Nenhuma'}

BOLSISTAS (${bolsistas.length}):
${listaBolsistas || 'Nenhuma'}

AÇÕES DISPONÍVEIS (responda com JSON de ação quando necessário):
- Para gerar mensagem de cobrança: inclua um bloco JSON no formato:
  {"acao":"cobranca","alunas":[{"nome":"...","whatsapp":"...","valor":0,"responsavel":"..."}]}
- Para listar inadimplentes detalhado: apenas responda com dados
- Para converter em bolsista: {"acao":"converter_bolsista","alunaId":"...","nome":"..."}
- Para relatório: {"acao":"relatorio","tipo":"financeiro|inadimplentes|bolsistas"}

Responda sempre em português, seja direto e útil. Use markdown simples.
Para ações executáveis, inclua o JSON de ação junto com a explicação.`;

  try {
    const resp = await callIA(apiKey, sistemCtx, messages[messages.length - 1]?.content || '');

    // Tenta extrair JSON de ação se houver
    const jsonMatch = resp.match(/\{[\s\S]*?"acao"[\s\S]*?\}/);
    let acao = null;
    if (jsonMatch) {
      try { acao = JSON.parse(jsonMatch[0]); } catch {}
    }

    return c.json({ resposta: resp, acao, inadimplentes: inadimplentes.slice(0, 20), alunas: ativas.slice(0, 50) });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ── RELATÓRIO FINANCEIRO ───────────────────────────────────────────────────────
app.get('/relatorios/financeiro', async (c) => {
  const d = db(c);
  const mes = c.req.query('mes') || new Date().toISOString().slice(0, 7);
  const ativas = await d.select().from(schema.alunas).where(eq(schema.alunas.ativo, true));
  const pagamentos_all = await d.select().from(schema.pagamentos);

  const pagsMes = pagamentos_all.filter(p => p.mes === mes);
  const pagas = pagsMes.filter(p => p.status !== 'pendente' && p.status !== 'atrasado' && p.forma !== 'Pendente');
  const bolsistas = ativas.filter(a => a.bolsista);
  const pagantes = ativas.filter(a => !a.bolsista);
  const pagasIds = new Set(pagas.map(p => p.alunaId));
  const inadimplentes = pagantes.filter(a => !pagasIds.has(a.id));

  // Últimos 6 meses
  const historico: any[] = [];
  const hoje = new Date();
  for (let i = 5; i >= 0; i--) {
    const d2 = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const m = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}`;
    const pags = pagamentos_all.filter(p => p.mes === m && p.status !== 'pendente' && p.status !== 'atrasado' && p.forma !== 'Pendente');
    historico.push({ mes: m, total: pags.reduce((s, p) => s + (p.valor || 0), 0), qtd: pags.length });
  }

  return c.json({
    mes,
    ativas: ativas.length,
    pagantes: pagantes.length,
    bolsistas: bolsistas.length,
    pagas: pagas.length,
    inadimplentes: inadimplentes.length,
    recebido: pagas.reduce((s, p) => s + (p.valor || 0), 0),
    apagar: inadimplentes.reduce((s, a) => s + (a.valor || 0), 0),
    potencial: pagantes.reduce((s, a) => s + (a.valor || 0), 0),
    pagamentos: pagas.map(p => ({ ...p, aluna: ativas.find(a => a.id === p.alunaId) })),
    listaInadimplentes: inadimplentes.map(a => ({ id: a.id, nome: a.nome, modalidade: a.modalidade, valor: a.valor, whatsapp: a.whatsapp, responsavel: a.responsavel })),
    listaBolsistas: bolsistas.map(a => ({ id: a.id, nome: a.nome, modalidade: a.modalidade })),
    historico,
  });
});

// ── ANALYTICS AVANÇADO — nível Mindbody/ZenPlanner ─────────────────────────
app.get('/analytics', async (c) => {
  const d = db(c);
  const [ativasList, pagsList] = await Promise.all([
    d.select().from(schema.alunas).where(eq(schema.alunas.ativo, true)),
    d.select().from(schema.pagamentos),
  ]);

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtualStr = `${anoAtual}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
  const pagsReais = (p: any) => p.status !== 'pendente' && p.status !== 'atrasado' && p.forma !== 'Pendente';

  // Helpers
  const mesStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const meses12 = Array.from({ length: 12 }, (_, i) => {
    const d2 = new Date(anoAtual, i, 1);
    return mesStr(d2);
  });

  // --- MRR / Receita por mês (12 meses) ---
  const receitaMensal = meses12.map(m => ({
    mes: m,
    realizado: pagsList.filter(p => p.mes === m && pagsReais(p)).reduce((s, p) => s + (p.valor || 0), 0),
    qtd: pagsList.filter(p => p.mes === m && pagsReais(p)).length,
  }));

  // --- MRR potencial ---
  const pagantes = ativasList.filter(a => !a.bolsista);
  const bolsistas = ativasList.filter(a => a.bolsista);
  const mrr = pagantes.reduce((s, a) => s + (a.valor || 0), 0);

  // --- Receita acumulada ano ---
  const recAno = receitaMensal.reduce((s, m) => s + m.realizado, 0);

  // --- Ticket médio ---
  const pagsMesAtual = pagsList.filter(p => p.mes === mesAtualStr && pagsReais(p));
  const ticket = pagsMesAtual.length > 0 ? pagsMesAtual.reduce((s, p) => s + (p.valor || 0), 0) / pagsMesAtual.length : 0;

  // --- Crescimento MoM ---
  const mesAnt = mesStr(new Date(anoAtual, hoje.getMonth()-1, 1));
  const recMes = receitaMensal.find(m => m.mes === mesAtualStr)?.realizado || 0;
  const recAnt = pagsList.filter(p => p.mes === mesAnt && pagsReais(p)).reduce((s, p) => s + (p.valor || 0), 0);
  const momPct = recAnt > 0 ? Math.round(((recMes - recAnt) / recAnt) * 100) : 0;

  // --- Inadimplência por modalidade ---
  const pagasIds = new Set(pagsMesAtual.map(p => p.alunaId));
  const inad = pagantes.filter(a => !pagasIds.has(a.id));
  const inadPorMod: Record<string, { total: number; inad: number }> = {};
  pagantes.forEach(a => {
    if (!inadPorMod[a.modalidade]) inadPorMod[a.modalidade] = { total: 0, inad: 0 };
    inadPorMod[a.modalidade].total++;
  });
  inad.forEach(a => {
    if (inadPorMod[a.modalidade]) inadPorMod[a.modalidade].inad++;
  });

  // --- Alunas por mês de cadastro (crescimento base) ---
  const crescimentoCadastros = meses12.map(m => ({
    mes: m,
    novas: ativasList.filter(a => (a.cadastro || '').startsWith(m)).length,
  }));

  // --- Formas de pagamento mais usadas ---
  const formasDist: Record<string, number> = {};
  pagsMesAtual.forEach(p => {
    const f = p.forma || 'Pix';
    formasDist[f] = (formasDist[f] || 0) + 1;
  });

  // --- Taxa de retenção (simplificada: % que pagou mês atual e mês anterior) ---
  const pagouAmbos = pagantes.filter(a => {
    const pagouMesAtual = pagasIds.has(a.id);
    const pagouMesAnt = pagsList.some(p => p.alunaId === a.id && p.mes === mesAnt && pagsReais(p));
    return pagouMesAtual && pagouMesAnt;
  });
  const retencao = pagantes.length > 0 ? Math.round((pagouAmbos.length / pagantes.length) * 100) : 100;

  // --- Previsão próximo mês (média ponderada 3m) ---
  const hist3 = [0,1,2].map(i => {
    const d2 = new Date(anoAtual, hoje.getMonth()-i, 1);
    return pagsList.filter(p => p.mes === mesStr(d2) && pagsReais(p)).reduce((s,p) => s+(p.valor||0), 0);
  });
  const previsao = Math.round((hist3[0]*0.5 + hist3[1]*0.3 + hist3[2]*0.2) * 100) / 100;

  // --- LTV médio estimado ---
  const ltvMedio = ticket * 12;

  // --- Churn risk (devendo 2+ meses) ---
  const churnRisk = inad.filter(a => {
    // Verifica meses anteriores
    let mesesDevendo = 0;
    for (let i = 1; i <= 6; i++) {
      const d2 = new Date(anoAtual, hoje.getMonth()-i, 1);
      const mPrev = mesStr(d2);
      if (!pagsList.some(p => p.alunaId === a.id && p.mes === mPrev && pagsReais(p))) mesesDevendo++;
      else break;
    }
    return mesesDevendo >= 1; // devendo mês atual + pelo menos 1 anterior
  }).length;

  return c.json({
    snapshot: {
      totalAlunas: ativasList.length,
      pagantes: pagantes.length,
      bolsistas: bolsistas.length,
      inadimplentes: inad.length,
      taxa: pagantes.length > 0 ? Math.round(((pagantes.length - inad.length) / pagantes.length) * 100) : 100,
    },
    financeiro: {
      mrr, recAno, recMes, recAnt, momPct, ticket, ltvMedio, previsao,
      aReceber: inad.reduce((s, a) => s + (a.valor || 0), 0),
      meta: mrr,
      pctMeta: mrr > 0 ? Math.min(Math.round((recMes / mrr) * 100), 100) : 0,
    },
    retencao,
    churnRisk,
    receitaMensal,
    crescimentoCadastros,
    formasDist,
    inadPorMod,
  });
});

// ── UPLOAD DE FOTO (R2) ───────────────────────────────────────────────────────
app.post('/portal/upload-foto/:alunaId', async (c) => {
  const alunaId = c.req.param('alunaId');
  const bucket = c.env.BUCKET;

  const formData = await c.req.formData();
  const file = formData.get('foto') as File | null;

  if (!file) return c.json({ ok: false, error: 'Nenhum arquivo enviado' }, 400);

  // Validação
  if (!file.type.startsWith('image/')) return c.json({ ok: false, error: 'Apenas imagens são permitidas' }, 400);
  if (file.size > 5 * 1024 * 1024) return c.json({ ok: false, error: 'Foto muito grande (máx 5MB)' }, 400);

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const key = `fotos/${alunaId}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  await bucket.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
    customMetadata: { alunaId, uploadedAt: new Date().toISOString() },
  });

  // URL pública via API
  const fotoUrl = `/api/portal/foto/${alunaId}`;

  // Salvar URL na aluna
  const d = db(c);
  await d.update(schema.alunas).set({ fotoUrl, updatedAt: new Date().toISOString() }).where(eq(schema.alunas.id, alunaId));

  return c.json({ ok: true, fotoUrl });
});

// ── SERVIR FOTO (R2) ──────────────────────────────────────────────────────────
app.get('/portal/foto/:alunaId', async (c) => {
  const alunaId = c.req.param('alunaId');
  const bucket = c.env.BUCKET;

  // Tenta jpg, png, webp
  for (const ext of ['jpg', 'png', 'webp']) {
    const obj = await bucket.get(`fotos/${alunaId}.${ext}`);
    if (obj) {
      const headers = new Headers();
      headers.set('Content-Type', obj.httpMetadata?.contentType || `image/${ext}`);
      headers.set('Cache-Control', 'public, max-age=3600');
      return new Response(obj.body, { headers });
    }
  }
  return c.json({ error: 'Foto não encontrada' }, 404);
});

// ── ENVIAR COMPROVANTE (notifica escola via config) ───────────────────────────
app.post('/portal/enviar-comprovante', async (c) => {
  const { alunaId, mes, valor, forma, nomeAluna, nomeResponsavel } = await c.req.json();

  const config_data = await getConfig(c);
  const token = config_data?.telegramToken;
  const chatId = config_data?.telegramChatId;

  const msgs: string[] = [];

  // Notificar via Telegram se configurado
  if (token && chatId) {
    const texto = `🧾 *COMPROVANTE RECEBIDO*\n\nAluna: *${nomeAluna}*\nResponsável: ${nomeResponsavel}\nMês: *${mes}*\nValor: *R$ ${Number(valor).toFixed(2).replace('.',',')}*\nForma: ${forma || 'Pix'}\n\n_Verifique e registre o pagamento no sistema._`;
    try {
      await tgSend(token, chatId, texto);
      msgs.push('telegram');
    } catch {}
  }

  return c.json({ ok: true, notificados: msgs });
});

// ── PORTAL DO PROFESSOR ───────────────────────────────────────────────────────

// Auth professor — valida pelo nome do professor + senha da escola (simples por ora)
app.post('/professor/auth', async (c) => {
  const { senha, professorNome } = await c.req.json();
  if (!senha) return c.json({ ok: false, error: 'Senha obrigatória' }, 400);
  const d = db(c);
  const cfg = await d.select().from(schema.config).limit(1);
  const hash = cfg[0]?.senhaHash ?? 'splendore2026';
  const senhaValida = await verificarSenha(senha, hash);
  if (!senhaValida) return c.json({ ok: false, error: 'Senha incorreta' }, 401);

  // Buscar turmas do professor
  const todasTurmas = await d.select().from(schema.turmas);
  let minhasTurmas = professorNome
    ? todasTurmas.filter(t => t.professor && t.professor.toLowerCase().includes(professorNome.toLowerCase()))
    : todasTurmas;

  // Se não encontrou turmas com esse nome, retorna todas (professor vê tudo)
  return c.json({ ok: true, turmas: minhasTurmas.length > 0 ? minhasTurmas : todasTurmas });
});

// Dados do professor: turmas, alunas, aniversariantes
app.get('/professor/dados', async (c) => {
  const d = db(c);
  const [todasAlunas, todasTurmas] = await Promise.all([
    d.select().from(schema.alunas).where(eq(schema.alunas.ativo, true)),
    d.select().from(schema.turmas),
  ]);

  const hoje = new Date();
  const mesAtualNum = hoje.getMonth() + 1;

  // Aniversariantes do mês
  const aniversariantes = todasAlunas.filter(a => {
    if (!a.nascimento) return false;
    const parts = a.nascimento.split('-');
    if (parts.length < 2) return false;
    const mesNasc = parseInt(parts[1]);
    return mesNasc === mesAtualNum;
  }).map(a => {
    const parts = a.nascimento!.split('-');
    const dia = parseInt(parts[2] || '1');
    const jaPassou = dia < hoje.getDate();
    const ehHoje = dia === hoje.getDate();
    return { ...a, diaNasc: dia, ehHoje, jaPassou };
  }).sort((a, b) => a.diaNasc - b.diaNasc);

  return c.json({ turmas: todasTurmas, alunas: todasAlunas, aniversariantes });
});

// Presença via portal professor
app.get('/professor/presencas/:turmaId/:data', async (c) => {
  const { turmaId, data } = c.req.param();
  const result = await db(c).select().from(schema.presencas)
    .where(and(eq(schema.presencas.turmaId, turmaId), eq(schema.presencas.data, data)));
  return c.json(result);
});

app.post('/professor/presencas', async (c) => {
  const body = await c.req.json();
  const d = db(c);
  const id = genId();
  await d.insert(schema.presencas).values({ ...body, id })
    .onConflictDoUpdate({ target: schema.presencas.id, set: body });
  return c.json({ ok: true });
});

// Histórico de presença de uma aluna
app.get('/professor/frequencia/:alunaId', async (c) => {
  const alunaId = c.req.param('alunaId');
  const d = db(c);
  const presencasAluna = await d.select().from(schema.presencas)
    .where(eq(schema.presencas.alunaId, alunaId))
    .orderBy(desc(schema.presencas.data));
  const total = presencasAluna.length;
  const presentes = presencasAluna.filter(p => p.presente).length;
  return c.json({ total, presentes, faltas: total - presentes, lista: presencasAluna.slice(0, 30) });
});

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO 2 — BACKUP & EXPORT
// ══════════════════════════════════════════════════════════════════════════════

app.get('/admin/export', async (c) => {
  const d = db(c);
  const [alunasList, pagsList, turmasList, presencasList, cobrancasList, avisosList, configList, arquivoList] = await Promise.all([
    d.select().from(schema.alunas),
    d.select().from(schema.pagamentos),
    d.select().from(schema.turmas),
    d.select().from(schema.presencas),
    d.select().from(schema.cobrancas),
    d.select().from(schema.avisos),
    d.select().from(schema.config),
    d.select().from(schema.arquivoMorto),
  ]);
  const exportData = {
    versao: '2.0',
    exportadoEm: new Date().toISOString(),
    escola: configList[0]?.escola || 'Splendore',
    totais: { alunas: alunasList.length, pagamentos: pagsList.length, turmas: turmasList.length, presencas: presencasList.length },
    dados: {
      config: configList.map((cfg: any) => { const { senhaHash, efiClientSecret, sicoobClientSecret, openrouterKey, ...safe } = cfg; return safe; }),
      turmas: turmasList, alunas: alunasList, pagamentos: pagsList,
      presencas: presencasList, cobrancas: cobrancasList, avisos: avisosList, arquivoMorto: arquivoList,
    }
  };
  const json = JSON.stringify(exportData, null, 2);
  const nomeArquivo = `splendore_backup_${new Date().toISOString().split('T')[0]}.json`;
  return new Response(json, {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${nomeArquivo}"` },
  });
});

app.post('/admin/restore', async (c) => {
  const body = await c.req.json();
  if (!body.dados || !body.versao) return c.json({ ok: false, error: 'Formato de backup inválido' }, 400);
  const d = db(c);
  let restaurados = { alunas: 0, pagamentos: 0, turmas: 0, presencas: 0 };
  for (const t of (body.dados.turmas || [])) {
    await d.insert(schema.turmas).values(t).onConflictDoNothing();
    restaurados.turmas++;
  }
  for (const a of (body.dados.alunas || [])) {
    await d.insert(schema.alunas).values(a).onConflictDoNothing();
    restaurados.alunas++;
  }
  for (const p of (body.dados.pagamentos || [])) {
    await d.insert(schema.pagamentos).values(p).onConflictDoNothing();
    restaurados.pagamentos++;
  }
  for (const p of (body.dados.presencas || [])) {
    await d.insert(schema.presencas).values(p).onConflictDoNothing();
    restaurados.presencas++;
  }
  return c.json({ ok: true, restaurados });
});

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO 3 — CONTRATO DIGITAL
// ══════════════════════════════════════════════════════════════════════════════

function gerarHTMLContrato(aluna: any, config: any): string {
  const dataHoje = new Date().toLocaleDateString('pt-BR');
  const valorFormatado = `R$ ${(aluna.valor || 160).toFixed(2).replace('.', ',')}`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#333;font-size:14px;line-height:1.6}h1{text-align:center;color:#1e2d2b;font-size:20px;margin-bottom:4px}h2{font-size:15px;color:#1e2d2b;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:24px}.dados{background:#f9f9f9;padding:16px;border-radius:8px;margin:16px 0}.dados p{margin:4px 0}.clausula{margin:12px 0}.assinatura{margin-top:60px;border-top:2px solid #333;padding-top:16px;text-align:center}.rodape{margin-top:40px;font-size:11px;color:#999;text-align:center}</style></head><body>
  <h1>${config.escola || 'Splendore Escola de Dança'}</h1>
  <p style="text-align:center;color:#666;margin:0">CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS</p>
  <div class="dados"><h2>Dados do Contratante</h2><p><strong>Nome:</strong> ${aluna.responsavel}</p><p><strong>CPF:</strong> ${aluna.cpfResponsavel || 'Não informado'}</p><p><strong>WhatsApp:</strong> ${aluna.whatsapp || 'Não informado'}</p></div>
  <div class="dados"><h2>Dados do(a) Aluno(a)</h2><p><strong>Nome:</strong> ${aluna.nome}</p><p><strong>Modalidade:</strong> ${aluna.modalidade}</p><p><strong>Valor mensal:</strong> ${valorFormatado}</p><p><strong>Vencimento:</strong> Todo dia ${aluna.vencimento || 10}</p><p><strong>Vigência:</strong> ${aluna.contratoDe || dataHoje} a ${aluna.contratoAte || '31/12/' + new Date().getFullYear()}</p></div>
  <h2>Cláusulas</h2>
  <div class="clausula"><strong>1. OBJETO:</strong> A contratada compromete-se a prestar serviços de ensino de dança na modalidade ${aluna.modalidade} para o(a) aluno(a) acima identificado(a).</div>
  <div class="clausula"><strong>2. VALOR E PAGAMENTO:</strong> O valor mensal é de ${valorFormatado}, com vencimento todo dia ${aluna.vencimento || 10}. Atrasos superiores a 30 dias podem resultar na suspensão das aulas.</div>
  <div class="clausula"><strong>3. FREQUÊNCIA:</strong> Faltas devem ser comunicadas com antecedência. Frequência abaixo de 70% pode impedir participação em apresentações.</div>
  <div class="clausula"><strong>4. USO DE IMAGEM (LGPD — Lei 13.709/2018):</strong> O(a) responsável ${aluna.autorizaImagem ? 'AUTORIZA' : 'NÃO AUTORIZA'} o uso da imagem do(a) aluno(a) para fins exclusivamente institucionais.</div>
  <div class="clausula"><strong>5. DADOS BIOMÉTRICOS:</strong> A escola utiliza câmeras e reconhecimento facial para controle de presença e segurança. Os dados são armazenados de forma segura e não compartilhados.</div>
  <div class="clausula"><strong>6. CANCELAMENTO:</strong> Comunicar com 30 dias de antecedência por escrito. Mensalidades vencidas não são reembolsadas.</div>
  <div class="clausula"><strong>7. FORO:</strong> Comarca de ${config.cidade || 'Cuiabá - MT'}.</div>
  <div class="assinatura"><p>${config.cidade || 'Cuiabá - MT'}, ${dataHoje}</p><br><br><p>____________________________________</p><p>${config.escola || 'Splendore'}</p><br><br><p>____________________________________</p><p>${aluna.responsavel}</p><p>Responsável por ${aluna.nome}</p></div>
  <div class="rodape">Contrato gerado eletronicamente pelo sistema Splendore em ${dataHoje}.</div>
  </body></html>`;
}

app.post('/contratos/gerar/:alunaId', async (c) => {
  const alunaId = c.req.param('alunaId');
  const d = db(c);
  const [alunaList, cfgList] = await Promise.all([
    d.select().from(schema.alunas).where(eq(schema.alunas.id, alunaId)).limit(1),
    d.select().from(schema.config).limit(1),
  ]);
  if (!alunaList.length) return c.json({ error: 'Aluna não encontrada' }, 404);
  const aluna = alunaList[0];
  const cfg = cfgList[0] || {};
  const html = gerarHTMLContrato(aluna, cfg);
  const tokenAssinatura = genId() + genId() + genId();
  const codigoConfirmacao = Math.random().toString(36).slice(2, 10).toUpperCase();
  const id = genId();
  await d.insert(schema.contratos).values({ id, alunaId, conteudoHtml: html, status: 'pendente', tokenAssinatura, codigoConfirmacao });
  const origem = new URL(c.req.url).origin;
  const linkAssinatura = `${origem}/assinar/${tokenAssinatura}`;
  return c.json({ ok: true, id, tokenAssinatura, linkAssinatura, codigoConfirmacao });
});

app.get('/contratos/ver/:token', async (c) => {
  const token = c.req.param('token');
  const contrato = await db(c).select().from(schema.contratos)
    .where(eq(schema.contratos.tokenAssinatura, token)).limit(1);
  if (!contrato.length) return c.json({ error: 'Contrato não encontrado' }, 404);
  if (contrato[0].status === 'assinado') return c.json({ error: 'Contrato já assinado', assinadoEm: contrato[0].assinadoEm, assinadoPor: contrato[0].assinadoPor }, 409);
  return c.json({ ok: true, contrato: contrato[0] });
});

app.post('/contratos/assinar/:token', async (c) => {
  const token = c.req.param('token');
  const { nomeAssinatura } = await c.req.json();
  if (!nomeAssinatura || nomeAssinatura.trim().length < 5) return c.json({ error: 'Nome completo obrigatório' }, 400);
  const d = db(c);
  const contrato = await d.select().from(schema.contratos).where(eq(schema.contratos.tokenAssinatura, token)).limit(1);
  if (!contrato.length) return c.json({ error: 'Contrato não encontrado' }, 404);
  if (contrato[0].status === 'assinado') return c.json({ error: 'Já assinado' }, 409);
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  await d.update(schema.contratos).set({ status: 'assinado', assinadoPor: nomeAssinatura.trim(), assinadoEm: new Date().toISOString(), ipAssinatura: ip })
    .where(eq(schema.contratos.tokenAssinatura, token));
  return c.json({ ok: true, codigoConfirmacao: contrato[0].codigoConfirmacao });
});

app.get('/contratos/:alunaId', async (c) => {
  const data = await db(c).select().from(schema.contratos)
    .where(eq(schema.contratos.alunaId, c.req.param('alunaId')))
    .orderBy(desc(schema.contratos.createdAt));
  return c.json(data);
});
// BUG-2 FIX: alias /contratos/aluna/:id → /contratos/:id
app.get('/contratos/aluna/:alunaId', async (c) => {
  const data = await db(c).select().from(schema.contratos)
    .where(eq(schema.contratos.alunaId, c.req.param('alunaId')))
    .orderBy(desc(schema.contratos.createdAt));
  return c.json(data);
});

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO 4 — CÂMERAS E RESPONSÁVEIS (no sistema principal)
// ══════════════════════════════════════════════════════════════════════════════

app.get('/responsaveis/:alunaId', async (c) => {
  const data = await db(c).select().from(schema.responsaveis)
    .where(eq(schema.responsaveis.alunaId, c.req.param('alunaId')));
  return c.json(data);
});

app.post('/responsaveis', async (c) => {
  const body = await c.req.json();
  const id = genId();
  await db(c).insert(schema.responsaveis).values({ ...body, id });
  return c.json({ ok: true, id });
});

app.put('/responsaveis/:id', async (c) => {
  await db(c).update(schema.responsaveis).set(await c.req.json())
    .where(eq(schema.responsaveis.id, c.req.param('id')));
  return c.json({ ok: true });
});

app.delete('/responsaveis/:id', async (c) => {
  await db(c).delete(schema.responsaveis).where(eq(schema.responsaveis.id, c.req.param('id')));
  return c.json({ ok: true });
});

app.get('/cameras', async (c) => {
  const data = await db(c).select().from(schema.cameras);
  return c.json(data);
});

app.post('/cameras', async (c) => {
  const body = await c.req.json();
  const id = genId();
  await db(c).insert(schema.cameras).values({ ...body, id })
    .onConflictDoUpdate({ target: schema.cameras.id, set: body });
  return c.json({ ok: true, id });
});

app.put('/cameras/:id', async (c) => {
  await db(c).update(schema.cameras).set(await c.req.json()).where(eq(schema.cameras.id, c.req.param('id')));
  return c.json({ ok: true });
});

app.delete('/cameras/:id', async (c) => {
  await db(c).update(schema.cameras).set({ ativa: false }).where(eq(schema.cameras.id, c.req.param('id')));
  return c.json({ ok: true });
});

// BUG-1 FIX: aliases /alertas para compatibilidade com frontend
async function getAlertasHandler(c: any) {
  const { resolvido } = c.req.query();
  let rows: any[];
  if (resolvido !== undefined) {
    const val = resolvido === 'false' ? false : resolvido === '0' ? false : true;
    rows = await db(c).select().from(schema.sistemAlertas).where(eq(schema.sistemAlertas.resolvido, val)).orderBy(desc(schema.sistemAlertas.createdAt)).limit(50);
  } else {
    rows = await db(c).select().from(schema.sistemAlertas).orderBy(desc(schema.sistemAlertas.createdAt)).limit(50);
  }
  return c.json(rows);
}
async function postAlertaHandler(c: any) {
  const body = await c.req.json();
  const id = genId();
  await db(c).insert(schema.sistemAlertas).values({ ...body, id });
  return c.json({ ok: true, id });
}
async function resolverAlertaHandler(c: any) {
  await db(c).update(schema.sistemAlertas).set({ resolvido: true, resolvidoEm: new Date().toISOString() })
    .where(eq(schema.sistemAlertas.id, c.req.param('id')));
  return c.json({ ok: true });
}
app.get('/sistema/alertas', getAlertasHandler);
app.post('/sistema/alertas', postAlertaHandler);
app.put('/sistema/alertas/:id/resolver', resolverAlertaHandler);
// aliases sem prefixo /sistema (frontend usa /alertas)
app.get('/alertas', getAlertasHandler);
app.post('/alertas', postAlertaHandler);
app.put('/alertas/:id/resolver', resolverAlertaHandler);

app.post('/monitor/presenca-automatica', async (c) => {
  const { alunaId, turmaId } = await c.req.json();
  if (!alunaId) return c.json({ error: 'alunaId obrigatório' }, 400);
  const hoje = new Date().toISOString().split('T')[0];
  const d = db(c);
  const existente = await d.select().from(schema.presencas)
    .where(and(eq(schema.presencas.alunaId, alunaId), eq(schema.presencas.data, hoje))).limit(1);
  if (!existente.length) {
    await d.insert(schema.presencas).values({ id: genId(), alunaId, turmaId: turmaId || null, data: hoje, presente: true }).onConflictDoNothing();
  }
  const aluna = await d.select({ nome: schema.alunas.nome, valor: schema.alunas.valor }).from(schema.alunas).where(eq(schema.alunas.id, alunaId)).limit(1);
  return c.json({ ok: true, presencaMarcada: !existente.length, aluna: aluna[0] || null });
});

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO 5 — AVALIAÇÃO PEDAGÓGICA
// ══════════════════════════════════════════════════════════════════════════════

app.get('/avaliacoes/:alunaId', async (c) => {
  const data = await db(c).select().from(schema.avaliacoes)
    .where(eq(schema.avaliacoes.alunaId, c.req.param('alunaId')))
    .orderBy(desc(schema.avaliacoes.createdAt));
  return c.json(data);
});

app.post('/avaliacoes', async (c) => {
  const body = await c.req.json();
  const notas = [body.postura, body.tecnica, body.ritmo, body.dedicacao, body.evolucao, body.participacao].filter((n: any) => n != null);
  const mediaGeral = notas.length ? notas.reduce((a: number, b: number) => a + b, 0) / notas.length : null;
  const id = genId();
  await db(c).insert(schema.avaliacoes).values({ ...body, id, mediaGeral });
  return c.json({ ok: true, id, mediaGeral });
});

app.put('/avaliacoes/:id', async (c) => {
  const body = await c.req.json();
  const notas = [body.postura, body.tecnica, body.ritmo, body.dedicacao, body.evolucao, body.participacao].filter((n: any) => n != null);
  const mediaGeral = notas.length ? notas.reduce((a: number, b: number) => a + b, 0) / notas.length : null;
  await db(c).update(schema.avaliacoes).set({ ...body, mediaGeral }).where(eq(schema.avaliacoes.id, c.req.param('id')));
  return c.json({ ok: true });
});

app.get('/avaliacoes/turma/:turmaId/:periodo', async (c) => {
  const data = await db(c).select().from(schema.avaliacoes)
    .where(and(eq(schema.avaliacoes.turmaId, c.req.param('turmaId')), eq(schema.avaliacoes.periodo, c.req.param('periodo'))));
  return c.json(data);
});

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO 6 — FINANCEIRO COMPLETO (DESPESAS + DRE)
// ══════════════════════════════════════════════════════════════════════════════

app.get('/despesas', async (c) => {
  const mes = c.req.query('mes');
  let rows: any[];
  if (mes) {
    rows = await db(c).select().from(schema.despesas).where(eq(schema.despesas.mes, mes)).orderBy(desc(schema.despesas.data));
  } else {
    rows = await db(c).select().from(schema.despesas).orderBy(desc(schema.despesas.data));
  }
  return c.json(rows);
});

app.post('/despesas', async (c) => {
  const body = await c.req.json();
  const mes = body.data ? body.data.slice(0, 7) : mesAtual();
  const id = genId();
  await db(c).insert(schema.despesas).values({ ...body, id, mes });
  return c.json({ ok: true, id });
});

app.put('/despesas/:id', async (c) => {
  const body = await c.req.json();
  const mes = body.data ? body.data.slice(0, 7) : undefined;
  await db(c).update(schema.despesas).set({ ...body, ...(mes ? { mes } : {}) }).where(eq(schema.despesas.id, c.req.param('id')));
  return c.json({ ok: true });
});

app.delete('/despesas/:id', async (c) => {
  await db(c).delete(schema.despesas).where(eq(schema.despesas.id, c.req.param('id')));
  return c.json({ ok: true });
});

// BUG-3 FIX: aceitar tanto /financeiro/dre/:mes quanto /financeiro/dre?mes=YYYY-MM
app.get('/financeiro/dre', async (c) => {
  const mes = c.req.query('mes') || mesAtual();
  const d = db(c);
  const [pagsList, despesasList, alunasList] = await Promise.all([
    d.select().from(schema.pagamentos).where(and(eq(schema.pagamentos.mes, mes), eq(schema.pagamentos.status, 'pago'))),
    d.select().from(schema.despesas).where(eq(schema.despesas.mes, mes)),
    d.select().from(schema.alunas).where(eq(schema.alunas.ativo, true)),
  ]);
  const receitaRealizada = pagsList.reduce((s, p) => s + (p.valor || 0), 0);
  const receitaPotencial = alunasList.filter((a: any) => !a.bolsista).reduce((s, a) => s + (a.valor || 0), 0);
  const totalDespesas = despesasList.reduce((s, d) => s + (d.valor || 0), 0);
  const resultado = receitaRealizada - totalDespesas;
  const despesasPorCategoria = despesasList.reduce((acc: any, d) => { acc[d.categoria] = (acc[d.categoria] || 0) + (d.valor || 0); return acc; }, {});
  return c.json({ mes, receitaRealizada, receitaPotencial, totalDespesas, resultado, lucroLiquido: resultado, despesasPorCategoria, pagamentos: pagsList.length, despesas: despesasList.length });
});

app.get('/financeiro/dre/:mes', async (c) => {
  const mes = c.req.param('mes');
  const d = db(c);
  const [pagsList, despesasList, alunasList] = await Promise.all([
    d.select().from(schema.pagamentos).where(and(eq(schema.pagamentos.mes, mes), eq(schema.pagamentos.status, 'pago'))),
    d.select().from(schema.despesas).where(eq(schema.despesas.mes, mes)),
    d.select().from(schema.alunas).where(eq(schema.alunas.ativo, true)),
  ]);
  const receitaRealizada = pagsList.reduce((s, p) => s + (p.valor || 0), 0);
  const receitaPotencial = alunasList.filter((a: any) => !a.bolsista).reduce((s, a) => s + (a.valor || 0), 0);
  const totalDespesas = despesasList.reduce((s, d) => s + (d.valor || 0), 0);
  const resultado = receitaRealizada - totalDespesas;
  const despesasPorCategoria = despesasList.reduce((acc: any, d) => { acc[d.categoria] = (acc[d.categoria] || 0) + (d.valor || 0); return acc; }, {});
  return c.json({
    mes, receita: { realizada: receitaRealizada, potencial: receitaPotencial, inadimplencia: receitaPotencial - receitaRealizada },
    despesas: { total: totalDespesas, porCategoria: despesasPorCategoria, lista: despesasList },
    resultado, margemLucro: receitaRealizada > 0 ? (resultado / receitaRealizada) * 100 : 0,
    taxaAdimplencia: receitaPotencial > 0 ? (receitaRealizada / receitaPotencial) * 100 : 0,
    pagamentos: pagsList.length,
  });
});

// Fluxo de caixa — últimos 12 meses
app.get('/financeiro/fluxo', async (c) => {
  const d = db(c);
  const hoje = new Date();
  const meses: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  }
  const [pagsList, despesasList] = await Promise.all([
    d.select().from(schema.pagamentos).where(eq(schema.pagamentos.status, 'pago')),
    d.select().from(schema.despesas),
  ]);
  const fluxo = meses.map(mes => {
    const receita = pagsList.filter(p => p.mes === mes && p.forma !== 'Pendente').reduce((s, p) => s + (p.valor || 0), 0);
    const despesas = despesasList.filter(dp => dp.mes === mes).reduce((s, dp) => s + (dp.valor || 0), 0);
    return { mes, receita, despesas, resultado: receita - despesas };
  });
  return c.json(fluxo);
});

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO 7 — MÉTRICAS DE RETENÇÃO
// ══════════════════════════════════════════════════════════════════════════════

app.get('/metricas/retencao', async (c) => {
  const d = db(c);
  const hoje = new Date();
  const [alunasList, pagsList] = await Promise.all([
    d.select().from(schema.alunas),
    d.select().from(schema.pagamentos),
  ]);
  const ativas = alunasList.filter(a => a.ativo);
  const inativas = alunasList.filter(a => !a.ativo);
  // Tempo médio de permanência
  const tempos = inativas.map(a => {
    if (!a.cadastro || !a.updatedAt) return 0;
    const ini = new Date(a.cadastro); const fim = new Date(a.updatedAt);
    return Math.max(0, (fim.getTime() - ini.getTime()) / (30 * 24 * 60 * 60 * 1000));
  }).filter(t => t > 0);
  const tempoMedioMeses = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 12;
  const valorMedioMensal = ativas.length ? ativas.reduce((s, a) => s + (a.valor || 0), 0) / ativas.length : 160;
  // Contratos vencendo em 30 dias
  const contratosVencendo = ativas.filter(a => {
    if (!a.contratoAte) return false;
    const vcto = new Date(a.contratoAte);
    const diff = (vcto.getTime() - hoje.getTime()) / 86400000;
    return diff >= 0 && diff <= 30;
  });
  // Churn risk: sem pagamento recente
  const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const mesPrevStr = (() => { const dt = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; })();
  const pagouRecente = new Set(pagsList.filter(p => (p.mes === mesAtualStr || p.mes === mesPrevStr) && p.status === 'pago' && p.forma !== 'Pendente').map(p => p.alunaId));
  const churnRisk = ativas.filter(a => !pagouRecente.has(a.id) && !a.bolsista);
  // Modalidade mais lucrativa
  const receitaPorModalidade: Record<string, number> = {};
  for (const a of ativas) {
    const m = a.modalidade || 'Outros';
    receitaPorModalidade[m] = (receitaPorModalidade[m] || 0) + (a.valor || 0);
  }
  return c.json({
    totalAtivas: ativas.length, totalInativas: inativas.length,
    tempoMedioMeses, ltvMedioEstimado: Math.round(tempoMedioMeses * valorMedioMensal),
    contratosVencendo30Dias: contratosVencendo.length,
    contratosVencendoLista: contratosVencendo.map(a => ({ id: a.id, nome: a.nome, responsavel: a.responsavel, whatsapp: a.whatsapp, contratoAte: a.contratoAte })),
    churnRisk: churnRisk.length,
    churnRiskLista: churnRisk.slice(0, 20).map(a => ({ id: a.id, nome: a.nome, responsavel: a.responsavel, whatsapp: a.whatsapp, valor: a.valor })),
    receitaPorModalidade,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO 8 — ESTOQUE E FANTASIAS
// ══════════════════════════════════════════════════════════════════════════════

app.get('/estoque', async (c) => {
  const { categoria } = c.req.query();
  let rows: any[];
  if (categoria) {
    rows = await db(c).select().from(schema.itensEstoque).where(eq(schema.itensEstoque.categoria, categoria)).orderBy(schema.itensEstoque.nome);
  } else {
    rows = await db(c).select().from(schema.itensEstoque).orderBy(schema.itensEstoque.nome);
  }
  return c.json(rows);
});

app.post('/estoque', async (c) => {
  const body = await c.req.json();
  const id = genId();
  await db(c).insert(schema.itensEstoque).values({ ...body, id, quantidadeDisponivel: body.quantidade || 1 });
  return c.json({ ok: true, id });
});

app.put('/estoque/:id', async (c) => {
  await db(c).update(schema.itensEstoque).set(await c.req.json()).where(eq(schema.itensEstoque.id, c.req.param('id')));
  return c.json({ ok: true });
});

app.delete('/estoque/:id', async (c) => {
  await db(c).delete(schema.itensEstoque).where(eq(schema.itensEstoque.id, c.req.param('id')));
  return c.json({ ok: true });
});

app.get('/emprestimos', async (c) => {
  const { alunaId, devolvido } = c.req.query();
  let rows: any[];
  if (alunaId) {
    rows = await db(c).select().from(schema.emprestimos).where(eq(schema.emprestimos.alunaId, alunaId)).orderBy(desc(schema.emprestimos.dataEmprestimo));
  } else if (devolvido !== undefined) {
    rows = await db(c).select().from(schema.emprestimos).where(eq(schema.emprestimos.devolvido, devolvido === 'true')).orderBy(desc(schema.emprestimos.dataEmprestimo));
  } else {
    rows = await db(c).select().from(schema.emprestimos).orderBy(desc(schema.emprestimos.dataEmprestimo));
  }
  return c.json(rows);
});

app.post('/emprestimos', async (c) => {
  const body = await c.req.json();
  const id = genId();
  const d = db(c);
  // Decrementar disponível
  const item = await d.select().from(schema.itensEstoque).where(eq(schema.itensEstoque.id, body.itemId)).limit(1);
  if (!item.length) return c.json({ error: 'Item não encontrado' }, 404);
  if ((item[0].quantidadeDisponivel || 0) < 1) return c.json({ error: 'Item sem estoque disponível' }, 400);
  await d.update(schema.itensEstoque).set({ quantidadeDisponivel: (item[0].quantidadeDisponivel || 1) - 1 }).where(eq(schema.itensEstoque.id, body.itemId));
  await d.insert(schema.emprestimos).values({ ...body, id, devolvido: false });
  return c.json({ ok: true, id });
});

app.put('/emprestimos/:id/devolver', async (c) => {
  const id = c.req.param('id');
  const d = db(c);
  const emp = await d.select().from(schema.emprestimos).where(eq(schema.emprestimos.id, id)).limit(1);
  if (!emp.length) return c.json({ error: 'Não encontrado' }, 404);
  await d.update(schema.emprestimos).set({ devolvido: true, dataDevolucaoReal: new Date().toISOString().split('T')[0] }).where(eq(schema.emprestimos.id, id));
  // Incrementar disponível
  const item = await d.select().from(schema.itensEstoque).where(eq(schema.itensEstoque.id, emp[0].itemId)).limit(1);
  if (item.length) {
    await d.update(schema.itensEstoque).set({ quantidadeDisponivel: (item[0].quantidadeDisponivel || 0) + 1 }).where(eq(schema.itensEstoque.id, emp[0].itemId));
  }
  return c.json({ ok: true });
});

export default app;

