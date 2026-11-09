---
name: "dashboard-rh-crew"
description: "Aplica a estética Crew (rail azul, shell com sidebar, KPIs, cards hero com canvas/SVG, tema escuro com preto como cor principal) adaptada à gestão de barbearia: agenda, profissionais, serviços, faturamento e agendamento público."
---

# Gestão de Barbearia — estética "Crew" (dark/black)

Adapta o visual Crew para um SaaS de barbearia, mantendo **todas as funcionalidades existentes** (agendamento público, histórico com verificação/cancelamento, login admin e gestão). Preto é a cor principal das superfícies; acentos azul/amarelo/navy preservam o caráter Crew.

Use nomes de produto/empresa reais do projeto (variáveis `BARBERSHOP_NAME`, logo etc.). Não copie nomes fictícios do skill original.

## Domínios funcionais (requisitos da barbearia)
1. **Agendamento público**: escolher serviço → profissional → data/horário → dados do cliente → confirmar (`POST /api/appointments`), com resumo e feedback.
2. **Histórico do cliente**: informar telefone, enviar/verificar código WhatsApp, listar agendamentos, cancelar quando permitido (`/history/*`).
3. **Admin (autenticado)**: login (`/admin/login`), visão geral/KPIs, agenda/encaixes/bloqueios, profissionais, serviços, relatórios/faturamento, configurações/WhatsApp.
4. **Dados de negócio**: barbeiros ativos, catálogo de serviços (preço/duração), agenda por data, status (confirmed/in_progress/completed/cancelled/no_show/pending/blocked), receita.

## Stack recomendada (performance)
- **Preferir stack existente** quando já funcional: Express + Handlebars + Bootstrap 5 + CSS próprio + JS vanilla por página. Evita bundles pesados e preserva rotas/sessões.
- **Trocar framework** só se necessário; neste projeto, o ganho vem de design system + limpeza, não de reescrita.
- Carregar libs pesadas (Chart.js, jQuery/Select2, socket.io) **apenas nas páginas que precisam**.
- Respeitar `prefers-reduced-motion`; usar animações curtas (150–220ms).

## Design tokens (dark / preto principal)
| Token | Hex | Uso |
|---|---|---|
| `--rail1/--rail2` | `#1430C8 → #2943F0` | rail/acentos de navegação |
| `--primary` | `#2943F0` | CTAs, item ativo, foco, links de ação |
| `--primary-soft` | `rgba(41,67,240,.18)` | fundo de item ativo/chips |
| `--sun` | `#F7D85A` | destaque premium (KPI/valor), marcadores |
| `--navy1/--navy2` | `#0B1452 → #16216E` | cards hero com glow radial |
| `--bg` | `#0B0D12` | fundo principal (preto) |
| `--sidebar` | `#10131A` | navegação lateral/top shell |
| `--card` | `#151926` | superfícies/card (borda `#242B3D`) |
| `--ink` | `#F5F7FF` | texto principal |
| `--muted` | `#9AA3B2` | texto secundário |
| `--teal` | `#19A285` | concluído/positivo |
| `--orange` | `#EE7B48` | em atendimento/atenção |
| `--gold` | `#D69D13` | pendente/receita destaque |
| `--red` | `#E5484D` | cancelado/erro |

Raios: cards 16–20px, botões/inputs 12px, badges pill. Sombras: `0 8px 24px rgba(0,0,0,.35)`. Gaps 12–16px.

## Layout — Admin (Crew adaptado)
1. **Shell**: navbar superior escura + navegação lateral/offcanvas (mobile) com item ativo em `--primary-soft` e texto/ícone `--primary`.
2. **Breadcrumb/título**: "Barbearia > Área > Página" (11px muted) + título forte (24/800).
3. **KPIs**: cards com ícone, valor tabular grande, legenda e variação/estado (ex.: agendamentos hoje, receita do mês, em andamento, profissionais ativos). Um card pode usar destaque `--sun` com texto escuro para contraste.
4. **Card hero (opcional)**: fundo navy com glow radial para visão de agenda/receita; pode incluir SVG/canvas leve (respeitar DPR e `prefers-reduced-motion`).
5. **Listas/tabelas**: linhas limpas, badges de status por cor, ações agrupadas; responsivo (scroll horizontal controlado/tabela→cards quando fizer sentido).
6. **Rodapé contextual**: estado do WhatsApp/configuração e suporte.

## Layout — Público (agendamento)
- Fluxo em etapas claro (Serviço → Profissional → Data/Horário → Dados/Resumo), com barra inferior de navegação e feedback de loading/erro.
- Cards de serviço/profissional selecionáveis com borda/foco `--primary`.
- Calendário e horários como chips/tabela legível em mobile.
- Histórico: verificação por código com estados (aguardar, reenviar, expirar) e lista de agendamentos com ação de cancelamento quando aplicável.

## Mapeamento de status
`confirmed` azul, `in_progress` laranja, `completed` teal, `pending` dourado, `cancelled` vermelho, `no_show` cinza, `blocked/fit-in` roxo/cinza conforme contexto.

## Acessibilidade e qualidade
- Contraste adequado em texto/controles; `:focus-visible` visível.
- Labels reais, `aria-label` em ícones isolados, botões com estados `disabled/loading`.
- Sem erros JS no console nas telas principais; `node --check` nos scripts; boot + rotas-chave testadas antes de entregar.

## Checklist de validação
- [ ] `/` carrega e permite navegar no fluxo de agendamento.
- [ ] `/history` envia/verifica código e lista/cancela (com limitações de WhatsApp no demo documentadas).
- [ ] `/admin/login` autentica (`admin`/`admin123` no seed demo) e áreas admin carregam.
- [ ] KPIs/tabelas/ações admin funcionam; tema escuro consistente.
- [ ] `npm test` / `node --check` / boot local sem erros críticos.
