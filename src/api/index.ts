import { Hono } from "hono";
import { cors } from "hono/cors";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://orovbbxhzizbpphggqxa.supabase.co";
const SUPABASE_KEY = (globalThis as any).SUPABASE_SECRET_KEY || "";

type Bindings = { RATE_LIMIT: KVNamespace };
const app = new Hono<{ Bindings: Bindings }>().basePath("api");

const sb = () => createClient(SUPABASE_URL, SUPABASE_KEY);

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
  const { data } = await sb().from("config").select("senha").eq("id","main").single();
  if (!data || data.senha !== senha) return c.json({ error: "Senha incorreta" }, 401);
  const token = btoa(`splendore:${Date.now()}:${Math.random()}`);
  return c.json({ token });
});

// ── CONFIG ────────────────────────────────────────────────────────────────────
app.get("/config", async c => {
  const { data } = await sb().from("config").select("*").eq("id","main").single();
  return c.json(data || {});
});

app.put("/config", async c => {
  const body = await c.req.json();
  const { error } = await sb().from("config").upsert({ id: "main", ...body });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// ── ALUNAS ────────────────────────────────────────────────────────────────────
app.get("/alunas", async c => {
  const { data, error } = await sb().from("alunas").select("*").order("nome");
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.post("/alunas", async c => {
  const body = await c.req.json();
  const { error } = await sb().from("alunas").insert(body);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.put("/alunas/:id", async c => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { error } = await sb().from("alunas").update(body).eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.delete("/alunas/:id", async c => {
  const id = c.req.param("id");
  const { error } = await sb().from("alunas").update({ ativo: false, suspenso: true }).eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// ── TURMAS ────────────────────────────────────────────────────────────────────
app.get("/turmas", async c => {
  const { data, error } = await sb().from("turmas").select("*").order("nome");
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.post("/turmas", async c => {
  const body = await c.req.json();
  const { error } = await sb().from("turmas").insert(body);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.put("/turmas/:id", async c => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { error } = await sb().from("turmas").update(body).eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// ── PAGAMENTOS ────────────────────────────────────────────────────────────────
app.get("/pagamentos", async c => {
  const { data, error } = await sb().from("pagamentos").select("*").order("created_at", { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.post("/pagamentos", async c => {
  const body = await c.req.json();
  const { error } = await sb().from("pagamentos").insert(body);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.delete("/pagamentos/:id", async c => {
  const id = c.req.param("id");
  const { error } = await sb().from("pagamentos").delete().eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// ── CONTRATOS & PARCELAS ──────────────────────────────────────────────────────
app.get("/contratos/:alunaId", async c => {
  const alunaId = c.req.param("alunaId");
  const { data, error } = await sb().from("contratos").select("*, parcelas(*)").eq("aluna_id", alunaId).order("created_at", { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.post("/contratos", async c => {
  const { contrato, parcelas } = await c.req.json();
  const { error: ce } = await sb().from("contratos").insert(contrato);
  if (ce) return c.json({ error: ce.message }, 500);
  const { error: pe } = await sb().from("parcelas").insert(parcelas);
  if (pe) return c.json({ error: pe.message }, 500);
  return c.json({ ok: true });
});

app.put("/parcelas/:id", async c => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { error } = await sb().from("parcelas").update(body).eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

app.get("/inadimplentes", async c => {
  const hoje = new Date();
  const mes = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}`;
  const { data: alunas } = await sb().from("alunas").select("*").eq("ativo", true).eq("bolsista", false);
  const { data: pags } = await sb().from("pagamentos").select("aluna_id,mes");
  const pagSet = new Set((pags||[]).map((p:any) => `${p.aluna_id}:${p.mes}`));
  const inad = (alunas||[]).filter((a:any) => !pagSet.has(`${a.id}:${mes}`));
  return c.json(inad.map((a:any) => ({ ...a, valor: a.valor || 160, modalidade: a.modalidade || "Ballet" })));
});

export default app;
