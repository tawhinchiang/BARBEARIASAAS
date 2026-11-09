---
name: "dashboard-rh-crew"
description: "Cria dashboard de RH (People, Time off, Hiring, Payroll) no estilo do reel 'Crew': rail azul, interface escura com preto como cor principal, KPIs, constelação 3D em canvas, calendário de férias, kanban de candidatos e folha de pagamento."
---

# Dashboard de RH — estilo "Crew" (tema escuro, preto principal)

Recria um painel web de RH com 4 áreas (People, Time off, Hiring, Payroll), analisado quadro a quadro de um reel vertical (720×1280, 8 s). O dashboard aparece em 16:10 (≈1440×900) com cantos de 24px. **Variação desta versão:** preto como cor principal (superfícies escuras), mantendo os acentos azul/amarelo/navy do estilo Crew.

Use nomes próprios de produto e empresa: não copie "Crew", "Build Index" nem "Marlowe Labs". Empresa padrão: "Northwind Co.". Pessoas e dados são fictícios.

## Stack
- React + Tailwind + lucide-react (+ framer-motion para transições). HTML único com CDN se o usuário não pedir React.
- Gráficos: SVG à mão (sparklines, donut, aros, waterfall); **Canvas 2D** para a constelação e o túnel do pipeline.
- Fonte: "Plus Jakarta Sans" ou "Inter" (500/600/700/800). Números grandes em 800 com `tabular-nums`.

## Design tokens (tema escuro / preto principal)
| Token | Hex | Uso |
|---|---|---|
| --rail | #1430C8 → #2943F0 (gradiente vertical) | barra de ícones à esquerda |
| --primary | #2943F0 | botões principais, item ativo, barras |
| --primary-soft | rgba(41,67,240,.18) | fundo do item ativo da sidebar, chips |
| --sun | #F7D85A (card) / #FDE68A (claro) | card destaque, botões secundários, badges "pending" (texto sobre amarelo: #14182B) |
| --navy | #0B1452 → #16216E | cards "hero" escuros (constelação, funil) com glow radial |
| --ink | #F5F7FF | títulos/texto principal |
| --muted | #9AA3B2 | legendas/texto secundário |
| --bg | #0B0D12 | fundo do conteúdo (preto principal) |
| --sidebar | #10131A | sidebar |
| --card | #151926 (borda 1px #242B3D) | cards |
| --teal | #19A285 | sucesso, "Scheduled", Operations, Taxes |
| --orange | #EE7B48 | Sick, Go-to-market, imposto |
| --gold | #D69D13 | Benefits |
| --red | #E5484D | probation, alertas |
| --deep | #0A1026 | barra "Net pay", botão "Approve all", card "Filings" |

Raios: cards 20px, botões 12px, pills full. Sombras: `0 8px 24px rgba(0,0,0,.35)`. Bordas sutis `#242B3D` (hover `#2E3750`). Gaps de 16px entre cards; padding interno de 20px.

## Layout comum (todas as telas)
1. **Rail (72px)**, azul em gradiente: no topo, o logo (quadrado amarelo 40px, rounded-xl, com um rosto sorridente); abaixo, ícones de área (Users, Palmtree, Briefcase, Wallet). O ativo tem fundo `white/15` rounded-xl e um marcador amarelo 3×20px colado na borda esquerda. No rodapé: Settings (sliders), Help e o avatar com bolinha verde de online.
2. **Sidebar (220px)**, fundo --sidebar:
   - Seletor de workspace: avatar quadrado escuro "NC" + nome + "Business plan" + chevron ↕.
   - Label "AREA" (10px, caps, tracking-wide, --muted); título da área (22px/800, --ink); legenda (ex.: "120 teammates · 4 departments").
   - Navegação com ícone, rótulo e contador à direita. O item ativo tem fundo --primary-soft e texto/ícone --primary.
   - "SAVED VIEWS": bolinha colorida 6px + nome + contagem.
   - Uma seção contextual (veja cada tela).
   - Card no rodapé (veja cada tela).
3. **Topbar** (dentro do conteúdo):
   - Breadcrumb "Empresa > Área > Página" (11px, --muted), com o título da página abaixo (24px/800, --ink).
   - À direita: busca "Search people, roles…" com atalho ⌘K (fundo --card, borda #242B3D), pill de data "● Mon, Oct 26 · Week 44" (bolinha verde), sino com ponto amarelo e o botão primário azul com ícone (muda por tela).

## Tela 1 — People overview (CTA "Add person")
- **4 KPIs** em linha. Cada um tem ícone, rótulo, badge de variação (↗ verde / ↘ vermelho), valor grande, legenda e uma sparkline à direita:
  - Headcount **120**, +5.3%, "+6 this quarter". O card é **amarelo** (gradiente #F7D85A→#FBE9A0), com texto/badge escuro (#14182B).
  - New hires · 30 days **7**, sparkline em zigue-zague.
  - Average tenure **2.8 yrs**, +12%.
  - Attrition · 12 months **6.8%**, ↘1.2 pts, com a linha descendente em teal.
- **Card hero "People constellation"** (2/3 da largura, fundo --navy com glow radial):
  - Label "● LIVE ORG GRAPH" em amarelo; o toggle "Constellation | Org chart" fica no canto, com o ativo amarelo (texto escuro).
  - Chips de filtro: All 120 (ativo claro #F5F7FF com texto #0B0D12), Engineering 46, Product 18, Go-to-market 34, Operations 21, cada um com bolinha da cor do grupo.
  - Canvas: nó central (CEO, com halo dourado) ligado por linhas finas a 4 clusters de partículas e avatares. Cores: Product & Design = branco/lavanda, Engineering = azul claro, Go-to-market = laranja/âmbar, Operations = teal. Os rótulos dos clusters são pills escuras translúcidas.
  - Rodapé: ticker "LIVE · Ana Souza accepted her offer · Product Eng" e as métricas AVG SPAN 5.6 | LAYERS 4 | OUT TODAY 6.
- **Coluna direita:**
  - "Engagement pulse" **+42** (eNPS ▲6): heatmap de 4 linhas (Engineering, Product, GTM, Operations) × 10 semanas, com quadrados 14px em tons de azul e legenda Low→High.
  - "This week" ("Joiners, milestones & reviews"): lista de 6 pessoas, cada uma com avatar, nome, subtítulo e uma tag à direita ("Starts Mon" azul; "Wed"/"Thu"/"Sat" amarelo com texto escuro; "Fri" cinza).
- **Sidebar:** "ONLINE NOW · 84", com 3 pessoas (avatar, status e atividade). O card do rodapé é amarelo: "Q4 reviews · Due Nov 20", "77 of 120 submitted", barra de progresso preta, avatares empilhados e o botão "Nudge" (texto escuro).

### Constelação (canvas)
- Projeção 3D, como no código do reel:
```ts
const project = (x:number,y:number,z:number) => {
  const x1 = x*cry + z*sry, z1 = -x*sry + z*cry;
  const y2 = y*crx - z1*srx, z2 = y*srx + z1*crx;
  const k = F/(z2 + CAM);
  return { x: cx + x1*k, y: cy + y2*k, k: k/(F/CAM), z: z2 };
};
ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
```
- Partículas distribuídas em esferas por cluster. A cena gira lentamente em Y (≈0.0015 rad/frame). Arrastar orbita (rotX/rotY), e passar o mouse num nó mostra um tooltip com a pessoa (tooltip em --card, borda #242B3D, texto --ink). Ordene o desenho por `z`; o tamanho e o alpha escalam com `k`. Use glow com `shadowBlur` ou um gradiente radial. Respeite `devicePixelRatio`.
- Os filtros de chip atenuam os clusters não selecionados (alpha 0.15).

## Tela 2 — Time off (CTA "Request leave")
- **Card de calendário** (largura total, fundo --card):
  - Navegação "‹ October 2026 ›" e os resumos **6** out today · **11** this week · **4** pending.
  - Legenda com cores: Vacation (azul), Sick (laranja), Personal (teal), Parental (lilás), Pending (tracejado).
  - "TEAM CAPACITY" ("People out per day · peak Thu 29"): uma área/faixa ondulada azul em 3D (fita com face clara translúcida) acima dos dias, com um marcador escuro "6 out" no dia de hoje.
  - Grade com cabeçalho dos dias (1–31, letra do dia da semana acima e fins de semana com overlay `rgba(255,255,255,.03)`). O dia de hoje (26) fica num círculo azul, com uma linha vertical azul atravessando a grade. Feriados têm coluna amarela translúcida.
  - Linhas "TEAMMATE": avatar, nome e cargo em --muted. As barras de ausência são rounded-lg, com borda esquerda grossa na cor do tipo, fundo pastel translúcido e rótulo ("Vacation 5d", "Parental 31d", "2d"). Ausências de 1 dia aparecem como um quadradinho com um ponto.
- **"Pending requests"** (badge amarelo "4 waiting", texto escuro): cada linha tem avatar, nome, tag do tipo, "2h ago", datas, "2 days" e o motivo entre aspas; à direita, um ✕ cinza e o botão azul "✓ Approve".
- **"Leave balance"**: seletor da pessoa (avatar, nome, "Lisbon · Standard", "Accrual 2.08 d / month") e 3 aros SVG: Vacation 13.5 of 25 (azul), Sick 8 of 10 (laranja), Personal 2 of 3 (teal), com o rodapé "Resets Jan 1 · up to 5 days carry over".
- **Sidebar:** nav Calendar · Requests (badge amarelo 4) · Balances · Policies 5 · Public holidays; saved views Lisbon office 52, Berlin office 27, Parental leave 3; "PUBLIC HOLIDAYS" com mini-calendários (mês em amarelo e dia grande). Card do rodapé: "Out today" com avatares e "Next holiday · Dec 1".

## Tela 3 — Hiring pipeline (CTA "+ New role")
- **"Pipeline tunnel ● LIVE"** (card --navy, 2/3):
  - Toggle 30d / **90d** (ativo amarelo, texto escuro).
  - Estágios APPLIED 483 · SCREENING 141 · INTERVIEW 57 · OFFER 12 · HIRED 7.
  - Canvas de um túnel em perspectiva (cone horizontal em wireframe azul) com partículas fluindo da esquerda para a direita. Os anéis marcam cada estágio, e o último (Hired) brilha em amarelo.
  - Taxas de conversão abaixo: 29% · 41% · 21% · 58%.
- **"Time to hire"**: **23** days (o número tem um marca-texto amarelo atrás, texto escuro), badge "↘ 4 days vs Q2", "Target ≤ 30 days · 92% of hires on time", barras mensais May–Oct em azul translúcido, com Oct em azul forte e a linha "30D TARGET".
- **"Candidates"** (kanban, "12 active · all roles", toggle grid/list):
  - Colunas Applied (+3 today), Screening, Interview e Offer, com bolinha colorida no título.
  - Cada card tem avatar, nome, cargo, a origem (pill Inbound --muted / Referral verde / Sourced azul) e ⭐ nota (3.6–4.8), além da próxima ação com ícone de calendário ("Recruiter call · Tue") e a idade ("2d").
  - "+ Add candidate" no fim de cada coluna. Cards arrastáveis entre colunas.
- **"Open roles"** ("6 roles · 455 applicants"): cada vaga tem título, 🔥 se urgente e os dias abertos ("34d"), "● Engineering · 128 applicants", uma barra de progresso colorida pelo departamento e o avatar do gestor.
- **Sidebar:** Pipeline · Open roles 6 · Candidates 486 · Interviews 14 · Offers 2; saved views Referrals, Engineering, Silver medalists; "HIRING MANAGERS" (com "N profiles to review"); card "Interviews today" com horário azul (10:30, 14:00) e a pessoa.

## Tela 4 — Payroll (CTA "▶ Run payroll")
- **"Next payroll run"** (card azul --primary, com o tag "October"):
  - "Friday, Oct 30" (26px/800) e uma contagem regressiva em 4 caixas translúcidas: DAYS, HOURS, MIN, SEC (atualiza a cada segundo).
  - "Gross pay · 120 employees", com o valor **$1,086,400** numa pill amarela (texto escuro), e "+2 new hires".
  - "Run checklist 3/4", com 4 segmentos de progresso e os itens ✓ (Timesheets locked, Bonuses & commissions, New hires added, ○ Manager approvals).
  - Botões: "Review run" (amarelo, texto escuro, largo) e "Payslips" (translúcido).
- **"Cost breakdown"** (↗ 1.6% MoM): donut SVG com o centro "Total cost $1.49M per month". Fatias: Salary 73% azul ($1,086,400), Benefits 15% dourado ($228,600), Taxes 12% teal ($171,300). Rodapé: "Cost per employee $12,386 | vs September +$23.4k".
- **"Gross to net"** (waterfall, largura 2/3):
  - Pill "● Net pay 64% of gross" e o toggle "Gross → net | Trend" (ativo amarelo com borda escura, texto escuro).
  - Barras: Gross pay $1.09M (azul alto) → Income tax −$239k (laranja) → Social security −$83k (lilás) → Pension −$54k (teal) → Benefits −$18k (amarelo) → Net pay $693k (--deep, com o rótulo numa pill amarela).
  - As barras flutuantes ficam ligadas por linhas tracejadas (`rgba(154,163,178,.35)`), com o rótulo % abaixo de cada uma.
  - Animação: moedas douradas caem saindo do degrau do imposto.
- **"Upcoming payments" $2.63M** ("Next 4 weeks · 9 transfers"):
  - Cada linha tem um bloco de data (mês em cima, dia grande; o próximo vencimento fica destacado com fundo azul), ícone, título e subtítulo, além do valor e do status: ✓ Scheduled (verde), Approve (amarelo, texto escuro) ou ○ Draft (cinza).
  - Rodapé: "Operating account · 4821 $2,846,120 · Covers 1.9 runs", com barra azul, "2 payments need approval" e o botão escuro "Approve all".
- **Sidebar:** Pay runs · Payslips 120 · Benefits · Taxes & filings 3 · Reports; saved views Lisbon entity, Berlin entity, Contractors; "DEADLINES" com mini-datas. O card do rodapé é escuro (--deep): "✓ Filings up to date", "Q3 returns submitted Oct 14. Next deadline Jan 31." e 4 segmentos amarelos.

## Microinterações
- Troca de área pelo rail: conteúdo com fade + slide 8px (200ms). O marcador amarelo do rail desliza (`layoutId`).
- KPIs: contagem numérica de 0 até o valor (600ms), e as sparklines são desenhadas via `stroke-dashoffset`.
- Hover nos cards: `translateY(-2px)` e sombra maior + borda `#2E3750`. Os botões Approve viram ✓ "Approved" verde e a linha some (toast "Request approved").
- Dados "live": o ticker da constelação troca a mensagem a cada 4s; as partículas do funil são contínuas.
- Respeite `prefers-reduced-motion`: pare a rotação e as partículas.

## Moldura de apresentação (opcional, "modo reel")
Fundo preto. No topo, "logo + nome do estúdio" à esquerda e o domínio à direita (cinza). Depois, centralizados: "Dashboard" (branco 28px), o nome do produto em laranja #F26A1B (52px/800) e um subtítulo cinza. Em seguida vem o dashboard com cantos de 24px; abaixo, um bloco de código estilo editor (bolinhas vermelha/amarela/verde, caminho do arquivo, tag "TSX", numeração 170–181, syntax highlight com keywords rosa, tipos azul e números laranja). Rodapé: "People / Time off / Hiring / Payroll". As telas alternam a cada ≈2s com crossfade.

## Fluxo de trabalho
1. Perguntar só se faltar: quais telas (padrão: as 4) e o nome do produto e da empresa (padrão: fictícios).
2. Montar o shell (rail, sidebar, topbar) com estado `area`, e depois cada tela como componente, com dados mock num objeto único.
3. Implementar os canvases (constelação e funil) com DPR, `requestAnimationFrame` e cleanup.
4. Renderizar no Playwright a 1440×900, tirar screenshot de cada área e conferir: alinhamento dos KPIs, cores dos tipos de ausência, o kanban sem overflow e o waterfall fechando em Net pay.
5. Publicar como artefato. Entregar como arquivo se o usuário pedir o código.
