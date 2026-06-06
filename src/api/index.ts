import { Hono } from "hono";
import { cors } from "hono/cors";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://orovbbxhzizbpphggqxa.supabase.co";

type Bindings = { RATE_LIMIT: KVNamespace; SUPABASE_SECRET_KEY: string };
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
app.post("/login", async c => {
  const { senha } = await c.req.json();
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("config").select("senha").eq("id","main").single();
  if (!data || data.senha !== senha) return c.json({ error: "Senha incorreta" }, 401);
  const token = btoa(`splendore:${Date.now()}:${Math.random()}`);
  return c.json({ token });
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
  const { data } = await sb(c.env.SUPABASE_SECRET_KEY).from("config").select("senha").eq("id","main").single();
  if (!data || data.senha !== senha) return c.json({ error: "Senha incorreta" }, 401);
  const token = btoa("splendore:" + Date.now());
  return c.json({ token });
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
  const { data, error } = await sb(c.env.SUPABASE_SECRET_KEY).from("pagamentos").select("*").eq("aluna_id", alunaId).order("mes");
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
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

export default app;
