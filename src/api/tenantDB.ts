// ─────────────────────────────────────────────────────────────────────────────
// @deprecated — LEGADO DOCUMENTADO. NÃO USAR EM PRODUÇÃO. NÃO REMOVER AINDA.
//
// DECISÃO DE ARQUITETURA (Caminho C, aprovada 2026-06-25):
//   Este wrapper NÃO é usado por nenhum endpoint (0 importadores — confirmado por
//   grep). O isolamento multi-tenant em produção é feito manualmente via
//   .eq("escola_id") em cada handler do index.ts, e está provado por testes IDOR.
//
//   Estratégia oficial de isolamento do Hathor (em ordem):
//     1. (atual) Isolamento manual por handler — funcional, provado.
//     2. (próximo) Migração gradual para arquitetura de Repositories.
//     3. (definitivo) RLS no Postgres como mecanismo final de isolamento no banco.
//
//   CRITÉRIO DE REMOÇÃO deste arquivo: somente após a migração para Repositories
//   + RLS estar concluída E validada pelo QA Agent e pelo Security Agent.
//   Até lá, permanece como referência de design (injeção automática de escola_id).
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// tenantDB — Wrapper de isolamento multi-tenant (ADR-001, Caminho B)
//
// MITIGAÇÃO TEMPORÁRIA. Objetivo Fase 1: RLS real via anon key + JWT de tenant.
//
// Injeta escola_id automaticamente em SELECT/INSERT/UPDATE/DELETE nas tabelas
// multi-tenant. Tabelas globais passam direto. Falha se não houver tenant.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://orovbbxhzizbpphggqxa.supabase.co";

// Tabelas que carregam dados de tenant — filtro de escola_id é obrigatório.
export const TABELAS_MULTITENANT = new Set([
  "alunas", "pagamentos", "turmas", "despesas",
  "parcelas", "contratos", "conciliacao", "webhooks_recebidos",
]);

// Tabelas globais — NÃO aplicar filtro (login/cadastro/observabilidade dependem disso).
export const TABELAS_GLOBAIS = new Set([
  "escolas", "config",
  "logs_seguranca", "logs_performance", "logs_ia_agente",
]);

export class TenantError extends Error {
  constructor(msg: string) { super(msg); this.name = "TenantError"; }
}

// Builder que injeta .eq("escola_id", X) em toda query de leitura/alteração.
function wrapBuilder(builder: any, escolaId: string, tabela: string, op: string) {
  if (!TABELAS_MULTITENANT.has(tabela)) return builder; // global: passa direto

  if (op === "select" || op === "update" || op === "delete") {
    // Soma o filtro de tenant a quaisquer outros filtros já presentes.
    return builder.eq("escola_id", escolaId);
  }
  return builder;
}

// Cria um cliente Supabase amarrado a um escola_id. Falha se tenant ausente.
export function tenantDB(serviceKey: string, escolaId: string | undefined) {
  if (!escolaId || typeof escolaId !== "string" || escolaId.trim() === "") {
    throw new TenantError("tenantDB: escola_id ausente — operação bloqueada por segurança");
  }
  const client = createClient(SUPABASE_URL, serviceKey);

  return {
    from(tabela: string) {
      const base = client.from(tabela);
      const isMultiTenant = TABELAS_MULTITENANT.has(tabela);

      return {
        // SELECT — injeta escola_id
        select(cols?: string, opts?: any) {
          const b = base.select(cols as any, opts);
          return wrapBuilder(b, escolaId, tabela, "select");
        },
        // INSERT — injeta escola_id no(s) registro(s)
        insert(rows: any) {
          if (isMultiTenant) {
            const withTenant = Array.isArray(rows)
              ? rows.map(r => ({ ...r, escola_id: escolaId }))
              : { ...rows, escola_id: escolaId };
            return base.insert(withTenant);
          }
          return base.insert(rows);
        },
        // UPSERT — idem
        upsert(rows: any, opts?: any) {
          if (isMultiTenant) {
            const withTenant = Array.isArray(rows)
              ? rows.map(r => ({ ...r, escola_id: escolaId }))
              : { ...rows, escola_id: escolaId };
            return base.upsert(withTenant, opts);
          }
          return base.upsert(rows, opts);
        },
        // UPDATE — injeta filtro escola_id
        update(values: any) {
          const b = base.update(values);
          return wrapBuilder(b, escolaId, tabela, "update");
        },
        // DELETE — injeta filtro escola_id
        delete() {
          const b = base.delete();
          return wrapBuilder(b, escolaId, tabela, "delete");
        },
      };
    },
  };
}
