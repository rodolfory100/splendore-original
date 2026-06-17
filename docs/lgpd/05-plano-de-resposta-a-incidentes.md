# Plano de Resposta a Incidentes de Segurança — Hathor

**RASCUNHO — requer revisão jurídica**

Procedimento para incidentes que envolvam dados pessoais, em linha com a LGPD
(art. 48) e orientações da ANPD.

## 1. Classificação do incidente
Classificar por gravidade e risco aos titulares:
- **Baixo:** sem exposição de dados pessoais (ex: indisponibilidade breve).
- **Médio:** exposição limitada, sem dados sensíveis ou de menores.
- **Alto:** exposição de dados de menores, CPF, ou volume relevante; acesso
  não autorizado confirmado; perda de dados sem backup.

## 2. Responsável pela análise
O Encarregado (DPO) é o responsável por conduzir a análise. Na ausência,
[SUPLENTE]. Toda suspeita de incidente é reportada imediatamente ao DPO.

## 3. Contenção
Ações imediatas para limitar o dano: revogar acessos comprometidos, rotacionar
credenciais, isolar o sistema afetado, bloquear IPs, suspender integrações.

## 4. Investigação
Apurar: o que aconteceu, quais dados/titulares afetados, causa raiz, janela
temporal, se houve exfiltração. Preservar logs e evidências.

## 5. Comunicação aos titulares
Quando o incidente puder acarretar risco ou dano relevante, comunicar os
titulares afetados (responsáveis legais) em prazo razoável, em linguagem clara,
informando os dados envolvidos e as medidas adotadas.

## 6. Comunicação à ANPD
Quando aplicável (risco ou dano relevante), comunicar a ANPD no prazo e na forma
definidos pela autoridade, incluindo a descrição do incidente, dados afetados,
medidas de mitigação e riscos.

## 7. Registro pós-incidente
Documentar: data/hora, classificação, dados afetados, ações de contenção,
investigação, comunicações realizadas, responsáveis. Manter o registro
arquivado para fins de prestação de contas (accountability).

## 8. Ações corretivas
Implementar correções para evitar recorrência (patch, ajuste de configuração,
revisão de acessos, treinamento) e atualizar este plano conforme o aprendizado.
