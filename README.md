# Barbearia SaaS (demo de portfólio)

Aplicação web para agendamento de barbearia, com área pública para clientes e painel administrativo.

Este repositório foi preparado como **demo leve para portfólio**: roda localmente com poucos comandos, usa **SQLite por padrão** (sem custo de infraestrutura) e pode ser publicada em hospedagens gratuitas compatíveis com Node.js.

## Funcionalidades

- Página pública de agendamento
- Listagem de serviços e profissionais
- Criação e consulta de agendamentos
- Painel administrativo (login, dashboard, profissionais, serviços, agenda/configurações)
- Histórico por telefone
- Integração com WhatsApp **opcional/desativada por padrão** (módulo pesado, não necessário para a demo)

## Stack

- Node.js + Express
- Handlebars (views server-side)
- Sequelize
- SQLite (padrão para demo) / PostgreSQL (opcional)
- Socket.IO

## Execução local

```powershell
cd C:\Users\milenasilesio\OneDrive\Documentos\BARBEARIASAAS
copy .env.example .env
npm install
npm run seed
npm start
```

Acesse:
- Público: `http://127.0.0.1:3000`
- Admin: `http://127.0.0.1:3000/admin/login`

Credenciais de demonstração:
- Usuário: `admin`
- Senha: `admin123`

> O projeto cria automaticamente o banco SQLite em `data/database.sqlite` e popula dados iniciais quando o banco está vazio (`AUTO_SEED`).

## Publicação online sem custo (portfólio)

Opção prática: **Render** (plano gratuito para Web Service).

1. Suba o projeto para um repositório GitHub.
2. No Render, crie um **Web Service** apontando para o repositório.
3. Build command: `npm install --omit=optional && npm run seed`
4. Start command: `npm start`
5. Variáveis de ambiente sugeridas:
   - `NODE_ENV=production`
   - `DB_DIALECT=sqlite`
   - `SQLITE_STORAGE=./data/database.sqlite`
   - `WHATSAPP_ENABLED=false`
   - `SESSION_SECRET` (valor seguro)
   - `BASE_URL` / `CORS_ORIGINS` com a URL pública do serviço

O arquivo `render.yaml` inclui uma configuração base para esse cenário.

**Observação:** no plano gratuito, o disco pode ser efêmero e o serviço pode hibernar. Para um portfólio isso é aceitável; para produção real, use banco persistente (PostgreSQL gerenciado).

## Variáveis principais

Veja `.env.example`. Destaques:
- `DB_DIALECT=sqlite` (padrão) ou `postgres`
- `WHATSAPP_ENABLED=false` evita dependências pesadas (Puppeteer/WhatsApp Web)
- `AUTO_SEED=true` cria admin/serviços/profissionais de exemplo no primeiro boot

## Scripts

```powershell
npm start   # inicia o servidor
npm run dev # desenvolvimento com nodemon
npm run seed
npm test    # verificação de sintaxe (node --check)
```

## Estrutura (resumo)

- `server.js` — bootstrap HTTP/Socket.IO
- `app.js` — configuração Express, sessões, rotas e middlewares
- `models/` — modelos Sequelize
- `routes/` — rotas públicas e administrativas
- `views/` — templates Handlebars
- `public/` — assets estáticos
- `config/` — banco, seed e helpers

## Notas

- A integração com WhatsApp via `whatsapp-web.js` foi mantida como **opcional** e com carregamento sob demanda para não pesar na demo.
- Arquivos locais/sensíveis (ex.: `.env`, `data/`, `node_modules/`, sessões) devem permanecer fora do Git.
