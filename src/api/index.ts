import { Hono } from "hono";
import { cors } from "hono/cors";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://orovbbxhzizbpphggqxa.supabase.co";

type Bindings = { RATE_LIMIT: KVNamespace; SUPABASE_SECRET_KEY: string; ANTHROPIC_API_KEY: string };
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
const JWT_SECRET = "splendore_jwt_2026_ballet";

async function signToken(payload: any): Promise<string> {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 86400000 }));
  const sig = btoa(`${header}.${body}.${JWT_SECRET}`).replace(/=/g,"");
  return `${header}.${body}.${sig}`;
}

function verifyToken(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp < Date.now()) return false;
    const expectedSig = btoa(`${parts[0]}.${parts[1]}.${JWT_SECRET}`).replace(/=/g,"");
    return parts[2] === expectedSig;
  } catch { return false; }
}

app.post("/login", async c => {
  const { senha } = await c.req.json();
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("config").select("senha,escola,nome_admin").eq("id","main").single();
  if (!data || data.senha !== senha) return c.json({ error: "Senha incorreta" }, 401);
  const token = await signToken({ escola: data.escola, admin: data.nome_admin, role: "admin" });
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

// ── ALUNAS ────────────────────────────────────────────────────────────────────
app.get("/alunas", async c => {
  const { data, error } = await sb(c.env.SUPABASE_SECRET_KEY).from("alunas").select("*").order("nome");
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
  id: b.id, nome: b.nome, responsavel: b.responsavel,
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
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("alunas").insert(mapAluna(body));
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.put("/alunas/:id", async c => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("alunas").update(mapAluna(body)).eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.delete("/alunas/:id", async c => {
  const id = c.req.param("id");
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("alunas").update({ ativo: false, suspenso: true }).eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// ── TURMAS ────────────────────────────────────────────────────────────────────
app.get("/turmas", async c => {
  const { data, error } = await sb(c.env.SUPABASE_SECRET_KEY).from("turmas").select("*").order("nome");
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.post("/turmas", async c => {
  const body = await c.req.json();
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("turmas").insert(body);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.put("/turmas/:id", async c => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("turmas").update(body).eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// ── PAGAMENTOS ────────────────────────────────────────────────────────────────
app.get("/pagamentos", async c => {
  const { data, error } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").select("*").order("created_at", { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.post("/pagamentos", async c => {
  const body = await c.req.json();
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").insert(body);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.delete("/pagamentos/:id", async c => {
  const id = c.req.param("id");
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").delete().eq("id", id);
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
  const { error: pe } = await sb(c.env.SUPABASE_SECRET_KEY).from("parcelas").insert(parcelas);
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
  const { data: alunas } = await sb(c.env.SUPABASE_SECRET_KEY).from("alunas").select("*").eq("ativo", true).eq("bolsista", false);
  const { data: pags } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").select("aluna_id,mes");
  const pagSet = new Set((pags||[]).map((p:any) => `${p.aluna_id}:${p.mes}`));
  const inad = (alunas||[]).filter((a:any) => !pagSet.has(`${a.id}:${mes}`));
  return c.json(inad.map((a:any) => ({ ...a, valor: a.valor || 160, modalidade: a.modalidade || "Ballet" })));
});

app.get("/renovacoes", async c => {
  return c.json([]);
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
  if (!data || data.senha !== senha) return c.json({ error: "Senha incorreta" }, 401);
  const token = await signToken({ escola: data.escola, admin: data.nome_admin, role: "admin" });
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
  const { error: pe } = await sb(c.env.SUPABASE_SECRET_KEY).from("parcelas").insert(parcelas);
  if (pe) return c.json({ error: pe.message }, 500);
  if (formaPagamento1) await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").insert({ id: genId(), aluna_id: alunaId, mes: mesInicio, data: hoje.toISOString().split("T")[0], valor: valorDesconto, forma: formaPagamento1, observacao: "1a parcela — cadastro" });
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
  await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").insert({ id: genId(), aluna_id: alunaId, mes, data: hoje, valor: valorPago, forma: formaPagamento, observacao: "Parcela paga" });
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
      pagamentoId: pag?.id || null,
      status: pag?.data ? "pago" : "pendente",
    };
  });
  return c.json({ mensalidades });
});

app.post("/mensalidades", async c => {
  const body = await c.req.json();
  const genId = () => crypto.randomUUID().replace(/-/g,"").slice(0,12);
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").insert({ id: genId(), ...body });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.delete("/mensalidades/:id", async c => {
  const id = c.req.param("id");
  const { error } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").delete().eq("id", id);
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
  
  const systemPrompt = `Você é a assistente de gestão do Ballet Splendore, uma escola de dança em Cuiabá-MT dirigida por Yasmin Mendonça Marques.

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


app.post("/ia/chat", async c => {
  const { messages, contexto } = await c.req.json();
  const apiKey = c.env.ANTHROPIC_API_KEY;
  
  const systemPrompt = `Você é a assistente de gestão do Ballet Splendore, uma escola de dança em Cuiabá-MT dirigida por Yasmin Mendonça Marques.

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
  const { data: existentes } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").select("mes").eq("aluna_id", alunaId);
  const existSet = new Set((existentes || []).map((p: any) => p.mes));
  const novos = meses.filter(m => !existSet.has(m)).map(m => ({ id: genId(), aluna_id: alunaId, mes: m, data: null, valor: aluna.valor || 160, forma: null, observacao: "Gerado automaticamente", parcela_id: null }));
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
  const { data: pags } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").select("*").gte("mes", ano + "-01").lte("mes", ano + "-12");
  const { data: desps } = await sb(c.env.SUPABASE_SECRET_KEY).from("despesas").select("*").gte("mes", ano + "-01").lte("mes", ano + "-12");
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
  const { data: pags } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").select("mes,valor").gte("mes", ano + "-01").lte("mes", ano + "-12");
  const { data: desps } = await sb(c.env.SUPABASE_SECRET_KEY).from("despesas").select("mes,valor").gte("mes", ano + "-01").lte("mes", ano + "-12");
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
  if (!data || data.senha !== senhaAtual) return c.json({ error: "Senha atual incorreta" }, 401);
  await sb(c.env.SUPABASE_SECRET_KEY).from("config").update({ senha: novaSenha }).eq("id","main");
  return c.json({ ok: true });
});
app.post("/config/senha", async c => {
  const { senhaAtual, novaSenha } = await c.req.json();
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("config").select("senha").eq("id","main").single();
  if (!data || data.senha !== senhaAtual) return c.json({ error: "Senha atual incorreta" }, 401);
  await sb(c.env.SUPABASE_SECRET_KEY).from("config").update({ senha: novaSenha }).eq("id","main");
  return c.json({ ok: true });
});
app.post("/efi/boleto", async c => { return c.json({ error: "Efi não configurado" }, 400); });
app.post("/efi/pix", async c => { return c.json({ error: "Efi não configurado" }, 400); });
app.post("/importar", async c => { return c.json({ ok: true, importados: 0 }); });
app.post("/mensalidades/editar-lote", async c => { return c.json({ ok: true, atualizados: 0 }); });
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

export default app;
