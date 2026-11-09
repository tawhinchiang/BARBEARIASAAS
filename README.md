# Barbearia SaaS — demo de portfólio

Aplicação web para **gestão e agendamento de barbearia**, com área pública para clientes e painel administrativo. UI com estética **Crew dark/black** adaptada ao domínio de barbearia.

## Funcionalidades

- Agendamento público (serviço → profissional → data/horário → dados → confirmação)
- Catálogo de serviços (com imagens SVG) e profissionais
- Histórico do cliente por telefone (verificação por código + cancelamento quando permitido)
- Painel administrativo: login, dashboard/KPIs, agenda/encaixes, profissionais, serviços, relatórios, configurações
- WhatsApp **integrado por provider** (configurável por env):
  - **Meta WhatsApp Cloud API** (recomendado para deploy)
  - **whatsapp-web.js** (QR/sessão, legado/local)
  - **Modo demo** (sem WhatsApp real: histórico exibe o código para testes)

## Stack

- Node.js (>= 18) + Express
- Handlebars (server-side views)
- Sequelize
- SQLite por padrão (demo) / PostgreSQL opcional
- Socket.IO
- Front-end: Bootstrap 5, CSS próprio (design system Crew dark), JS vanilla por página

## Execução local (rápido)

```powershell
cd C:\Users\milenasilesio\OneDrive\Documentos\BARBEARIASAAS
copy .env.example .env
npm install
npm start
```

Acesse:
- Público: `http://127.0.0.1:3000`
- Histórico: `http://127.0.0.1:3000/history`
- Admin: `http://127.0.0.1:3000/admin/login`

Credenciais de demonstração (auto-seed):
- Usuário: `admin`
- Senha: `admin123`

> Com `DB_DIALECT=sqlite` e `AUTO_SEED=true` (padrão do demo), o banco é criado em `data/database.sqlite` e populado com admin, 3 profissionais e 8 serviços com imagens.

## Rodando com WhatsApp integrado (Meta Cloud API) — recomendado

A Cloud API usa HTTP (Graph API), sem Puppeteer/QR, e funciona bem em hospedagens como Render.

### 1) Pré-requisitos (Meta)
1. Crie um app em [Meta for Developers](https://developers.facebook.com/) e adicione o produto **WhatsApp**.
2. Configure uma **WhatsApp Business Account** e um número (o ambiente de teste da Meta fornece número/credenciais de teste).
3. Gere/obtenha um **token de acesso** (`WHATSAPP_TOKEN`). Para produção, use um token permanente (System User) com as permissões adequadas.
4. Obtenha o **Phone Number ID** do remetente (`WHATSAPP_PHONE_NUMBER_ID`).

> Observação: no modo de teste da Meta, geralmente só é possível enviar para números verificados/adicionados ao app. Em produção, siga as políticas de opt-in, janelas de conversa e templates quando aplicável.

### 2) Variáveis de ambiente

```env
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=cloud
WHATSAPP_TOKEN=SEU_TOKEN
WHATSAPP_PHONE_NUMBER_ID=SEU_PHONE_NUMBER_ID
WHATSAPP_API_VERSION=v20.0
WHATSAPP_DEFAULT_COUNTRY_CODE=55
DEMO_SHOW_CODE=false
```

- `WHATSAPP_PROVIDER=cloud` (ou `meta`) ativa o provider da Meta Cloud API.
- `WHATSAPP_DEFAULT_COUNTRY_CODE` é usado para normalizar números locais (ex.: DDD+número BR → `55...`).
- `DEMO_SHOW_CODE=false` garante que o código **não** seja exibido na UI quando o envio real estiver configurado.

### 3) Como validar
1. Inicie o app com as variáveis acima.
2. Acesse `/history`, informe um telefone válido (no teste da Meta, use um número permitido) e solicite o código.
3. O envio é feito via `POST https://graph.facebook.com/{WHATSAPP_API_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages`.
4. No admin, o status do WhatsApp refletirá o provider/configuração.

## Outros modos de WhatsApp

### whatsapp-web.js (QR/sessão) — legado/local
```env
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=wwebjs
WHATSAPP_SESSION_NAME=barbershop_session
```
- Requer dependências opcionais (`whatsapp-web.js`, `puppeteer`, `qrcode-terminal`): `npm install` (em ambientes que instalem optional deps) e Chromium compatível.
- Exige leitura de QR e sessão persistente (`.wwebjs_auth`). **Pouco confiável no Render free** (efêmero, memória/Chromium). Prefira Cloud API em deploy.

### Modo demo (portfólio, sem WhatsApp real)
```env
WHATSAPP_ENABLED=false
# DEMO_SHOW_CODE=true  (padrão quando WhatsApp desabilitado)
```
- O histórico funciona para demonstração: o backend retorna `demoCode` e a UI exibe o código (não envia WhatsApp). Útil para portfólio/testes sem credenciais.

## Deploy no Render (gratuito, demo)

1. Suba o repositório para o GitHub.
2. Crie um **Web Service** no Render.
3. Build: `npm install --omit=optional && npm run seed` (ou use auto-seed).
4. Start: `npm start`
5. Variáveis sugeridas:
   - `NODE_ENV=production`
   - `DB_DIALECT=sqlite`
   - `SQLITE_STORAGE=./data/database.sqlite`
   - `SESSION_SECRET` (valor seguro)
   - `AUTO_SEED=true`
   - `BASE_URL` / `CORS_ORIGINS` = URL pública do serviço
   - Para WhatsApp real: `WHATSAPP_ENABLED=true`, `WHATSAPP_PROVIDER=cloud`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `DEMO_SHOW_CODE=false`
   - Para demo sem credenciais: `WHATSAPP_ENABLED=false`

`render.yaml` contém uma base de configuração.

> Limitação do plano gratuito: disco pode ser efêmero e o serviço hiberna. Para produção, use PostgreSQL gerenciado e segredos fora do repositório.

## Variáveis de ambiente (principais)

| Variável | Descrição |
|---|---|
| `PORT` | Porta HTTP (padrão `3000`) |
| `DB_DIALECT` | `sqlite` (padrão) ou `postgres` |
| `SQLITE_STORAGE` | Caminho do arquivo SQLite |
| `SESSION_SECRET` | Segredo da sessão (troque em produção) |
| `AUTO_SEED` | Popula dados de demo quando o banco está vazio |
| `WHATSAPP_ENABLED` | Habilita/desabilita WhatsApp |
| `WHATSAPP_PROVIDER` | `cloud` (Meta) ou `wwebjs` |
| `WHATSAPP_TOKEN` | Token da Meta Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número remetente (Meta) |
| `WHATSAPP_API_VERSION` | Versão da Graph API (ex.: `v20.0`) |
| `WHATSAPP_DEFAULT_COUNTRY_CODE` | DDI padrão para normalização (ex.: `55`) |
| `DEMO_SHOW_CODE` | Exibe código na UI (demo); use `false` com envio real |
| `BARBERSHOP_NAME` / `BARBERSHOP_LOGO` | Identidade visual |

Veja `.env.example` para a lista completa.

## Scripts

```powershell
npm start    # inicia o servidor
npm run dev  # nodemon (desenvolvimento)
npm run seed # popula banco (config/seed.js)
npm test     # verificação de sintaxe (node --check)
```

## Estrutura (resumo)

- `server.js` — bootstrap HTTP/Socket.IO
- `app.js` — Express, sessões, CORS/segurança, rotas e views
- `models/` — Sequelize (+ auto-seed)
- `routes/` — rotas públicas, histórico e admin
- `views/` — templates Handlebars
- `public/` — assets estáticos (CSS, JS, imagens/serviços/logo)
- `utils/whatsapp.js` — integração WhatsApp (Cloud API / wwebjs / fallback)
- `dashboard-rh-crew/SKILL.md` — especificação da estética Crew adaptada à barbearia

## Notas de segurança/operação

- Não versione `.env`, `data/`, `node_modules/`, sessões ou tokens.
- O fallback `DEMO_SHOW_CODE` é para **demo/portfólio**; desative (`false`) em ambientes com envio real.
- A integração Cloud API retorna sucesso quando a Meta **aceita** a mensagem; entrega final depende de políticas/janela/opt-in do WhatsApp.