import { Hono } from "hono";
import { cors } from "hono/cors";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://orovbbxhzizbpphggqxa.supabase.co";

type Bindings = { RATE_LIMIT: KVNamespace; SUPABASE_SECRET_KEY: string; ANTHROPIC_API_KEY: string; JWT_SECRET: string; FILA_ATIVA?: string; SAAS_ATIVO?: string };
const app = new Hono<{ Bindings: Bindings }>().basePath("api");

const sb = (key: string) => createClient(SUPABASE_URL, key);

app.use(cors({
  origin: (origin) => {
    if (!origin) return origin;
    if (origin === "http://localhost:5173" || origin.includes("splendore")) return origin;
    return null;
  },
  allowMethods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowHeaders: ["Content-Type","Authorization"],
  maxAge: 600,
}));

app.onError((err, c) => c.json({ error: err.message, id: crypto.randomUUID() }, 500));
app.notFound(c => c.json({ error: "Not found" }, 404));

// ── AUTH ──────────────────────────────────────────────────────────────────────
async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function signToken(payload: any, secret: string): Promise<string> {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64url(new TextEncoder().encode(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 86400000 })));
  const data = header + "." + body;
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return data + "." + b64url(sig);
}

async function verifyToken(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const data = parts[0] + "." + parts[1];
    const key = await getKey(secret);
    const expectedSig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
    if (b64url(expectedSig) !== parts[2]) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

async function hashSenha(senha: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  return "pbkdf2$" + b64url(salt) + "$" + b64url(new Uint8Array(bits));
}

async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  if (!armazenado || !armazenado.startsWith("pbkdf2$")) {
    return senha === armazenado;
  }
  const partes = armazenado.split("$");
  const salt = Uint8Array.from(atob(partes[1].replace(/-/g, "+").replace(/_/g, "/")), x => x.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  return b64url(new Uint8Array(bits)) === partes[2];
}

const ROTAS_PUBLICAS = [
  "/api/login", "/api/auth/login",
  "/api/portal/auth", "/api/portal/enviar-comprovante",
  "/api/saas/cadastrar",
];

app.use("*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (c.req.method === "OPTIONS") return next();
  if (ROTAS_PUBLICAS.includes(path)) return next();
  if (path.startsWith("/api/webhook/")) return next();
  const auth = c.req.header("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return c.json({ error: "Nao autenticado" }, 401);
  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: "Token invalido ou expirado" }, 401);
  c.set("escola_id", payload.escola_id || "splendore001");
  await next();
});

app.post("/login", async c => {
  const { senha } = await c.req.json();
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("config").select("senha,escola,nome_admin").eq("id","main").single();
  if (!data || !(await verificarSenha(senha, data.senha))) return c.json({ error: "Senha incorreta" }, 401);
  const token = await signToken({ escola: data.escola, admin: data.nome_admin, role: "admin", escola_id: data.escola_id || "splendore001" }, c.env.JWT_SECRET);
  return c.json({ token, escola: data.escola, admin: data.nome_admin });
});

// ── CONFIG ────────────────────────────────────────────────────────────────────
app.get("/config", async c => {
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("config").select("*").eq("id","main").single();
  return c.json(data || {});
});

app.put("/config", async c => {
  const body = await c.req.json();
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("config").upsert({ id: "main", ...body });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});
app.post("/config", async c => {
  const body = await c.req.json();
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("config").upsert({ id: "main", ...body });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// ── ALUNAS ────────────────────────────────────────────────────────────────────
app.get("/alunas", async c => {
  const escolaId = c.get("escola_id");
  const { data, error } = await sb(c.env.SUPABASE_SECRET_KEY).from("alunas").select("*").eq("escola_id", escolaId).eq("ativo", true).order("nome");
  if (error) return c.json({ error: error.message }, 500);
  const mapped = (data || []).map((a: any) => ({
    id: a.id, nome: a.nome, responsavel: a.responsavel,
    whatsapp: a.whatsapp, email: a.email,
    cpfResponsavel: a.cpf_responsavel, cpfResponsavel2: a.cpf_responsavel2,
    modalidade: a.modalidade, nivel: a.nivel,
    valor: a.valor, valorCheio: a.valor_cheio,
    vencimento: a.vencimento, nascimento: a.nascimento,
    turmaId: a.turma_id, observacao: a.observacao,
    autorizaImagem: a.autoriza_imagem, ativo: a.ativo,
    bolsista: a.bolsista, suspenso: a.suspenso,
    dataCadastro: a.data_cadastro,
  }));
  return c.json(mapped);
});

const mapAluna = (b: any) => ({
  id: b.id || crypto.randomUUID().replace(/-/g,'').slice(0,12), nome: b.nome, responsavel: b.responsavel,
  whatsapp: b.whatsapp, email: b.email,
  cpf_responsavel: b.cpfResponsavel || b.cpf_responsavel,
  cpf_responsavel2: b.cpfResponsavel2 || b.cpf_responsavel2,
  modalidade: b.modalidade, nivel: b.nivel,
  valor: b.valor, valor_cheio: b.valorCheio || b.valor_cheio || b.valor,
  vencimento: b.vencimento, nascimento: b.nascimento,
  turma_id: b.turmaId || b.turma_id,
  observacao: b.observacao,
  autoriza_imagem: b.autorizaImagem ?? b.autoriza_imagem ?? true,
  ativo: b.ativo ?? true, bolsista: b.bolsista ?? false,
  suspenso: b.suspenso ?? false,
  data_cadastro: b.dataCadastro || b.data_cadastro,
});

app.post("/alunas", async c => {
  const body = await c.req.json();
  const escolaId = c.get("escola_id");
  const alunaData = { ...mapAluna(body), escola_id: escolaId };
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("alunas").insert(alunaData);
  if (error) return c.json({ error: error.message }, 500);
  // Gerar plano anual completo — 12 meses com valor e vencimento corretos
  const genId2 = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
  const hoje = new Date();
  const anoAtual2 = hoje.getFullYear();
  const mesAtual2 = hoje.getMonth() + 1;
  const diaVcto = parseInt(body.vencimento || "10");
  const valorMensal = parseFloat(body.valor || "160");
  // Gerar apenas meses de hoje em diante (não cria meses passados)
  const mesesFuturos = Array.from({length: 12}, (_,i) => {
    const m = mesAtual2 + i;
    const ano = anoAtual2 + Math.floor((m - 1) / 12);
    const mes = ((m - 1) % 12) + 1;
    return { ano, mes };
  });
  const mensalidades = mesesFuturos.map(({ ano, mes }) => {
    const mesStr = String(mes).padStart(2, "0");
    const dataVcto = `${ano}-${mesStr}-${String(diaVcto).padStart(2,"0")}`;
    return {
      id: genId2(),
      aluna_id: alunaData.id,
      mes: `${ano}-${mesStr}`,
      data: null,
      valor: valorMensal,
      forma: null,
      observacao: "Plano anual gerado automaticamente",
      escola_id: escolaId,
    };
  });
  await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").insert(mensalidades);
  return c.json({ ok: true });
});

app.put("/alunas/:id", async c => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("alunas").update(mapAluna(body)).eq("id", id).eq("escola_id", c.get("escola_id"));
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.delete("/alunas/:id", async c => {
  const id = c.req.param("id");
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("alunas").update({ ativo: false, suspenso: true }).eq("id", id).eq("escola_id", c.get("escola_id"));
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.post("/alunas/:id/restaurar", async c => {
  const id = c.req.param("id");
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("alunas").update({ ativo: true, suspenso: false }).eq("id", id).eq("escola_id", c.get("escola_id"));
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// ── TURMAS ────────────────────────────────────────────────────────────────────
app.get("/turmas", async c => {
  const { data, error } = await sb(c.env.SUPABASE_SECRET_KEY).from("turmas").select("*").eq("escola_id", c.get("escola_id")).order("nome");
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.post("/turmas", async c => {
  const body = await c.req.json();
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("turmas").insert({ ...body, escola_id: c.get("escola_id") });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.put("/turmas/:id", async c => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("turmas").update(body).eq("id", id).eq("escola_id", c.get("escola_id"));
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// ── PAGAMENTOS ────────────────────────────────────────────────────────────────
app.get("/pagamentos", async c => {
  const { data, error } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").select("*").eq("escola_id", c.get("escola_id")).order("created_at", { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.post("/pagamentos", async c => {
  const body = await c.req.json();
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").insert({ ...body, escola_id: c.get("escola_id") });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.put("/pagamentos/:id/pagar", async c => {
  const id = c.req.param("id");
  const { data, valor, forma } = await c.req.json();
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").update({ data, valor, forma }).eq("id", id).eq("escola_id", c.get("escola_id"));
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});
app.put("/pagamentos/:id/desconto", async c => {
  const id = c.req.param("id");
  const { tipo, percentual, valorFixo, motivo } = await c.req.json();
  // Buscar valor atual
  const { data: pag } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").select("valor").eq("id", id).eq("escola_id", c.get("escola_id")).single();
  if (!pag) return c.json({ error: "Pagamento não encontrado" }, 404);
  let novoValor = pag.valor;
  if (tipo === "desconto_pct") novoValor = pag.valor * (1 - percentual / 100);
  else if (tipo === "desconto_fixo") novoValor = pag.valor - valorFixo;
  else if (tipo === "acrescimo_pct") novoValor = pag.valor * (1 + percentual / 100);
  else if (tipo === "acrescimo_fixo") novoValor = pag.valor + valorFixo;
  else if (tipo === "isencao") novoValor = 0;
  novoValor = Math.max(0, Math.round(novoValor * 100) / 100);
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos")
    .update({ valor: novoValor, observacao: motivo || tipo }).eq("id", id).eq("escola_id", c.get("escola_id"));
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true, novoValor });
});
app.delete("/pagamentos/:id", async c => {
  const id = c.req.param("id");
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").delete().eq("id", id).eq("escola_id", c.get("escola_id"));
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// ── CONTRATOS & PARCELAS ──────────────────────────────────────────────────────
app.get("/contratos/:alunaId", async c => {
  const alunaId = c.req.param("alunaId");
  const { data, error } = await sb(c.env.SUPABASE_SECRET_KEY).from("contratos").select("*, parcelas(*)").eq("aluna_id", alunaId).order("created_at", { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.post("/contratos", async c => {
  const { contrato, parcelas } = await c.req.json();
  const { error: ce } = await sb(c.env.SUPABASE_SECRET_KEY).from("contratos").insert(contrato);
  if (ce) return c.json({ error: ce.message }, 500);
  const { error: pe } = await sb(c.env.SUPABASE_SECRET_KEY).from("parcelas").insert(parcelas.map((x:any)=>({ ...x, escola_id: c.get("escola_id") })));
  if (pe) return c.json({ error: pe.message }, 500);
  return c.json({ ok: true });
});

app.put("/parcelas/:id", async c => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("parcelas").update(body).eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.get("/inadimplentes", async c => {
  const hoje = new Date();
  const mes = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}`;
  const escolaId = c.get("escola_id");
  const { data: alunas } = await sb(c.env.SUPABASE_SECRET_KEY).from("alunas").select("*").eq("escola_id", escolaId).eq("ativo", true).eq("bolsista", false);
  const { data: pags } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").select("aluna_id,mes").eq("escola_id", escolaId);
  const pagSet = new Set((pags||[]).map((p:any) => `${p.aluna_id}:${p.mes}`));
  const inad = (alunas||[]).filter((a:any) => !pagSet.has(`${a.id}:${mes}`));
  return c.json(inad.map((a:any) => ({ ...a, valor: a.valor || 160, modalidade: a.modalidade || "Ballet" })));
});

app.get("/renovacoes", async c => {
  const hoje = new Date();
  const em60 = new Date(hoje); em60.setDate(em60.getDate() + 60);
  const { data: alunas } = await sb(c.env.SUPABASE_SECRET_KEY)
    .from("alunas")
    .select("id,nome,modalidade,whatsapp,responsavel,valor,data_inicio_contrato,data_fim_contrato,contrato_renovacao_automatica")
    .eq("ativo", true)
    .not("data_fim_contrato", "is", null)
    .lte("data_fim_contrato", em60.toISOString().split("T")[0])
    .order("data_fim_contrato");
  const result = (alunas || []).map((a: any) => {
    const fim = new Date(a.data_fim_contrato);
    const dias = Math.round((fim.getTime() - hoje.getTime()) / 86400000);
    let urgencia = "ok";
    if (dias < 0) urgencia = "vencido";
    else if (dias <= 15) urgencia = "critico";
    else if (dias <= 30) urgencia = "atencao";
    else urgencia = "proximo";
    return {
      id: a.id, nome: a.nome, modalidade: a.modalidade || "Ballet",
      whatsapp: a.whatsapp, responsavel: a.responsavel,
      valor: a.valor || 160,
      contratoDe: a.data_inicio_contrato,
      contratoAte: a.data_fim_contrato,
      diasRestantes: dias,
      urgencia,
      renovacaoAutomatica: a.contrato_renovacao_automatica ?? true
    };
  });
  return c.json(result);
});

app.get("/arquivo-morto", async c => {
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("alunas").select("*").eq("ativo", false);
  return c.json(data || []);
});

app.get("/avisos", async c => {
  return c.json([]);
});

app.post("/avisos", async c => {
  return c.json({ ok: true });
});

app.get("/cobrancas", async c => {
  return c.json([]);
});

app.post("/auth/login", async c => {
  const { senha } = await c.req.json();
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("config").select("senha,escola,nome_admin").eq("id","main").single();
  if (!data || !(await verificarSenha(senha, data.senha))) return c.json({ error: "Senha incorreta" }, 401);
  const token = await signToken({ escola: data.escola, admin: data.nome_admin, role: "admin", escola_id: data.escola_id || "splendore001" }, c.env.JWT_SECRET);
  return c.json({ ok: true, token, escola: data.escola, admin: data.nome_admin });
});


app.post("/contratos/gerar", async c => {
  const { alunaId, mesInicio, valorDesconto, valorCheio, diaVencimento, formaPagamento1 } = await c.req.json();
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
  const hoje = new Date();
  const [ano, mes] = mesInicio.split("-").map(Number);
  const contratoId = genId();
  const dataFim = new Date(ano, mes - 1 + 12, 1);
  const dataFimStr = dataFim.getFullYear() + "-" + String(dataFim.getMonth()+1).padStart(2,"0");
  const contrato = { id: contratoId, aluna_id: alunaId, data_inicio: mesInicio, data_fim: dataFimStr, total_parcelas: 12, status: "ativo" };
  const { error: ce } = await sb(c.env.SUPABASE_SECRET_KEY).from("contratos").insert(contrato);
  if (ce) return c.json({ error: ce.message }, 500);
  const parcelas = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(ano, mes - 1 + i, 1);
    const mesStr = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
    const vencStr = mesStr + "-" + String(diaVencimento).padStart(2,"0");
    parcelas.push({ id: genId(), contrato_id: contratoId, aluna_id: alunaId, numero: i+1, mes: mesStr, valor_desconto: valorDesconto, valor_cheio: valorCheio, data_vencimento: vencStr, data_limite_desconto: vencStr, status: i===0?"pago":"em_aberto", data_pagamento: i===0?hoje.toISOString().split("T")[0]:null, valor_pago: i===0?valorDesconto:null, forma_pagamento: i===0?formaPagamento1:null });
  }
  const { error: pe } = await sb(c.env.SUPABASE_SECRET_KEY).from("parcelas").insert(parcelas.map((x:any)=>({ ...x, escola_id: c.get("escola_id") })));
  if (pe) return c.json({ error: pe.message }, 500);
  if (formaPagamento1) await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").insert({ id: genId(), aluna_id: alunaId, mes: mesInicio, data: hoje.toISOString().split("T")[0], valor: valorDesconto, forma: formaPagamento1, observacao: "1a parcela — cadastro", escola_id: c.get("escola_id") });
  return c.json({ ok: true, contratoId, totalParcelas: 12 });
});

app.get("/contratos/aluna/:alunaId", async c => {
  const alunaId = c.req.param("alunaId");
  const { data, error } = await sb(c.env.SUPABASE_SECRET_KEY).from("contratos").select("*, parcelas(*)").eq("aluna_id", alunaId).order("created_at", { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.put("/parcelas/:id/pagar", async c => {
  const id = c.req.param("id");
  const { valorPago, formaPagamento, alunaId, mes } = await c.req.json();
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
  const hoje = new Date().toISOString().split("T")[0];
  await sb(c.env.SUPABASE_SECRET_KEY).from("parcelas").update({ status: "pago", data_pagamento: hoje, valor_pago: valorPago, forma_pagamento: formaPagamento }).eq("id", id);
  await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").insert({ id: genId(), aluna_id: alunaId, mes, data: hoje, valor: valorPago, forma: formaPagamento, observacao: "Parcela paga", escola_id: c.get("escola_id") });
  return c.json({ ok: true });
});


app.get("/mensalidades/:alunaId", async c => {
  const alunaId = c.req.param("alunaId");
  const ano = c.req.query("ano") || new Date().getFullYear().toString();
  const { data, error } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").select("*").eq("aluna_id", alunaId).like("mes", ano + "-%").order("mes");
  if (error) return c.json({ error: error.message }, 500);
  const meses = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  const pagSet = new Map((data||[]).map((p:any) => [p.mes, p]));
  const mensalidades = meses.map(m => {
    const mes = ano + "-" + m;
    const pag = pagSet.get(mes);
    return {
      mes,
      ano: parseInt(ano),
      mesNum: parseInt(m),
      pago: !!pag?.data,
      valor: pag?.valor || 0,
      data: pag?.data || null,
      forma: pag?.forma || null,
      observacao: pag?.observacao || null,
      id: pag?.id || null,
      pagamento: pag ? { id: pag.id, data: pag.data, forma: pag.forma, valor: pag.valor } : null,
      status: pag?.data ? "pago" : "pendente",
    };
  });
  return c.json({ mensalidades });
});

app.post("/mensalidades", async c => {
  const body = await c.req.json();
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").insert({ id: genId(), ...body, escola_id: c.get("escola_id") });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.put("/mensalidades/editar/:id", async c => {
  const id = c.req.param("id");
  const b = await c.req.json();
  const sb_ = sb(c.env.SUPABASE_SECRET_KEY);
  const { data: reg } = await sb_.from("pagamentos").select("id,data").eq("id", id).eq("escola_id", c.get("escola_id")).single();
  if (!reg) return c.json({ error: "Mensalidade nao encontrada" }, 404);
  if (reg.data) return c.json({ error: "Mensalidade ja paga - nao pode ser editada" }, 400);
  const upd: any = {};
  if (b.valor != null) upd.valor = b.valor;
  if (b.observacao !== undefined) upd.observacao = b.observacao;
  if (b.vencimento !== undefined) upd.vencimento = b.vencimento;
  const { error } = await sb_.from("pagamentos").update(upd).eq("id", id).eq("escola_id", c.get("escola_id"));
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.delete("/mensalidades/:id", async c => {
  const id = c.req.param("id");
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").delete().eq("id", id).eq("escola_id", c.get("escola_id"));
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});


app.get("/cameras", async c => {
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("cameras").select("*").order("nome");
  return c.json(data || []);
});
app.post("/cameras", async c => {
  const body = await c.req.json();
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("cameras").insert(body);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});
app.put("/cameras/:id", async c => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await sb(c.env.SUPABASE_SECRET_KEY).from("cameras").update(body).eq("id", id);
  return c.json({ ok: true });
});
app.delete("/cameras/:id", async c => {
  const id = c.req.param("id");
  await sb(c.env.SUPABASE_SECRET_KEY).from("cameras").update({ ativo: false }).eq("id", id);
  return c.json({ ok: true });
});
app.get("/estoque", async c => {
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("estoque").select("*").order("nome");
  return c.json(data || []);
});
app.post("/estoque", async c => {
  const body = await c.req.json();
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("estoque").insert(body);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});
app.put("/estoque/:id", async c => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await sb(c.env.SUPABASE_SECRET_KEY).from("estoque").update(body).eq("id", id);
  return c.json({ ok: true });
});
app.delete("/estoque/:id", async c => {
  const id = c.req.param("id");
  await sb(c.env.SUPABASE_SECRET_KEY).from("estoque").delete().eq("id", id);
  return c.json({ ok: true });
});
app.get("/emprestimos", async c => {
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("emprestimos").select("*").order("created_at", { ascending: false });
  return c.json(data || []);
});
app.post("/emprestimos", async c => {
  const body = await c.req.json();
  await sb(c.env.SUPABASE_SECRET_KEY).from("emprestimos").insert(body);
  return c.json({ ok: true });
});
app.put("/emprestimos/:id/devolver", async c => {
  const id = c.req.param("id");
  const hoje = new Date().toISOString().split("T")[0];
  await sb(c.env.SUPABASE_SECRET_KEY).from("emprestimos").update({ devolvido: true, data_retorno: hoje }).eq("id", id);
  return c.json({ ok: true });
});
app.get("/alertas", async c => {
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("alertas").select("*").order("created_at", { ascending: false }).limit(50);
  return c.json(data || []);
});
app.post("/alertas", async c => {
  const body = await c.req.json();
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
  await sb(c.env.SUPABASE_SECRET_KEY).from("alertas").insert({ id: genId(), ...body });
  return c.json({ ok: true });
});
app.put("/alertas/:id/resolver", async c => {
  const id = c.req.param("id");
  await sb(c.env.SUPABASE_SECRET_KEY).from("alertas").update({ resolvido: true }).eq("id", id);
  return c.json({ ok: true });
});


app.post("/ia/chat", async c => {
  const { messages, contexto } = await c.req.json();
  const apiKey = c.env.ANTHROPIC_API_KEY;
  
  const systemPrompt = `Você é a assistente de gestão do Hathor, uma escola de dança em Cuiabá-MT dirigida por Yasmin Mendonça Marques.

Você tem acesso aos dados reais da escola:
${JSON.stringify(contexto, null, 2)}

Responda sempre em português brasileiro, de forma direta e útil.
Você pode responder perguntas sobre:
- Alunas (quem está devendo, aniversários, modalidades)
- Financeiro (receita, inadimplência, pagamentos)
- Turmas e horários
- Sugestões de cobranças via WhatsApp
- Análise de churn e risco de cancelamento
- Relatórios e resumos mensais

Quando listar alunas inadimplentes, inclua o WhatsApp para facilitar a cobrança.
Quando sugerir mensagens de cobrança, faça de forma simpática e profissional.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages
    })
  });
  
  const data = await resp.json() as any;
  if (!resp.ok) return c.json({ error: data.error?.message || "Erro na IA" }, 500);
  return c.json({ resposta: data.content[0].text });
});





app.post("/mensalidades/gerar/:alunaId", async c => {
  const alunaId = c.req.param("alunaId");
  const { ano } = await c.req.json().catch(() => ({}));
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
  const { data: aluna } = await sb(c.env.SUPABASE_SECRET_KEY).from("alunas").select("*").eq("id", alunaId).single();
  if (!aluna) return c.json({ error: "Aluna não encontrada" }, 404);
  const meses = Array.from({length: 12}, (_, i) => `${ano}-${String(i+1).padStart(2,"0")}`);
  const { data: existentes } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").select("mes").eq("aluna_id", alunaId).eq("escola_id", c.get("escola_id"));
  const existSet = new Set((existentes || []).map((p: any) => p.mes));
  const novos = meses.filter(m => !existSet.has(m)).map(m => ({ id: genId(), aluna_id: alunaId, mes: m, data: null, valor: aluna.valor || 160, forma: null, observacao: "Gerado automaticamente", parcela_id: null, escola_id: c.get("escola_id") }));
  if (novos.length === 0) return c.json({ ok: true, gerados: 0 });
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").insert(novos);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true, gerados: novos.length });
});


app.get("/despesas", async c => {
  const mes = c.req.query("mes") || "";
  let q = sb(c.env.SUPABASE_SECRET_KEY).from("despesas").select("*").order("data", { ascending: false });
  if (mes) q = q.eq("mes", mes);
  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.post("/despesas", async c => {
  const body = await c.req.json();
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("despesas").insert({ id: genId(), ...body });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.put("/despesas/:id", async c => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await sb(c.env.SUPABASE_SECRET_KEY).from("despesas").update(body).eq("id", id);
  return c.json({ ok: true });
});

app.delete("/despesas/:id", async c => {
  const id = c.req.param("id");
  await sb(c.env.SUPABASE_SECRET_KEY).from("despesas").delete().eq("id", id);
  return c.json({ ok: true });
});


app.get("/financeiro/dre", async c => {
  const mes = c.req.query("mes") || new Date().toISOString().slice(0,7);
  const ano = mes.slice(0,4);
  const escolaId = c.get("escola_id");
  const { data: pags } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").select("*").eq("escola_id", escolaId).gte("mes", ano + "-01").lte("mes", ano + "-12");
  const { data: desps } = await sb(c.env.SUPABASE_SECRET_KEY).from("despesas").select("*").eq("escola_id", escolaId).gte("mes", ano + "-01").lte("mes", ano + "-12");
  const meses = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  const dre = meses.map(m => {
    const mesStr = ano + "-" + m;
    const receita = (pags||[]).filter((p:any) => p.mes === mesStr).reduce((s:number, p:any) => s + (p.valor||0), 0);
    const despesa = (desps||[]).filter((d:any) => d.mes === mesStr).reduce((s:number, d:any) => s + (d.valor||0), 0);
    return { mes: mesStr, receita, despesa, lucro: receita - despesa };
  });
  const totalReceita = dre.reduce((s,m) => s + m.receita, 0);
  const totalDespesa = dre.reduce((s,m) => s + m.despesa, 0);
  return c.json({ meses: dre, totalReceita, totalDespesa, totalLucro: totalReceita - totalDespesa });
});

app.get("/financeiro/fluxo", async c => {
  const ano = new Date().getFullYear().toString();
  const escolaId = c.get("escola_id");
  const { data: pags } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").select("mes,valor").eq("escola_id", escolaId).gte("mes", ano + "-01").lte("mes", ano + "-12");
  const { data: desps } = await sb(c.env.SUPABASE_SECRET_KEY).from("despesas").select("mes,valor").eq("escola_id", escolaId).gte("mes", ano + "-01").lte("mes", ano + "-12");
  const meses = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  const fluxo = meses.map(m => {
    const mesStr = ano + "-" + m;
    const receita = (pags||[]).filter((p:any) => p.mes === mesStr).reduce((s:number,p:any) => s+(p.valor||0), 0);
    const despesas = (desps||[]).filter((d:any) => d.mes === mesStr).reduce((s:number,d:any) => s+(d.valor||0), 0);
    return { mes: mesStr, receita, despesas, resultado: receita - despesas };
  });
  return c.json(fluxo);
});


app.get("/analytics", async c => { return c.json({}); });
app.get("/avaliacoes", async c => { return c.json([]); });
app.post("/avaliacoes", async c => { return c.json({ ok: true }); });
app.put("/config/senha", async c => {
  const { senhaAtual, novaSenha } = await c.req.json();
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("config").select("senha").eq("id","main").single();
  if (!data || !(await verificarSenha(senhaAtual, data.senha))) return c.json({ error: "Senha atual incorreta" }, 401);
  await sb(c.env.SUPABASE_SECRET_KEY).from("config").update({ senha: await hashSenha(novaSenha) }).eq("id","main");
  return c.json({ ok: true });
});
app.post("/config/senha", async c => {
  const { senhaAtual, novaSenha } = await c.req.json();
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("config").select("senha").eq("id","main").single();
  if (!data || !(await verificarSenha(senhaAtual, data.senha))) return c.json({ error: "Senha atual incorreta" }, 401);
  await sb(c.env.SUPABASE_SECRET_KEY).from("config").update({ senha: await hashSenha(novaSenha) }).eq("id","main");
  return c.json({ ok: true });
});
app.post("/efi/boleto", async c => { return c.json({ error: "Efi não configurado" }, 400); });
app.post("/efi/pix", async c => { return c.json({ error: "Efi não configurado" }, 400); });
app.post("/importar", async c => { return c.json({ ok: true, importados: 0 }); });
app.post("/mensalidades/editar-lote", async c => {
  const b = await c.req.json();
  const sb_ = sb(c.env.SUPABASE_SECRET_KEY);
  const { data: aluna } = await sb_.from("alunas").select("*").eq("id", b.alunaId).single();
  if (!aluna) return c.json({ error: "Aluna nao encontrada" }, 404);
  const calcValor = (base: number) => {
    if (b.novoValor != null) return b.novoValor;
    if (b.desconto != null) return (b.tipoDesconto || "").includes("percent") ? Math.round(base * (1 - b.desconto / 100) * 100) / 100 : Math.max(0, base - b.desconto);
    return base;
  };
  let atualizados = 0, pulados = 0;
  if (b.mesIds?.length) {
    const { data: regs } = await sb_.from("pagamentos").select("id,valor,data").in("id", b.mesIds).eq("aluna_id", b.alunaId).eq("escola_id", c.get("escola_id"));
    for (const r of (regs || [])) {
      if (r.data) { pulados++; continue; }
      const { error } = await sb_.from("pagamentos").update({ valor: calcValor(r.valor || aluna.valor), observacao: b.motivo || null }).eq("id", r.id).eq("escola_id", c.get("escola_id"));
      if (!error) atualizados++;
    }
  }
  if (b.meses?.length) {
    const genId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const rows = b.meses.map((mes: string) => ({ id: genId(), aluna_id: b.alunaId, mes, valor: calcValor(aluna.valor), data: null, observacao: b.motivo || null, escola_id: c.get("escola_id") }));
    const { error } = await sb_.from("pagamentos").insert(rows);
    if (!error) atualizados += rows.length;
  }
  return c.json({ ok: true, atualizados, pulados });
});
app.get("/metricas/retencao", async c => { return c.json({ retencao: 0, churn: 0, novas: 0 }); });
app.post("/portal/auth", async c => { return c.json({ ok: false, error: "Portal não configurado" }); });
app.post("/portal/enviar-comprovante", async c => { return c.json({ ok: true }); });
app.get("/relatorios/financeiro", async c => { return c.json({}); });
app.get("/responsaveis", async c => { return c.json([]); });
app.get("/sem-rematricula", async c => {
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("alunas").select("*").eq("suspenso", true);
  return c.json(data || []);
});


// ═══════════════════════════════════════════════════════════════
// MOTOR DE RESILIÊNCIA — Idempotência + Retry + Fila de Cobranças
// ═══════════════════════════════════════════════════════════════

// Enfileira cobrança com idempotency key — nunca duplica
app.post("/fila/enfileirar", async c => {
  const { alunaId, parcelaId, valor, tipo = "mensalidade" } = await c.req.json();
  const sb_ = sb(c.env.SUPABASE_SECRET_KEY);

  // Idempotency key = hash determinístico da operação
  const idempotencyKey = btoa(`${alunaId}:${parcelaId || "avulso"}:${valor}:${tipo}:${new Date().toISOString().slice(0,7)}`);

  // Verifica se já existe — se sim, retorna sem duplicar
  const { data: existente } = await sb_
    .from("fila_cobrancas")
    .select("id, status")
    .eq("idempotency_key", idempotencyKey)
    .single();

  if (existente) {
    return c.json({ 
      ok: true, 
      duplicata: true, 
      id: existente.id, 
      status: existente.status,
      mensagem: "Cobrança já enfileirada — operação idempotente"
    });
  }

  // Nova cobrança — insere na fila
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
  const id = genId();

  const { error } = await sb_.from("fila_cobrancas").insert({
    id,
    idempotency_key: idempotencyKey,
    aluna_id: alunaId,
    parcela_id: parcelaId,
    valor,
    tipo,
    status: "pendente",
    tentativas: 0,
    max_tentativas: 3,
    proximo_retry: new Date().toISOString()
  });

  if (error) return c.json({ error: error.message }, 500);

  // Log do evento
  await sb_.from("eventos_cobranca").insert({
    id: genId(),
    fila_id: id,
    aluna_id: alunaId,
    tipo: "enfileirado",
    payload: { valor, tipo, parcelaId }
  });

  return c.json({ ok: true, duplicata: false, id, status: "pendente" });
});

// Processa fila — executa cobranças pendentes com retry
app.post("/fila/processar", async c => {
    if (c.env.FILA_ATIVA !== "true") {
      return c.json({ ok: false, error: "Motor de cobranca automatica desativado. Gateway real (Asaas) nao configurado." }, 403);
    }
  const sb_ = sb(c.env.SUPABASE_SECRET_KEY);
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
  const agora = new Date().toISOString();
  const resultados = { processadas: 0, sucesso: 0, falhas: 0, puladas: 0 };

  // Busca cobranças pendentes prontas para processar
  const { data: pendentes, error: errPendentes } = await sb_
    .from("fila_cobrancas")
    .select("*")
    .in("status", ["pendente", "falhou"])
    .lt("tentativas", 3)
    .order("created_at")
    .limit(50);

  if (errPendentes) return c.json({ error: errPendentes.message }, 500);

  if (!pendentes?.length) {
    return c.json({ ok: true, mensagem: "Fila vazia", ...resultados });
  }

  for (const cobranca of pendentes) {
    resultados.processadas++;

    // Marca como processando — evita processamento duplo
    await sb_.from("fila_cobrancas").update({
      status: "processando",
      updated_at: agora
    }).eq("id", cobranca.id).eq("status", cobranca.status); // Optimistic lock

    try {
      // Simula chamada ao gateway (Asaas/Efi)
      // Em produção: await chamarAsaas(cobranca)
      const gatewayResponse = await simularGateway(cobranca);

      if (gatewayResponse.sucesso) {
        // SUCESSO — baixa a cobrança
        await sb_.from("fila_cobrancas").update({
          status: "sucesso",
          gateway_response: gatewayResponse,
          processado_em: agora,
          updated_at: agora
        }).eq("id", cobranca.id);

        // Se tem parcela, baixa automaticamente
        if (cobranca.parcela_id) {
          await sb_.from("parcelas").update({
            status: "pago",
            data_pagamento: agora.split("T")[0],
            valor_pago: cobranca.valor,
            forma_pagamento: "gateway_automatico"
          }).eq("id", cobranca.parcela_id);

          // Registra pagamento
          await sb_.from("pagamentos").insert({
            id: genId(),
            escola_id: c.get("escola_id"),
            aluna_id: cobranca.aluna_id,
            mes: new Date().toISOString().slice(0,7),
            data: agora.split("T")[0],
            valor: cobranca.valor,
            forma: "gateway_automatico",
            observacao: `Processado automaticamente — fila ${cobranca.id}`
          });
        }

        await sb_.from("eventos_cobranca").insert({
          id: genId(),
          fila_id: cobranca.id,
          aluna_id: cobranca.aluna_id,
          tipo: "sucesso",
          payload: gatewayResponse
        });

        resultados.sucesso++;

      } else {
        throw new Error(gatewayResponse.erro || "Gateway retornou falha");
      }

    } catch (erro: any) {
      const tentativas = cobranca.tentativas + 1;
      const backoffSegundos = Math.pow(2, tentativas) * 60; // 2min, 4min, 8min
      const proximoRetry = new Date(Date.now() + backoffSegundos * 1000).toISOString();
      const statusFinal = tentativas >= 3 ? "falhou" : "pendente";

      await sb_.from("fila_cobrancas").update({
        status: statusFinal,
        tentativas,
        proximo_retry: proximoRetry,
        ultimo_erro: erro.message,
        updated_at: agora
      }).eq("id", cobranca.id);

      await sb_.from("eventos_cobranca").insert({
        id: genId(),
        fila_id: cobranca.id,
        aluna_id: cobranca.aluna_id,
        tipo: tentativas >= 3 ? "falha" : "retry",
        erro: erro.message,
        payload: { tentativas, proximoRetry, backoffSegundos }
      });

      resultados.falhas++;
    }
  }

  return c.json({ ok: true, ...resultados });
});

// Webhook idempotente — nunca processa o mesmo evento 2x
app.post("/webhook/:gateway", async c => {
  const gateway = c.req.param("gateway");
  const payload = await c.req.json();
  const sb_ = sb(c.env.SUPABASE_SECRET_KEY);
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);

  // ID único do webhook vindo do gateway
  const webhookId = payload.id || payload.paymentId || genId();

  // Verifica idempotência — já processamos este webhook?
  const { data: existente } = await sb_
    .from("webhooks_recebidos")
    .select("id, processado")
    .eq("id", webhookId)
    .eq("gateway", gateway)
    .single();

  if (existente?.processado) {
    return c.json({ ok: true, duplicata: true, mensagem: "Webhook já processado" });
  }

  // Registra o webhook
  await sb_.from("webhooks_recebidos").upsert({
    id: webhookId,
    gateway,
    evento: payload.event || payload.type || "unknown",
    payload,
    processado: false
  });

  // Processa o evento
  try {
    if (payload.event === "PAYMENT_RECEIVED" || payload.status === "pago") {
      const valorPago = payload.payment?.value || payload.value || payload.valor;
      const descricao = payload.payment?.description || payload.description || "";

      // Tenta conciliação automática
      const conciliacao = await conciliarPagamento(sb_, {
        webhookId,
        valorPago,
        descricao,
        dataPagamento: payload.payment?.paymentDate || new Date().toISOString().split("T")[0]
      });

      // Marca webhook como processado
      await sb_.from("webhooks_recebidos").update({
        processado: true,
        processado_em: new Date().toISOString()
      }).eq("id", webhookId).eq("gateway", gateway);

      return c.json({ ok: true, conciliacao });
    }

    return c.json({ ok: true, evento: "ignorado" });

  } catch (erro: any) {
    await sb_.from("webhooks_recebidos").update({
      erro: erro.message
    }).eq("id", webhookId).eq("gateway", gateway);

    return c.json({ error: erro.message }, 500);
  }
});

// Conciliação bancária por IA
async function conciliarPagamento(sb_: any, dados: any) {
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);

  // Busca parcelas em aberto próximas ao valor
  const { data: parcelas } = await sb_
    .from("parcelas")
    .select("*, alunas(nome, cpf_responsavel)")
    .eq("status", "em_aberto")
    .gte("valor_desconto", dados.valorPago * 0.9)
    .lte("valor_desconto", dados.valorPago * 1.1)
    .limit(10);

  if (!parcelas?.length) {
    await sb_.from("conciliacao").insert({
      id: genId(),
      webhook_id: dados.webhookId,
      valor_pago: dados.valorPago,
      status: "manual",
      ia_confianca: 0,
      ia_motivo: "Nenhuma parcela com valor próximo encontrada"
    });
    return { status: "manual", motivo: "Sem correspondência" };
  }

  // Se só uma correspondência clara, concilia automaticamente
  if (parcelas.length === 1) {
    const parcela = parcelas[0];
    const divergencia = Math.abs(dados.valorPago - parcela.valor_desconto) / parcela.valor_desconto;

    await sb_.from("parcelas").update({
      status: "pago",
      data_pagamento: dados.dataPagamento,
      valor_pago: dados.valorPago,
      forma_pagamento: "gateway_webhook"
    }).eq("id", parcela.id);

    await sb_.from("pagamentos").insert({
      id: genId(),
      escola_id: c.get("escola_id"),
      aluna_id: parcela.aluna_id,
      mes: parcela.mes,
      data: dados.dataPagamento,
      valor: dados.valorPago,
      forma: "gateway_webhook",
      observacao: `Conciliado automaticamente via webhook`
    });

    await sb_.from("conciliacao").insert({
      id: genId(),
      webhook_id: dados.webhookId,
      aluna_id: parcela.aluna_id,
      parcela_id: parcela.id,
      valor_pago: dados.valorPago,
      valor_esperado: parcela.valor_desconto,
      divergencia,
      status: "conciliado",
      ia_confianca: divergencia < 0.01 ? 0.99 : 0.85,
      ia_motivo: `Correspondência única — divergência ${(divergencia*100).toFixed(1)}%`,
      resolvido_por: "ia"
    });

    return { status: "conciliado", aluna: parcela.alunas?.nome, divergencia };
  }

  // Múltiplas correspondências — cria alerta para revisão
  await sb_.from("conciliacao").insert({
    id: genId(),
    webhook_id: dados.webhookId,
    valor_pago: dados.valorPago,
    status: "divergente",
    ia_confianca: 0.4,
    ia_motivo: `${parcelas.length} correspondências possíveis — revisão necessária`
  });

  return { status: "divergente", candidatos: parcelas.length };
}

// Simula gateway — em produção substitui por Asaas/Efi real
async function simularGateway(cobranca: any) {
  // 85% de sucesso, 15% de falha (simula instabilidade real)
  const sucesso = Math.random() > 0.15;
  await new Promise(r => setTimeout(r, 100)); // Simula latência
  return sucesso 
    ? { sucesso: true, transacaoId: crypto.randomUUID(), valor: cobranca.valor }
    : { sucesso: false, erro: "Gateway temporariamente indisponível" };
}

// Dashboard da fila em tempo real
app.get("/fila/status", async c => {
  const sb_ = sb(c.env.SUPABASE_SECRET_KEY);
  const { data } = await sb_.from("dashboard_fila").select("*");
  const { data: recentes } = await sb_
    .from("fila_cobrancas")
    .select("id, status, valor, tentativas, ultimo_erro, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  return c.json({ resumo: data || [], recentes: recentes || [] });
});

// Enfileira cobranças em massa — até 10.000 de uma vez
app.post("/fila/enfileirar-lote", async c => {
    if (c.env.FILA_ATIVA !== "true") {
      return c.json({ ok: false, error: "Motor de cobranca automatica desativado. Gateway real (Asaas) nao configurado." }, 403);
    }
  const { mes } = await c.req.json();
  const sb_ = sb(c.env.SUPABASE_SECRET_KEY);
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
  const mesAlvo = mes || new Date().toISOString().slice(0,7);
  const agora = new Date().toISOString();

  // Busca todas inadimplentes do mês
  const { data: alunas } = await sb_
    .from("alunas")
    .select("id, valor")
    .eq("ativo", true)
    .eq("bolsista", false);

  const { data: pagos } = await sb_
    .from("pagamentos")
    .select("aluna_id")
    .eq("mes", mesAlvo);

  const pagosSet = new Set((pagos||[]).map((p:any) => p.aluna_id));
  const inadimplentes = (alunas||[]).filter((a:any) => !pagosSet.has(a.id));

  if (!inadimplentes.length) {
    return c.json({ ok: true, enfileiradas: 0, mensagem: "Todas em dia!" });
  }

  // Insere em lote com idempotência
  const lote = inadimplentes.map((a:any) => ({
    id: genId(),
    idempotency_key: btoa(`${a.id}:mensalidade:${a.valor}:${mesAlvo}`),
    aluna_id: a.id,
    valor: a.valor || 160,
    tipo: "mensalidade",
    status: "pendente",
    tentativas: 0,
    max_tentativas: 3,
    proximo_retry: agora
  }));

  // Upsert — se já existe (mesma idempotency_key) ignora
  const { error } = await sb_
    .from("fila_cobrancas")
    .upsert(lote, { onConflict: "idempotency_key", ignoreDuplicates: true });

  if (error) return c.json({ error: error.message }, 500);

  return c.json({ 
    ok: true, 
    enfileiradas: inadimplentes.length,
    mensagem: `${inadimplentes.length} cobranças enfileiradas para ${mesAlvo}`
  });
});


// ═══════════════════════════════════════════════════════════════
// CACHE DE PERFIL DE RISCO — Evita re-análise desnecessária
// ═══════════════════════════════════════════════════════════════

async function getPerfilRiscoCache(sb_: any, alunaId: string) {
  const { data } = await sb_
    .from("cache_perfil_risco")
    .select("*")
    .eq("aluna_id", alunaId)
    .gt("expires_at", new Date().toISOString())
    .single();
  return data;
}

async function salvarPerfilRiscoCache(sb_: any, alunaId: string, perfil: any) {
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  await sb_.from("cache_perfil_risco").upsert({
    aluna_id: alunaId,
    score: perfil.score,
    nivel: perfil.nivel,
    motivos: perfil.motivos,
    ltv_12meses: perfil.ltv12meses || 0,
    taxa_retencao: perfil.taxaRetencao || 0,
    expires_at: expiresAt
  });
}

async function registrarAlerta(sb_: any, tipo: string, severidade: string, mensagem: string, payload?: any) {
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
  await sb_.from("alertas_motor").insert({
    id: genId(), tipo, severidade, mensagem, payload
  });
}

async function registrarMetrica(sb_: any, dados: any) {
  const agora = new Date();
  const data = agora.toISOString().split("T")[0];
  const hora = agora.getHours();
  await sb_.from("metricas_motor").upsert({
    data, hora,
    total_processadas: dados.processadas || 0,
    total_sucesso: dados.sucesso || 0,
    total_falhas: dados.falhas || 0,
    valor_processado: dados.valorProcessado || 0,
  }, { onConflict: "data,hora", ignoreDuplicates: false });
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD DE SAÚDE DO MOTOR — O monitor do monitor
// ═══════════════════════════════════════════════════════════════

app.get("/motor/saude", async c => {
  const sb_ = sb(c.env.SUPABASE_SECRET_KEY);

  // Saúde geral da fila
  const { data: saude } = await sb_.from("saude_motor").select("*").single();

  // Alertas ativos
  const { data: alertas } = await sb_
    .from("alertas_motor")
    .select("*")
    .eq("resolvido", false)
    .order("created_at", { ascending: false })
    .limit(10);

  // Métricas das últimas 24h
  const ontemStr = new Date(Date.now() - 24*3600*1000).toISOString().split("T")[0];
  const { data: metricas } = await sb_
    .from("metricas_motor")
    .select("*")
    .gte("data", ontemStr)
    .order("data")
    .order("hora");

  // Cache hit rate
  const { data: cacheStats } = await sb_
    .from("cache_perfil_risco")
    .select("aluna_id, nivel, expires_at");

  const cacheAtivo = (cacheStats || []).filter(
    (c: any) => new Date(c.expires_at) > new Date()
  ).length;

  // Detecta problemas automaticamente
  const problemas = [];
  if (saude) {
    if ((saude.taxa_sucesso_pct || 0) < 80) {
      problemas.push({ tipo: "TAXA_SUCESSO_BAIXA", severidade: "critical", valor: saude.taxa_sucesso_pct });
      await registrarAlerta(sb_, "TAXA_SUCESSO_BAIXA", "critical",
        `Taxa de sucesso abaixo de 80%: ${saude.taxa_sucesso_pct}%`, saude);
    }
    if ((saude.falhas_ultima_hora || 0) > 10) {
      problemas.push({ tipo: "MUITAS_FALHAS_HORA", severidade: "warning", valor: saude.falhas_ultima_hora });
      await registrarAlerta(sb_, "MUITAS_FALHAS_HORA", "warning",
        `${saude.falhas_ultima_hora} falhas na última hora`, saude);
    }
    if ((saude.fila_processando || 0) > 100) {
      problemas.push({ tipo: "FILA_TRAVADA", severidade: "warning", valor: saude.fila_processando });
    }
  }

  const statusGeral = problemas.some(p => p.severidade === "critical") ? "critical"
    : problemas.some(p => p.severidade === "warning") ? "warning" : "healthy";

  return c.json({
    status: statusGeral,
    timestamp: new Date().toISOString(),
    motor: saude || {},
    alertas_ativos: alertas || [],
    problemas_detectados: problemas,
    cache: { perfis_ativos: cacheAtivo, total_registros: cacheStats?.length || 0 },
    metricas_24h: metricas || []
  });
});

// Análise de risco COM cache — não re-analisa desnecessariamente
app.get("/motor/risco/:alunaId", async c => {
  const alunaId = c.req.param("alunaId");
  const sb_ = sb(c.env.SUPABASE_SECRET_KEY);
  const forceRefresh = c.req.query("refresh") === "true";

  // Tenta cache primeiro
  if (!forceRefresh) {
    const cache = await getPerfilRiscoCache(sb_, alunaId);
    if (cache) {
      return c.json({ ...cache, fonte: "cache", economia: "Claude não consultado" });
    }
  }

  // Cache miss — calcula perfil
  const { data: aluna } = await sb_.from("alunas").select("*").eq("id", alunaId).single();
  if (!aluna) return c.json({ error: "Aluna não encontrada" }, 404);

  const { data: pagamentos } = await sb_
    .from("pagamentos").select("mes,valor,data").eq("aluna_id", alunaId);

  const hoje = new Date();
  let score = 0;
  const motivos: string[] = [];

  // Meses sem pagar
  let mesesSemPagar = 0;
  for (let i = 0; i < 3; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if (!(pagamentos||[]).find((p:any) => p.mes === mes && p.data)) mesesSemPagar++;
  }
  if (mesesSemPagar >= 3) { score += 40; motivos.push("3+ meses sem pagar"); }
  else if (mesesSemPagar >= 2) { score += 25; motivos.push("2 meses sem pagar"); }
  else if (mesesSemPagar >= 1) { score += 10; motivos.push("1 mês sem pagar"); }
  if (aluna.suspenso) { score += 30; motivos.push("Conta suspensa"); }
  if (aluna.bolsista) { score += 5; motivos.push("Bolsista"); }

  // LTV
  const pags = pagamentos || [];
  const ticketMedio = pags.length > 0 ? pags.reduce((s:number,p:any) => s+(p.valor||0),0)/pags.length : aluna.valor||160;
  const taxaRetencao = Math.max(0.5, 1 - (score/100));
  const ltv12meses = ticketMedio * taxaRetencao * 12;

  const nivel = score >= 40 ? "alto" : score >= 20 ? "medio" : "baixo";
  const perfil = { aluna_id: alunaId, score: Math.min(100, score), nivel, motivos, ltv12meses, taxaRetencao };

  // Salva no cache por 24h
  await salvarPerfilRiscoCache(sb_, alunaId, perfil);

  return c.json({ ...perfil, fonte: "calculado", expires_em: "24h" });
});

// Resolve alerta manualmente
app.put("/motor/alertas/:id/resolver", async c => {
  const id = c.req.param("id");
  const sb_ = sb(c.env.SUPABASE_SECRET_KEY);
  await sb_.from("alertas_motor").update({
    resolvido: true,
    resolvido_em: new Date().toISOString()
  }).eq("id", id);
  return c.json({ ok: true });
});

// Limpa cache expirado
app.delete("/motor/cache/limpar", async c => {
  const sb_ = sb(c.env.SUPABASE_SECRET_KEY);
  const { data, error } = await sb_
    .from("cache_perfil_risco")
    .delete()
    .lt("expires_at", new Date().toISOString());
  return c.json({ ok: true, removidos: data?.length || 0 });
});


// ═══════════════════════════════════════════════════════════════

// CAMADA DE OBSERVABILIDADE
const LogService = {
  async logIA(sb_: any, dados: any): Promise<void> {
    const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
    const custo = ((dados.tokens_input || 0) * 0.000003) + ((dados.tokens_output || 0) * 0.000015);
    sb_.from("logs_ia_agente").insert({ id: genId(), tenant_id: "ballet-splendore", ...dados, custo_estimado: custo }).then(() => {}).catch((e: any) => console.error("[LogIA]", e.message));
  },
  async logPerformance(sb_: any, dados: any): Promise<void> {
    const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
    if (dados.tempo_ms < 500 && !dados.erro) return;
    sb_.from("logs_performance").insert({ id: genId(), tenant_id: "ballet-splendore", ...dados }).then(() => {}).catch((e: any) => console.error("[LogPerf]", e.message));
  },
  async logSeguranca(sb_: any, tipo: string, recurso: string, payload: any): Promise<void> {
    const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
    console.error("[SECURITY] " + tipo + " | " + recurso);
    sb_.from("logs_seguranca").insert({ id: genId(), tipo, severidade: "critical", recurso_acessado: recurso, payload, bloqueado: true }).then(() => {}).catch((e: any) => console.error("[LogSec]", e.message));
  }
};

app.use("*", async (c, next) => {
  const inicio = Date.now();
  const endpoint = new URL(c.req.url).pathname;
  const metodo = c.req.method;
  const ip = c.req.header("cf-connecting-ip") || "unknown";
  try {
    await next();
    const tempo_ms = Date.now() - inicio;
    LogService.logPerformance(sb(c.env.SUPABASE_SECRET_KEY), { endpoint, metodo, tempo_ms, status_code: c.res.status, ip });
  } catch (erro: any) {
    const tempo_ms = Date.now() - inicio;
    LogService.logPerformance(sb(c.env.SUPABASE_SECRET_KEY), { endpoint, metodo, tempo_ms, status_code: 500, erro: erro.message, stack_trace: (erro.stack || "").slice(0, 500), ip });
    return c.json({ error: "Erro interno" }, 500);
  }
});

async function analisarSentimento(sb_: any, alunaId: string): Promise<any> {
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
  const { data: cache } = await sb_.from("sentimento_alunas").select("*").eq("aluna_id", alunaId).gt("expires_at", new Date().toISOString()).single();
  if (cache) return { ...cache, fonte: "cache" };
  const { data: aluna } = await sb_.from("alunas").select("*").eq("id", alunaId).single();
  const { data: pagamentos } = await sb_.from("pagamentos").select("mes,valor,data").eq("aluna_id", alunaId).limit(6);
  const mesesSemPagar = (pagamentos || []).filter((p: any) => !p.data).length;
  let score = 0.5; let motivo = "Historico neutro";
  if (aluna?.suspenso) { score = -0.7; motivo = "Conta suspensa"; }
  else if (mesesSemPagar >= 3) { score = -0.6; motivo = "3+ meses sem pagar"; }
  else if (mesesSemPagar >= 2) { score = -0.3; motivo = "2 meses sem pagar"; }
  else if (mesesSemPagar === 0) { score = 0.8; motivo = "Pagamentos em dia"; }
  const classificacao = score >= 0.5 ? "satisfeita" : score >= 0 ? "neutra" : score >= -0.5 ? "insatisfeita" : "muito_insatisfeita";
  const resultado = { aluna_id: alunaId, score, classificacao, bloquear_cobranca: score < -0.5, alerta_humano: score < -0.5, motivo, mensagens_analisadas: (pagamentos || []).length, expires_at: new Date(Date.now() + 7*24*3600*1000).toISOString() };
  await sb_.from("sentimento_alunas").upsert({ id: genId(), ...resultado }, { onConflict: "aluna_id" });
  return { ...resultado, fonte: "calculado" };
}

async function verificarSaudeMotor(sb_: any): Promise<any> {
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
  const { data: saude } = await sb_.from("saude_motor").select("*").single();
  if (!saude) return null;
  const taxa = saude.taxa_sucesso_pct || 100;
  const falhasConsec = saude.total_falhou || 0;
  if (taxa >= 95 && falhasConsec < 5) return null;
  const severidade = taxa < 80 || falhasConsec >= 5 ? "critical" : "warning";
  const alerta = { tipo: taxa < 95 ? "TAXA_SUCESSO_BAIXA" : "FALHAS_CONSECUTIVAS", severidade, taxa_sucesso: taxa, falhas_consecutivas: falhasConsec, payload: { timestamp: new Date().toISOString(), sistema: "Hathor", acao: severidade === "critical" ? "Verificar gateway imediatamente" : "Monitorar" } };
  await sb_.from("alertas_saude").insert({ id: genId(), ...alerta, webhook_enviado: false });
  return alerta;
}

app.get("/observabilidade/sentimento/:alunaId", async c => {
  const sb_ = sb(c.env.SUPABASE_SECRET_KEY);
  if (c.req.query("refresh") === "true") await sb_.from("sentimento_alunas").delete().eq("aluna_id", c.req.param("alunaId"));
  return c.json(await analisarSentimento(sb_, c.req.param("alunaId")));
});

app.get("/observabilidade/logs-ia", async c => {
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("logs_ia_agente").select("id,ferramenta_escolhida,status_final,tempo_resposta_ms,custo_estimado,created_at").order("created_at", { ascending: false }).limit(20);
  return c.json(data || []);
});

app.get("/observabilidade/logs-performance", async c => {
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("logs_performance").select("endpoint,metodo,tempo_ms,status_code,erro,created_at").order("created_at", { ascending: false }).limit(50);
  return c.json(data || []);
});

app.post("/observabilidade/verificar-saude", async c => {
  const alerta = await verificarSaudeMotor(sb(c.env.SUPABASE_SECRET_KEY));
  return c.json({ ok: true, alerta_gerado: !!alerta, alerta: alerta || null, mensagem: alerta ? "Alerta " + (alerta.severidade) + " gerado" : "Sistema saudavel" });
});

app.get("/observabilidade/cobrancas-bloqueadas", async c => {
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("sentimento_alunas").select("*").eq("bloquear_cobranca", true).gt("expires_at", new Date().toISOString()).order("score");
  return c.json(data || []);
});

app.get("/observabilidade/dashboard", async c => {
  const sb_ = sb(c.env.SUPABASE_SECRET_KEY);
  const [saude, logsIA, bloqueadas, alertasSaude] = await Promise.all([
    sb_.from("saude_motor").select("*").single(),
    sb_.from("logs_ia_agente").select("status_final,tempo_resposta_ms,custo_estimado").order("created_at", { ascending: false }).limit(100),
    sb_.from("sentimento_alunas").select("aluna_id,score,classificacao,bloquear_cobranca").eq("bloquear_cobranca", true).gt("expires_at", new Date().toISOString()),
    sb_.from("alertas_saude").select("*").eq("resolvido", false).order("created_at", { ascending: false }).limit(5)
  ]);
  const logs = logsIA.data || [];
  const custoTotal = logs.reduce((s: number, l: any) => s + (l.custo_estimado || 0), 0);
  const tempoMedio = logs.length > 0 ? logs.reduce((s: number, l: any) => s + (l.tempo_resposta_ms || 0), 0) / logs.length : 0;
  return c.json({ timestamp: new Date().toISOString(), motor: saude.data || {}, ia: { total_chamadas: logs.length, custo_estimado_usd: custoTotal.toFixed(4), tempo_medio_ms: Math.round(tempoMedio), sucesso: logs.filter((l: any) => l.status_final === "sucesso").length, falhas: logs.filter((l: any) => l.status_final === "falha").length }, protecao_marca: { cobrancas_bloqueadas: bloqueadas.data?.length || 0, alunas_em_risco: bloqueadas.data || [] }, alertas_ativos: alertasSaude.data || [] });
});

export default app;
app.post("/recalcular/:alunaId", async c => {
  const alunaId = c.req.param("alunaId");
  const { valorTotal, parcelas, planoTipo, anoRef } = await c.req.json();
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
  const ano = anoRef || new Date().getFullYear();
  const valorParcela = Math.round((valorTotal / (parcelas || 12)) * 100) / 100;

  // Buscar mensalidades pendentes do ano
  const { data: mens } = await sb(c.env.SUPABASE_SECRET_KEY)
    .from("pagamentos").select("id,mes,data").eq("aluna_id", alunaId)
    .like("mes", ano + "-%").order("mes");

  let atualizados = 0;
  for (const m of (mens || [])) {
    if (!m.data) {
      // Atualizar valor das pendentes
      await sb(c.env.SUPABASE_SECRET_KEY)
        .from("pagamentos").update({ valor: valorParcela })
        .eq("id", m.id);
      atualizados++;
    }
  }

  // Atualizar valor padrão da aluna
  await sb(c.env.SUPABASE_SECRET_KEY)
    .from("alunas").update({ valor: valorParcela }).eq("id", alunaId);

  return c.json({ ok: true, atualizados, valorAlvo: valorParcela, mensagem: `✓ ${atualizados} mensalidades recalculadas para R$${valorParcela}` });
});

// ══════════════════════════════════════════════════════════
// SAAS — ONBOARDING DE NOVAS ESCOLAS
// ══════════════════════════════════════════════════════════

app.post("/saas/cadastrar", async c => {
    if (c.env.SAAS_ATIVO !== "true") {
      return c.json({ ok: false, error: "Cadastro de novas escolas desativado. Multi-tenancy nao implementado." }, 403);
    }
  const { nome, email, whatsapp, cidade, estado, senha } = await c.req.json();
  if (!nome || !email || !senha) return c.json({ error: "nome, email e senha obrigatórios" }, 400);
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
  const slug = nome.toLowerCase().replace(/[^a-z0-9]/g,"-").replace(/-+/g,"-").slice(0,30);
  const escolaId = genId();
  const sb_ = sb(c.env.SUPABASE_SECRET_KEY);

  // Verificar se email já existe
  const { data: existe } = await sb_.from("escolas").select("id").eq("email", email).single();
  if (existe) return c.json({ error: "Email já cadastrado" }, 409);

  // Criar escola
  await sb_.from("escolas").insert({
    id: escolaId, nome, slug: slug + "-" + escolaId.slice(0,4),
    email, whatsapp, cidade, estado, plano: "trial"
  });

  // Criar config padrão da escola
  await sb_.from("config").insert({
    id: escolaId, escola: nome, senha,
    escola_id: escolaId, nome_admin: "Diretor(a)"
  });

  // Gerar token de acesso
  const token = await signToken({ escola: nome, admin: "Diretor(a)", role: "admin", escola_id: escolaId }, c.env.JWT_SECRET);

  return c.json({
    ok: true,
    escola_id: escolaId,
    slug,
    token,
    mensagem: `Bem-vinda ao Hathor, ${nome}! Trial de 30 dias ativo.`,
    acesso: `https://hathor.rodolfory100.workers.dev?escola=${escolaId}`
  });
});

app.get("/saas/escolas", async c => {
  // Rota admin — listar todas as escolas
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY)
    .from("escolas").select("id,nome,slug,email,plano,trial_expira_em,ativo,criado_em")
    .order("criado_em", { ascending: false });
  return c.json(data || []);
});
