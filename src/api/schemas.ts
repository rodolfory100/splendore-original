// ─────────────────────────────────────────────────────────────────────────────
// schemas.ts — Validação de entrada com Zod (C4)
// Valida os endpoints de escrita expostos. Falha com 400 + mensagem clara.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from "zod";

// ── AUTH ──
export const loginSchema = z.object({
  email: z.string().email("Email inválido").max(255).optional(),
  senha: z.string().min(1, "Senha obrigatória").max(200),
});

// ── CADASTRO SaaS ──
export const cadastroSchema = z.object({
  nome: z.string().min(2, "Nome muito curto").max(150),
  email: z.string().email("Email inválido").max(255),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(200),
  whatsapp: z.string().max(20).optional().nullable(),
  cidade: z.string().max(100).optional().nullable(),
  estado: z.string().max(50).optional().nullable(),
});

// ── ALUNA (campos principais; tolerante a extras via passthrough) ──
export const alunaSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório").max(150),
  valor: z.union([z.number(), z.string()]).optional().nullable(),
  modalidade: z.string().max(100).optional().nullable(),
  whatsapp: z.string().max(20).optional().nullable(),
  responsavel: z.string().max(150).optional().nullable(),
  nascimento: z.string().max(20).optional().nullable(),
}).passthrough();

// ── PAGAMENTO ──
export const pagamentoSchema = z.object({
  aluna_id: z.string().min(1).max(50).optional(),
  alunaId: z.string().min(1).max(50).optional(),
  mes: z.string().max(10).optional().nullable(),
  valor: z.union([z.number(), z.string()]).optional().nullable(),
  forma: z.string().max(50).optional().nullable(),
}).passthrough();

// Helper: valida e retorna {ok, data} ou {ok:false, erro}
export function validar<T>(schema: z.ZodType<T>, body: unknown):
  { ok: true; data: T } | { ok: false; erro: string } {
  const r = schema.safeParse(body);
  if (r.success) return { ok: true, data: r.data };
  const primeiro = r.error.issues[0];
  const campo = primeiro.path.join(".");
  return { ok: false, erro: campo ? `${campo}: ${primeiro.message}` : primeiro.message };
}
