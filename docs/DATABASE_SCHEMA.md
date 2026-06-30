# Schema Do Banco De Dados

Este documento registra o mapeamento feito a partir do dump antigo do banco.

Arquivo usado como fonte principal:

```txt
C:\Users\milenasilesio\OneDrive\Documentos\Backups Bancos\Black\dump-barbeariadoblack_db-20250922221122-09-2025.sql
```

O arquivo `.backup` de 2025-11-01 tambem foi identificado como um dump custom do PostgreSQL, mas precisa de `pg_restore` 17 para restaurar. O `pg_restore` 16 nao consegue ler esse formato.

## Como Criar O Schema Local

Em um banco PostgreSQL vazio:

```powershell
npm run db:schema
npm run seed
```

O comando `npm run db:schema` aplica:

```txt
database/schema-from-backup.sql
```

O comando `npm run seed` cria dados minimos para uso local, como admin, barbeiros, servicos e configuracoes.

## Tabelas Mapeadas Do Dump

O baseline cria as tabelas abaixo:

```txt
GoogleCalendarConflicts
GoogleCalendarSyncLogs
GoogleCalendarWebhooks
SequelizeMeta
Sessions
VerificationCodes
appointment_services
appointments
barbers
cash_flows
clients
commissions
fixed_expenses
google_calendar_sync_tokens
message_logs
message_templates
service_types
sessions
system_configs
users
```

Observacao: o dump tem `Sessions` com S maiusculo e `sessions` minusculo. O app atual usa `sessions` minusculo via `connect-session-sequelize`, mas as duas foram preservadas para compatibilidade com o backup.

## Enums Mapeados

```txt
enum_appointments_status:
pending, confirmed, in_progress, completed, cancelled, no_show, blocked

enum_cash_flows_category:
appointment, fixed_expense, variable_expense, other_income

enum_cash_flows_type:
income, expense

enum_commissions_type:
percentage, fixed

enum_fixed_expenses_category:
rent, utilities, supplies, equipment, insurance, taxes, salaries, other

enum_fixed_expenses_frequency:
monthly, weekly, daily, yearly

enum_message_logs_platform:
whatsapp, sms, email

enum_message_logs_status:
pending, sent, delivered, failed, cancelled

enum_message_templates_platform:
whatsapp, sms, email

enum_message_templates_type:
reminder, followup, confirmation, cancellation

enum_users_role:
admin, manager, employee
```

## Tabelas Usadas Pelo App Atual

Os models atuais usam principalmente:

```txt
appointments
barbers
clients
service_types
system_configs
users
VerificationCodes
sessions
```

As demais tabelas existem no dump e foram preservadas no baseline, mas ainda precisam de revisao funcional antes de serem tratadas como modulos prontos:

```txt
appointment_services
cash_flows
commissions
fixed_expenses
message_logs
message_templates
google_calendar_sync_tokens
GoogleCalendarConflicts
GoogleCalendarSyncLogs
GoogleCalendarWebhooks
```

## Diferencas Conhecidas

As migrations existentes no projeto nao devem ser consideradas a fonte de verdade neste momento. Elas estao incompletas e algumas divergem do dump. Exemplos:

- `appointment_services.price` aparece como `STRING` em migration antiga, mas no dump e `numeric(10,2)`.
- `message_logs.status` aparece com valores em portugues em uma migration antiga, mas no dump os valores sao `pending`, `sent`, `delivered`, `failed`, `cancelled`.
- `commissions.type` aparece em portugues em uma migration antiga, mas no dump os valores sao `percentage` e `fixed`.

O indice unico `uq_appointments_regular_slot` foi alinhado ao model atual do app para considerar `isBlock = false`. Isso permite bloquear horarios sem conflitar com a regra de horarios normais.

## Recomendacao Atual

Para desenvolvimento local, use:

```powershell
npm run db:schema
npm run seed
```

Use `npm run migrate` apenas depois de revisar e corrigir a trilha de migrations.
