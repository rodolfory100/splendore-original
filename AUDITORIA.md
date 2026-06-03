# Auditoria Técnica Completa — Splendore Sistema
## Data: 2026-03-30

---

## BUGS CRÍTICOS

### BUG-01 — Bolsistas aparecem como inadimplentes [CRÍTICO]
**Arquivo:** `src/api/index.ts` linha ~190
**Problema:** `/inadimplentes` não filtra `bolsista=true`. Uma aluna bolsista que tem histórico
de pagamento nos últimos 3 meses (antes de virar bolsista) vai aparecer como inadimplente.
**Correção:** Adicionar `if (aluna.bolsista) return false;` no filter.

### BUG-02 — quantidadeMeses sempre = 1 [CRÍTICO]
**Arquivo:** `src/api/index.ts` linha ~198
**Problema:** O endpoint `/inadimplentes` sempre retorna `quantidadeMeses: 1` e `mesesDevendo: [mesAtual]`.
Não calcula meses acumulados. Cobranças mostram "1 mês" mesmo para aluna com 6 meses em atraso.
**Correção:** Calcular meses acumulados verificando todos os meses anteriores sem pagamento real.

### BUG-03 — CORS aberto [SEGURANÇA]
**Arquivo:** `src/api/index.ts` linha 10
**Problema:** `origin: "*"` — qualquer domínio pode chamar a API.
**Correção:** Restringir para o domínio do sistema.

### BUG-04 — Senha em plain text [SEGURANÇA]
**Arquivo:** `src/api/index.ts` linhas 24-25, 87-88
**Problema:** Senha armazenada e comparada em texto puro. Sem hash.
**Melhoria futura:** Usar bcrypt/SHA-256. Por ora documentado.

### BUG-05 — Token de autenticação sem validação real [SEGURANÇA]
**Arquivo:** `src/api/index.ts` linha 27
**Problema:** Token gerado com `btoa(splendore:timestamp:random)` mas NUNCA é validado em
nenhum endpoint. Qualquer pessoa com a URL pode chamar `/api/alunas`, `/api/pagamentos` etc.
**Correção implementada:** Middleware de autenticação nos endpoints administrativos.

### BUG-06 — escapeHtml importado mas nunca usado [MICRO]
**Arquivo:** `src/web/pages/AlunosPage.tsx` linha 3
**Correção:** Remover import.

### BUG-07 — useCallback importado mas nunca usado [MICRO]
**Arquivo:** `src/web/pages/AlunosPage.tsx` linha 1
**Correção:** Remover.

### BUG-08 — genId duplicado em 3 arquivos [CÓDIGO]
**Arquivos:** AlunosPage, CobrancasPage, (outros)
**Problema:** Mesma função `genId` copy-pastada. Deveria estar em `lib/api.ts`.

### BUG-09 — R${ sem espaço no template da IA [MICRO]
**Arquivo:** `src/api/index.ts` linha ~1783
**Problema:** Template literal `R${a.valor}` renderiza "R160" em vez de "R$ 160".
**Correção:** `R$ ${a.valor}`.

### BUG-10 — callIA no frontend (lib/api.ts) expõe modelo mas nunca é chamada
**Arquivo:** `src/web/lib/api.ts`
**Problema:** Função `callIA` legada que chama OpenRouter direto no frontend não é mais
usada (substituída por `chatIA`). Código morto.

### BUG-11 — Importação não popula campo `bolsista` [CRÍTICO]
**Arquivo:** `src/api/index.ts` rota `/importar`
**Problema:** Ao importar backup, o campo `bolsista` não é preservado.

### BUG-12 — ativo: a.ativo !== false ? true : false — expressão redundante [MICRO]
**Correção:** `ativo: a.ativo !== false` (boolean direto).
