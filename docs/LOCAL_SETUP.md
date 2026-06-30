# Guia de Ambiente Local

Este guia prepara o projeto para rodar localmente em Windows com PowerShell.

Endereco recomendado do app:

```txt
http://127.0.0.1:3000
```

No ambiente onde o projeto foi recuperado havia outro processo respondendo em `localhost:3000` via IPv6. Por isso, use `127.0.0.1` para evitar abrir o app errado.

## 1. Requisitos

- Node.js 20 ou superior
- npm 11 ou superior
- PostgreSQL 16 ou 17
- PowerShell
- Opcional: Docker Desktop, se preferir banco via container

Versoes usadas na preparacao:

```powershell
node -v
npm -v
```

## 2. Variaveis De Ambiente

Crie o arquivo `.env` a partir do exemplo:

```powershell
copy .env.example .env
```

Configuracao local esperada:

```env
NODE_ENV=development
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=6543
DB_NAME=barbeariadoblack_db
DB_USER=postgres
DB_PASSWORD=postgres
BASE_URL=http://127.0.0.1:3000
WHATSAPP_ENABLED=false
```

O arquivo `.env` nao deve ser commitado. Ele ja esta ignorado pelo Git.

## 3. Instalacao Das Dependencias

Na raiz do projeto:

```powershell
cd C:\Users\milenasilesio\Downloads\BARBEARIASAAS
npm install
```

## 4. Banco De Dados

Ha duas formas recomendadas.

## Opcao A: PostgreSQL Local Isolado No Projeto

Esta foi a opcao usada para validar o app localmente. Ela cria um cluster PostgreSQL dentro de `.local-postgres`, sem mexer nos servicos PostgreSQL ja instalados no Windows.

### Criar o cluster local

Execute uma vez:

```powershell
cd C:\Users\milenasilesio\Downloads\BARBEARIASAAS

$pgBin = "C:\Program Files\PostgreSQL\17\bin"
& "$pgBin\initdb.exe" -D .local-postgres -U postgres --auth=trust --encoding=UTF8 --no-locale
& "$pgBin\pg_ctl.exe" -D .local-postgres -o "-p 6543" -l .local-postgres\postgres.log start
& "$pgBin\createdb.exe" -h 127.0.0.1 -p 6543 -U postgres barbeariadoblack_db
```

### Iniciar o banco depois

Sempre que reiniciar o computador:

```powershell
cd C:\Users\milenasilesio\Downloads\BARBEARIASAAS
& "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D .local-postgres -o "-p 6543" -l .local-postgres\postgres.log start
```

### Confirmar conexao

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_isready.exe" -h 127.0.0.1 -p 6543 -U postgres
```

Saida esperada:

```txt
127.0.0.1:6543 - accepting connections
```

### Parar o banco

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D .local-postgres stop
```

## Opcao B: Docker Compose

Se Docker Desktop estiver rodando:

```powershell
docker compose up -d
```

O `docker-compose.yml` usa:

```txt
Host: 127.0.0.1
Porta: 6543
Banco: barbeariadoblack_db
Usuario: postgres
Senha: postgres
```

## 5. Conectar Ao Banco

Use estes dados em DBeaver, pgAdmin, TablePlus ou psql:

```txt
Host: 127.0.0.1
Porta: 6543
Database: barbeariadoblack_db
User: postgres
Password: postgres
```

String de conexao:

```txt
postgres://postgres:postgres@127.0.0.1:6543/barbeariadoblack_db
```

Teste via psql:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h 127.0.0.1 -p 6543 -U postgres -d barbeariadoblack_db
```

## 6. Criar Tabelas E Dados Iniciais

As migrations atuais sao legadas/incompletas. Para um banco local novo, use o schema mapeado do backup antigo e depois o seed:

```powershell
npm run db:schema
npm run seed
```

O comando `db:schema` aplica o arquivo:

```txt
database/schema-from-backup.sql
```

Esse arquivo foi reconstruido a partir do dump SQL antigo e cria as tabelas encontradas no backup, incluindo tabelas de financeiro, logs de mensagens e Google Calendar.

O seed:

- sincroniza os models principais com o banco atual;
- cria o admin local;
- cria profissionais iniciais;
- cria servicos iniciais;
- cria configuracoes basicas do cron.

Credenciais criadas:

```txt
Usuario: admin
Senha: admin123
```

## 7. Rodar O App

Na raiz do projeto:

```powershell
npm start
```

Acesse:

```txt
Publico: http://127.0.0.1:3000
Admin:   http://127.0.0.1:3000/admin/login
```

Login admin:

```txt
Usuario: admin
Senha: admin123
```

Para desenvolvimento com reload:

```powershell
npm run dev
```

## 8. Rodar Em Background No Windows

Opcionalmente, para deixar o servidor aberto em segundo plano:

```powershell
cd C:\Users\milenasilesio\Downloads\BARBEARIASAAS

$out = Join-Path (Get-Location) "server.local.log"
$err = Join-Path (Get-Location) "server.local.err.log"
Start-Process -FilePath "npm.cmd" -ArgumentList "start" -WorkingDirectory (Get-Location) -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden
```

Verificar se o Node esta ouvindo:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen
```

Parar o Node deste projeto:

```powershell
$nodeConn = Get-NetTCPConnection -LocalPort 3000 -State Listen |
  Where-Object { $_.LocalAddress -eq "0.0.0.0" -and (Get-Process -Id $_.OwningProcess).ProcessName -eq "node" } |
  Select-Object -First 1

if ($nodeConn) {
  Stop-Process -Id $nodeConn.OwningProcess -Force
}
```

## 9. WhatsApp Local

Por padrao:

```env
WHATSAPP_ENABLED=false
```

Com isso, o app cria agendamentos normalmente sem WhatsApp conectado. O retorno tera `whatsappSent: false`, mas o agendamento nao falha.

Para testar envio via `whatsapp-web.js`:

1. Altere no `.env`:

```env
WHATSAPP_ENABLED=true
```

2. Reinicie o servidor.
3. Acesse:

```txt
http://127.0.0.1:3000/admin/config
```

4. Escaneie o QR Code.

Observacao: para producao, o ideal e avaliar migracao para a WhatsApp Business Platform Cloud API oficial da Meta. A integracao atual ainda usa WhatsApp Web.

## 10. Restaurar Backup Antigo

Foram analisados dois backups:

- `.sql` de 2025-09-22: legivel por `psql`.
- `.backup` de 2025-11-01: formato custom PostgreSQL (`PGDMP`) gerado por `pg_dump 17.5`.

O `.backup` precisa de `pg_restore` 17. O `pg_restore` 16 falha com:

```txt
unsupported version (1.16) in file header
```

### Restaurar arquivo SQL

```powershell
$env:PGPASSWORD = "postgres"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h 127.0.0.1 -p 6543 -U postgres -d postgres -f "C:\caminho\para\dump.sql"
```

### Restaurar arquivo .backup

```powershell
$backup = "C:\caminho\para\dump-barbeariadoblack_db-20251101132901-11-2025.backup"
$env:PGPASSWORD = "postgres"

& "C:\Program Files\PostgreSQL\17\bin\dropdb.exe" -h 127.0.0.1 -p 6543 -U postgres --if-exists barbeariadoblack_db
& "C:\Program Files\PostgreSQL\17\bin\createdb.exe" -h 127.0.0.1 -p 6543 -U postgres barbeariadoblack_db
& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" -h 127.0.0.1 -p 6543 -U postgres -d barbeariadoblack_db --clean --if-exists $backup
```

Depois de restaurar, inicie o app:

```powershell
npm start
```

## 11. Comandos Uteis

```powershell
npm install
npm run db:schema
npm run seed
npm start
npm run dev
npm audit --audit-level=high
```

Verificar banco:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_isready.exe" -h 127.0.0.1 -p 6543 -U postgres
```

Verificar app:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/admin/login
```

## 12. Problemas Comuns

### Abri `localhost:3000` e apareceu outro sistema

Use:

```txt
http://127.0.0.1:3000
```

### Erro de conexao no banco

Confirme:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_isready.exe" -h 127.0.0.1 -p 6543 -U postgres
```

Se nao estiver aceitando conexoes, inicie o banco:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D .local-postgres -o "-p 6543" -l .local-postgres\postgres.log start
```

### Porta 3000 ocupada

Veja quem esta usando:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen |
  Select-Object LocalAddress,LocalPort,OwningProcess,@{n="ProcessName";e={(Get-Process -Id $_.OwningProcess).ProcessName}}
```

O app deste projeto deve aparecer como `node` em `0.0.0.0:3000`.

## 13. Antes De Subir Para O GitHub

Nao subir:

- `.env`
- `.local-postgres/`
- `node_modules/`
- `server.local.log`
- `server.local.err.log`
- backups de banco com dados reais

Esses itens ja estao no `.gitignore`.

Subir:

- codigo-fonte;
- `README.md`;
- `docs/LOCAL_SETUP.md`;
- `docs/DATABASE_SCHEMA.md`;
- `.env.example`;
- `database/schema-from-backup.sql`;
- `scripts/applySchema.js`;
- `package.json`;
- `package-lock.json`;
- migrations existentes, mesmo que precisem revisao futura.
