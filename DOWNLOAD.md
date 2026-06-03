# 📥 Splendore Sistema — Pacote Completo para Download

## 🎯 Acesse Agora

O projeto está pronto para download em diferentes formatos:

### ✅ Opção 1: ZIP Completo (Recomendado)
**Arquivo:** `splendore-sistema-completo.zip` (640 KB)

Contém:
- ✅ Código-fonte completo
- ✅ Todas as correções aplicadas (8 bugs + 1 questão)
- ✅ Migrações SQL (0000-0010)
- ✅ Configurações (vite, wrangler, tsconfig)
- ✅ Documentação detalhada

### ✅ Opção 2: Clonar Direto (Se em Servidor Linux)
```bash
# Via Runable CLI (se disponível)
cd /seu/diretorio
cp -r /home/user/splendore-sistema ./

# Ou compactar e transferir
tar -czf splendore-sistema.tar.gz /home/user/splendore-sistema \
  --exclude=node_modules \
  --exclude=.wrangler \
  --exclude=dist
```

### ✅ Opção 3: Git Repository (Se você tem Git access)
```bash
git clone <url-repo>
cd splendore-sistema
git checkout master
```

---

## 🚀 Guia de Setup Rápido (Após Download)

### 1. Descompactar
```bash
unzip splendore-sistema-completo.zip
cd splendore-sistema
```

### 2. Instalar Dependências
```bash
# Com Bun (recomendado)
bun install

# OU com npm
npm install
```

### 3. Variáveis de Ambiente
Copie e configure:
```bash
cp .env.example .env.local
# Edite .env.local com suas chaves
```

### 4. Dev Server
```bash
bun dev
# Acessa em http://localhost:5648
```

### 5. Build Produção
```bash
bun run build
# Gera dist/client e dist/sandbox_website_template
```

---

## 📋 O Que Está Incluído

### ✅ Código Corrigido
```
src/api/index.ts
  • BUG-1: ✅ Route alias /alertas
  • BUG-2: ✅ Route alias /contratos/aluna/:id
  • BUG-3: ✅ Query param ?mes= para DRE
  • BUG-4: ✅ PUT /turmas/:id implementado
  • Q-2:  ✅ Pagamentos limitado a 200

src/web/pages/
  • BUG-5+6: ✅ CobrancasPage.tsx — fetch() → req() com JWT
  • BUG-7:  ✅ MensalidadesPage.tsx — checkbox standardizado
  • BUG-8:  ✅ AlunosPage.tsx — bolsista ocultado
```

### ✅ Banco de Dados
```
10 Migrations SQL aplicadas:
  0000_illegal_thanos.sql      ← Schema base
  0001_unusual_shooting_star.sql
  ...
  0010_fixes.sql               ← Últimas correções
```

### ✅ Documentação
```
AUDIT_FIXES_APPLIED.md    ← Detalhes de cada correção
AUDITORIA.md             ← Relatório completo de auditoria
README.md                ← Instruções gerais
```

---

## 🔐 Credenciais e Configuração

### Variáveis Necessárias em `.env.local`
```env
# API Gateway (Runable)
AI_GATEWAY_BASE_URL=https://api.runable.com/api/gateway/v1
AI_GATEWAY_API_KEY=jAEA6k8bSK61k-rqiL9RL

# Auth
BETTER_AUTH_SECRET=NxxbciPokpntBO7aBbbfDlhXnwVriDRhP32kaUSGLfE=

# Pagamentos (Autumn)
AUTUMN_SECRET_KEY=am_sk_test_9SIvy1I4BQf2GAcORnibE3tNfw9r7WiHpEpBRvp43F

# Runable
RUNABLE_URL=https://api.runable.com/api/cli?key=rk_23xpTOxPgZGRiqRP8woNy
```

### Banco de Dados
- **Local (dev):** D1 SQLite em `.wrangler/state/v3/d1/`
- **Remoto (prod):** Cloudflare D1 (migrations apply via wrangler)

---

## 🧪 Testar Localmente

### Dev Server
```bash
bun dev
# Acessa em http://localhost:5648
# Hot-reload ativado
```

### Build Local
```bash
bun run build
# Gera dist/ pronto para deploy
```

### Run Build Localmente
```bash
npm run preview
# Testa a build de produção localmente
```

---

## 🚢 Deploy em Produção

### Via Runable
1. Login na plataforma Runable
2. Settings → Deploy
3. Selecionar branch
4. Deploy automático

### Via Wrangler (Cloudflare)
```bash
# Requer CLOUDFLARE_API_TOKEN
wrangler deploy

# Ou aplicar migrações
wrangler d1 migrations apply DB --remote
```

---

## 📊 Resumo de Mudanças

| Tipo | Quantidade | Status |
|------|-----------|--------|
| Bugs Corrigidos | 8 | ✅ Todos |
| Questões Resolvidas | 1 (Q-2) | ✅ Sim |
| Módulos Frontend | 85 | ✅ Compilados |
| Módulos Backend | 154 | ✅ Compilados |
| Migrations | 10 | ✅ Aplicadas |
| Rotas Adicionadas | 6+ aliases | ✅ Ativas |

---

## 🆘 Troubleshooting

### Erro: "Cannot find module 'node_modules'"
**Solução:** Execute `bun install` ou `npm install`

### Erro: "Port 5648 em uso"
**Solução:** Mude porta em `vite.config.ts` ou libere a porta:
```bash
lsof -i :5648
kill -9 <PID>
```

### Erro: "Cloudflare API Token não encontrado"
**Solução:** Configure em `.env.local` ou use Runable UI para deploy

### Banco de dados não inicializa
**Solução:** Aplique migrações:
```bash
bun run migrations:apply
```

---

## 📞 Documentação Adicional

- **`AUDIT_FIXES_APPLIED.md`** — Detalhe técnico de cada correção
- **`AUDITORIA.md`** — Relatório completo de auditoria
- **`website.config.json`** — Config Runable
- **`wrangler.json`** — Config Cloudflare Workers/D1

---

## ✅ Verificação Rápida

Após setup, confirme que tudo está funcionando:

```bash
# 1. Dev server rodando?
curl http://localhost:5648 | head -1
# Esperado: <!DOCTYPE html>

# 2. API respondendo?
curl http://localhost:5648/api/ping
# Esperado: {"status":"ok"}

# 3. Banco conectado?
# Acesse dashboard e verifique alunas carregando

# 4. Auth funcionando?
# Faça login com credencial de teste
```

---

**Versão:** 2026-04-15 (Post-Audit Corrections)  
**Build:** Production Ready ✅  
**Última atualização:** Abril 2026
