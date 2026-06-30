# Barbearia SaaS

Sistema de agendamento para barbearia com area publica para clientes, painel administrativo, cadastro de profissionais, servicos, agenda, historico por telefone e integracao opcional com WhatsApp.

## Status Do Projeto

Este projeto foi recuperado para voltar a rodar localmente.

Funcional agora:

- pagina publica de agendamento;
- listagem de servicos e profissionais;
- criacao de agendamento;
- painel administrativo;
- login admin;
- dashboard;
- cadastro de profissionais;
- cadastro de servicos;
- agenda e bloqueio de horarios;
- historico por telefone;
- envio via WhatsApp opcional.

Ainda pendente:

- login separado para profissionais/barbeiros;
- revisao completa das migrations;
- decisao entre manter `whatsapp-web.js` ou migrar para WhatsApp Cloud API oficial;
- testes automatizados;
- revisao de modulos legados de financeiro e Google Calendar.

## Documentacao

Para preparar e rodar o projeto localmente, siga:

[docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md)

Para ver o mapeamento do dump antigo para o schema local, veja:

[docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)

O guia inclui:

- instalacao;
- configuracao do `.env`;
- conexao com PostgreSQL;
- criacao do banco local;
- seed inicial;
- execucao do app;
- credenciais admin;
- restauracao de backups antigos;
- configuracao do WhatsApp;
- comandos de troubleshooting;
- cuidados antes de subir para o GitHub.

## Uso Rapido

```powershell
cd C:\Users\milenasilesio\Downloads\BARBEARIASAAS
copy .env.example .env
npm install
npm run db:schema
npm run seed
npm start
```

Depois acesse:

```txt
Publico: http://127.0.0.1:3000
Admin:   http://127.0.0.1:3000/admin/login
```

Credenciais locais:

```txt
Usuario: admin
Senha: admin123
```

> Use `127.0.0.1` em vez de `localhost` se houver conflito de porta no Windows.

## Banco De Dados Local

Configuracao padrao:

```txt
Host: 127.0.0.1
Porta: 6543
Banco: barbeariadoblack_db
Usuario: postgres
Senha: postgres
```

String de conexao:

```txt
postgres://postgres:postgres@127.0.0.1:6543/barbeariadoblack_db
```

## WhatsApp

Por padrao, o ambiente local usa:

```env
WHATSAPP_ENABLED=false
```

Assim o app cria agendamentos sem depender do WhatsApp. Para testar envio automatico via `whatsapp-web.js`, altere para `true`, reinicie o servidor e escaneie o QR Code em `/admin/config`.

## Scripts

```powershell
npm start          # inicia o servidor
npm run dev        # inicia com nodemon
npm run db:schema  # cria o schema mapeado do dump antigo
npm run seed       # popula dados iniciais e sincroniza models principais
npm run migrate    # legado; migrations precisam revisao antes de uso confiavel
```

## Observacoes Para GitHub

Nao subir arquivos locais ou sensiveis:

- `.env`
- `.local-postgres/`
- `node_modules/`
- logs locais;
- backups reais de banco de dados.

Esses itens ja estao no `.gitignore`.
