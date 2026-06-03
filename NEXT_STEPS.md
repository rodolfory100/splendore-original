# 🎯 PRÓXIMOS PASSOS — Redesign UI/UX

## ✅ MIGRAÇÃO CONCLUÍDA
- 159 alunas importadas com sucesso
- 1800+ mensalidades geradas
- Dados validados e integrados

---

## 🎨 PRÓXIMO TRABALHO: REDESIGN UI/UX PREMIUM

Agora vamos começar o redesign completo do Splendore para elevar a qualidade visual a nível SaaS premium.

### Escopo (do brief recebido)

**Fase 1: Fundação (SEMANA 1)**
- [ ] Sistema de cores completo (primária, secundária, status)
- [ ] Tipografia elegante (headers + body)
- [ ] Design system (componentes reutilizáveis)
- [ ] Sidebar completamente redesenhada
- [ ] Variáveis CSS/Tailwind documentadas

**Fase 2: Tela Crítica — Renovações (SEMANA 1-2)**
- [ ] Cards de métricas (Vencidos, Crítico, Atenção, Em Dia)
- [ ] Filtros/tabs de status elegantes
- [ ] Tabela refinada (sem duplicação de nome)
- [ ] Badges e status indicators
- [ ] Hover states e micro-interações

**Fase 3: Componentes Reutilizáveis (SEMANA 2)**
- [ ] Botões (primário, secundário, ghost)
- [ ] Cards com sombra e hover
- [ ] Avatares com iniciais
- [ ] Status pills/badges
- [ ] Formulários e inputs

**Fase 4: Outras Telas (SEMANA 2-3)**
- [ ] Dashboard/Overview
- [ ] Tela de Mensalidades
- [ ] Tela de Alunas
- [ ] Modais e formulários

---

## 🎨 DIREÇÃO DE DESIGN

**Tom:** Elegante, confiante, feminino-profissional

**Cores Sugeridas:**
- **Primária:** Rose/blush sofisticado (não rosa choque)
- **Secundária:** Dourado suave ou coral
- **Status:**
  - Vencido: #DC2626 (vermelho profundo)
  - Crítico: #D97706 (âmbar)
  - Atenção: #CA8A04 (ouro)
  - Em dia: #059669 (esmeralda)

**Tipografia:**
- Headers: Playfair Display, DM Serif, ou Fraunces
- Body: DM Sans, Plus Jakarta Sans, ou Outfit

**Referências:**
- Linear (clareza)
- Lemon Squeezy (elegância)
- Vercel Dashboard (minimalismo premium)

---

## 📋 COMO COMEÇAR

1. **Preparar ambiente**
   ```bash
   cd /home/user/splendore-sistema
   bun install @types/react @types/node
   ```

2. **Criar estrutura de design system**
   ```
   src/
   ├── styles/
   │  ├── colors.css (sistema de cores)
   │  ├── typography.css (fontes)
   │  └── tokens.css (variáveis)
   ├── components/
   │  ├── ui/
   │  │  ├── Badge.tsx
   │  │  ├── Button.tsx
   │  │  ├── Card.tsx
   │  │  └── Avatar.tsx
   ```

3. **Componentes prioritários**
   - Sidebar (efeito máximo em UX)
   - Metric Cards (visual impactante)
   - Table com hover states
   - Status badges

---

## 🚀 CRITÉRIO DE SUCESSO

**Antes:** Parece um CRUD com CSS básico  
**Depois:** Parece um produto SaaS de R$500/mês

---

*Status:* 🟢 Pronto para iniciar  
*Estimativa:* 2-3 semanas para redesign completo  
*Próximo checkpoint:* Sidebar + Renovações page
