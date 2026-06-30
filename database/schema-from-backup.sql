-- Baseline schema reconstructed from:
-- dump-barbeariadoblack_db-20250922221122-09-2025.sql
--
-- Use this file to create the local development schema before running the seed.
-- It intentionally keeps the tables found in the old backup, including legacy
-- finance, message and Google Calendar tables that are not fully wired in the
-- current UI.

SET client_min_messages = warning;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_appointments_status') THEN
    CREATE TYPE public.enum_appointments_status AS ENUM (
      'pending',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled',
      'no_show',
      'blocked'
    );
  END IF;
END $$;
ALTER TYPE public.enum_appointments_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.enum_appointments_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE public.enum_appointments_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE public.enum_appointments_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE public.enum_appointments_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.enum_appointments_status ADD VALUE IF NOT EXISTS 'no_show';
ALTER TYPE public.enum_appointments_status ADD VALUE IF NOT EXISTS 'blocked';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_cash_flows_category') THEN
    CREATE TYPE public.enum_cash_flows_category AS ENUM (
      'appointment',
      'fixed_expense',
      'variable_expense',
      'other_income'
    );
  END IF;
END $$;
ALTER TYPE public.enum_cash_flows_category ADD VALUE IF NOT EXISTS 'appointment';
ALTER TYPE public.enum_cash_flows_category ADD VALUE IF NOT EXISTS 'fixed_expense';
ALTER TYPE public.enum_cash_flows_category ADD VALUE IF NOT EXISTS 'variable_expense';
ALTER TYPE public.enum_cash_flows_category ADD VALUE IF NOT EXISTS 'other_income';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_cash_flows_type') THEN
    CREATE TYPE public.enum_cash_flows_type AS ENUM ('income', 'expense');
  END IF;
END $$;
ALTER TYPE public.enum_cash_flows_type ADD VALUE IF NOT EXISTS 'income';
ALTER TYPE public.enum_cash_flows_type ADD VALUE IF NOT EXISTS 'expense';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_commissions_type') THEN
    CREATE TYPE public.enum_commissions_type AS ENUM ('percentage', 'fixed');
  END IF;
END $$;
ALTER TYPE public.enum_commissions_type ADD VALUE IF NOT EXISTS 'percentage';
ALTER TYPE public.enum_commissions_type ADD VALUE IF NOT EXISTS 'fixed';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_fixed_expenses_category') THEN
    CREATE TYPE public.enum_fixed_expenses_category AS ENUM (
      'rent',
      'utilities',
      'supplies',
      'equipment',
      'insurance',
      'taxes',
      'salaries',
      'other'
    );
  END IF;
END $$;
ALTER TYPE public.enum_fixed_expenses_category ADD VALUE IF NOT EXISTS 'rent';
ALTER TYPE public.enum_fixed_expenses_category ADD VALUE IF NOT EXISTS 'utilities';
ALTER TYPE public.enum_fixed_expenses_category ADD VALUE IF NOT EXISTS 'supplies';
ALTER TYPE public.enum_fixed_expenses_category ADD VALUE IF NOT EXISTS 'equipment';
ALTER TYPE public.enum_fixed_expenses_category ADD VALUE IF NOT EXISTS 'insurance';
ALTER TYPE public.enum_fixed_expenses_category ADD VALUE IF NOT EXISTS 'taxes';
ALTER TYPE public.enum_fixed_expenses_category ADD VALUE IF NOT EXISTS 'salaries';
ALTER TYPE public.enum_fixed_expenses_category ADD VALUE IF NOT EXISTS 'other';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_fixed_expenses_frequency') THEN
    CREATE TYPE public.enum_fixed_expenses_frequency AS ENUM (
      'monthly',
      'weekly',
      'daily',
      'yearly'
    );
  END IF;
END $$;
ALTER TYPE public.enum_fixed_expenses_frequency ADD VALUE IF NOT EXISTS 'monthly';
ALTER TYPE public.enum_fixed_expenses_frequency ADD VALUE IF NOT EXISTS 'weekly';
ALTER TYPE public.enum_fixed_expenses_frequency ADD VALUE IF NOT EXISTS 'daily';
ALTER TYPE public.enum_fixed_expenses_frequency ADD VALUE IF NOT EXISTS 'yearly';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_message_logs_platform') THEN
    CREATE TYPE public.enum_message_logs_platform AS ENUM ('whatsapp', 'sms', 'email');
  END IF;
END $$;
ALTER TYPE public.enum_message_logs_platform ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE public.enum_message_logs_platform ADD VALUE IF NOT EXISTS 'sms';
ALTER TYPE public.enum_message_logs_platform ADD VALUE IF NOT EXISTS 'email';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_message_logs_status') THEN
    CREATE TYPE public.enum_message_logs_status AS ENUM (
      'pending',
      'sent',
      'delivered',
      'failed',
      'cancelled'
    );
  END IF;
END $$;
ALTER TYPE public.enum_message_logs_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.enum_message_logs_status ADD VALUE IF NOT EXISTS 'sent';
ALTER TYPE public.enum_message_logs_status ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE public.enum_message_logs_status ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE public.enum_message_logs_status ADD VALUE IF NOT EXISTS 'cancelled';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_message_templates_platform') THEN
    CREATE TYPE public.enum_message_templates_platform AS ENUM ('whatsapp', 'sms', 'email');
  END IF;
END $$;
ALTER TYPE public.enum_message_templates_platform ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE public.enum_message_templates_platform ADD VALUE IF NOT EXISTS 'sms';
ALTER TYPE public.enum_message_templates_platform ADD VALUE IF NOT EXISTS 'email';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_message_templates_type') THEN
    CREATE TYPE public.enum_message_templates_type AS ENUM (
      'reminder',
      'followup',
      'confirmation',
      'cancellation'
    );
  END IF;
END $$;
ALTER TYPE public.enum_message_templates_type ADD VALUE IF NOT EXISTS 'reminder';
ALTER TYPE public.enum_message_templates_type ADD VALUE IF NOT EXISTS 'followup';
ALTER TYPE public.enum_message_templates_type ADD VALUE IF NOT EXISTS 'confirmation';
ALTER TYPE public.enum_message_templates_type ADD VALUE IF NOT EXISTS 'cancellation';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_role') THEN
    CREATE TYPE public.enum_users_role AS ENUM ('admin', 'manager', 'employee');
  END IF;
END $$;
ALTER TYPE public.enum_users_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.enum_users_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.enum_users_role ADD VALUE IF NOT EXISTS 'employee';

CREATE TABLE IF NOT EXISTS public."SequelizeMeta" (
  name varchar(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Sessions" (
  sid varchar(36) NOT NULL,
  expires timestamptz,
  data text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sessions (
  sid varchar(36) NOT NULL,
  expires timestamptz,
  data text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public."VerificationCodes" (
  id integer GENERATED BY DEFAULT AS IDENTITY,
  phone varchar(255) NOT NULL,
  code varchar(4) NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.clients (
  id integer GENERATED BY DEFAULT AS IDENTITY,
  "firstName" varchar(50) NOT NULL,
  "lastName" varchar(50) NOT NULL,
  phone varchar(20) NOT NULL,
  email varchar(100),
  "isActive" boolean DEFAULT true,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.barbers (
  id integer GENERATED BY DEFAULT AS IDENTITY,
  name varchar(100) NOT NULL,
  phone varchar(20) NOT NULL,
  email varchar(100),
  cpf varchar(255) NOT NULL,
  specialties json DEFAULT '[]'::json,
  "workingHours" json,
  "isActive" boolean DEFAULT true,
  photo varchar(255),
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.service_types (
  id integer GENERATED BY DEFAULT AS IDENTITY,
  name varchar(100) NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  duration integer NOT NULL,
  "isActive" boolean DEFAULT true,
  "isPromo" boolean DEFAULT false NOT NULL,
  photo varchar(255),
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.users (
  id integer GENERATED BY DEFAULT AS IDENTITY,
  username varchar(50) NOT NULL,
  password varchar(255) NOT NULL,
  email varchar(100) NOT NULL,
  role public.enum_users_role DEFAULT 'admin'::public.enum_users_role,
  "isActive" boolean DEFAULT true,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.system_configs (
  key varchar(255) NOT NULL,
  value varchar(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fixed_expenses (
  id integer GENERATED BY DEFAULT AS IDENTITY,
  name varchar(255) NOT NULL,
  description text,
  amount numeric(10,2) NOT NULL,
  frequency public.enum_fixed_expenses_frequency DEFAULT 'monthly'::public.enum_fixed_expenses_frequency,
  "dueDay" integer,
  category public.enum_fixed_expenses_category DEFAULT 'other'::public.enum_fixed_expenses_category,
  "isActive" boolean DEFAULT true,
  "startDate" timestamptz NOT NULL,
  "endDate" timestamptz,
  "autoGenerate" boolean DEFAULT true,
  "lastGenerated" timestamptz,
  notes text,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
);

CREATE TABLE IF NOT EXISTS public.message_templates (
  id integer GENERATED BY DEFAULT AS IDENTITY,
  name varchar(255) NOT NULL,
  type public.enum_message_templates_type NOT NULL,
  title varchar(255) NOT NULL,
  content text NOT NULL,
  "triggerHours" integer,
  "triggerDays" integer,
  "isActive" boolean DEFAULT true,
  platform public.enum_message_templates_platform DEFAULT 'whatsapp'::public.enum_message_templates_platform,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id integer GENERATED BY DEFAULT AS IDENTITY,
  "clientId" integer,
  "barberId" integer NOT NULL,
  "serviceTypeId" integer,
  "reminderSent" boolean DEFAULT false NOT NULL,
  "appointmentDate" date NOT NULL,
  "appointmentTime" time without time zone NOT NULL,
  "serviceDuration" integer DEFAULT 20 NOT NULL,
  status public.enum_appointments_status DEFAULT 'pending'::public.enum_appointments_status,
  notes text,
  "whatsappSent" boolean DEFAULT false NOT NULL,
  "followUpSent" boolean DEFAULT false,
  "cancelReason" varchar(255),
  "isEncaixe" boolean DEFAULT false NOT NULL,
  "fitInNote" varchar(255),
  "totalPrice" numeric(10,2),
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "blockReason" varchar,
  "isBlock" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.appointment_services (
  id integer GENERATED BY DEFAULT AS IDENTITY,
  "appointmentId" integer NOT NULL,
  "serviceTypeId" integer NOT NULL,
  price numeric(10,2) NOT NULL,
  duration integer NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.cash_flows (
  id integer GENERATED BY DEFAULT AS IDENTITY,
  type public.enum_cash_flows_type NOT NULL,
  category public.enum_cash_flows_category NOT NULL,
  description varchar(255) NOT NULL,
  amount numeric(10,2) NOT NULL,
  "appointmentId" integer,
  "expenseId" integer,
  date date NOT NULL,
  notes text,
  "createdBy" varchar(255),
  "createdAt" timestamptz,
  "updatedAt" timestamptz
);

CREATE TABLE IF NOT EXISTS public.commissions (
  id integer GENERATED BY DEFAULT AS IDENTITY,
  "barberId" integer NOT NULL,
  "serviceTypeId" integer NOT NULL,
  percentage numeric(5,2) DEFAULT 50 NOT NULL,
  "fixedAmount" numeric(10,2),
  type public.enum_commissions_type DEFAULT 'percentage'::public.enum_commissions_type,
  "isActive" boolean DEFAULT true,
  "startDate" timestamptz,
  "endDate" timestamptz,
  notes text,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
);

CREATE TABLE IF NOT EXISTS public.google_calendar_sync_tokens (
  id integer GENERATED BY DEFAULT AS IDENTITY,
  "barberId" integer NOT NULL,
  "calendarId" varchar(255) NOT NULL,
  "syncToken" text NOT NULL,
  "resourceType" varchar(255) DEFAULT 'events'::varchar,
  "expiresAt" timestamptz,
  "isActive" boolean DEFAULT true,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS public.message_logs (
  id integer GENERATED BY DEFAULT AS IDENTITY,
  "appointmentId" integer NOT NULL,
  "templateId" integer NOT NULL,
  "clientPhone" varchar(255) NOT NULL,
  "messageContent" text NOT NULL,
  platform public.enum_message_logs_platform DEFAULT 'whatsapp'::public.enum_message_logs_platform,
  status public.enum_message_logs_status DEFAULT 'pending'::public.enum_message_logs_status,
  "scheduledFor" timestamptz NOT NULL,
  "sentAt" timestamptz,
  "errorMessage" text,
  attempts integer DEFAULT 0,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
);

CREATE TABLE IF NOT EXISTS public."GoogleCalendarConflicts" (
  id integer GENERATED BY DEFAULT AS IDENTITY,
  "barberId" integer NOT NULL,
  "appointmentId" integer NOT NULL,
  "googleEventId" varchar(255),
  "conflictType" varchar(255) NOT NULL,
  "localData" jsonb NOT NULL,
  "googleData" jsonb NOT NULL,
  "resolutionStrategy" varchar(255),
  "resolvedAt" timestamptz,
  "resolvedBy" integer,
  "resolutionNotes" text,
  status varchar(255) DEFAULT 'pending'::varchar,
  "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."GoogleCalendarSyncLogs" (
  id integer GENERATED BY DEFAULT AS IDENTITY,
  "barberId" integer NOT NULL,
  "appointmentId" integer,
  "operationType" varchar(255) NOT NULL,
  direction varchar(255) NOT NULL,
  status varchar(255) NOT NULL,
  "googleEventId" varchar(255),
  "googleCalendarId" varchar(255),
  "errorMessage" text,
  "dataBefore" jsonb,
  "dataAfter" jsonb,
  "syncDurationMs" integer,
  "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."GoogleCalendarWebhooks" (
  id integer GENERATED BY DEFAULT AS IDENTITY,
  "barberId" integer NOT NULL,
  "calendarId" varchar(255) NOT NULL,
  "channelId" varchar(255) NOT NULL,
  "resourceId" varchar(255),
  "resourceUri" text,
  "webhookUrl" text,
  "channelToken" varchar(255),
  "expiresAt" timestamptz,
  "lastNotification" timestamptz,
  "notificationCount" integer DEFAULT 0,
  status varchar(255) DEFAULT 'active'::varchar,
  "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION public._schema_add_constraint(
  target_table regclass,
  constraint_name text,
  constraint_sql text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = target_table
      AND conname = constraint_name
  ) THEN
    EXECUTE constraint_sql;
  END IF;
END $$;

SELECT public._schema_add_constraint('public."GoogleCalendarConflicts"'::regclass, 'GoogleCalendarConflicts_pkey', 'ALTER TABLE public."GoogleCalendarConflicts" ADD CONSTRAINT "GoogleCalendarConflicts_pkey" PRIMARY KEY (id)');
SELECT public._schema_add_constraint('public."GoogleCalendarSyncLogs"'::regclass, 'GoogleCalendarSyncLogs_pkey', 'ALTER TABLE public."GoogleCalendarSyncLogs" ADD CONSTRAINT "GoogleCalendarSyncLogs_pkey" PRIMARY KEY (id)');
SELECT public._schema_add_constraint('public."GoogleCalendarWebhooks"'::regclass, 'GoogleCalendarWebhooks_pkey', 'ALTER TABLE public."GoogleCalendarWebhooks" ADD CONSTRAINT "GoogleCalendarWebhooks_pkey" PRIMARY KEY (id)');
SELECT public._schema_add_constraint('public."GoogleCalendarWebhooks"'::regclass, 'GoogleCalendarWebhooks_channelId_key', 'ALTER TABLE public."GoogleCalendarWebhooks" ADD CONSTRAINT "GoogleCalendarWebhooks_channelId_key" UNIQUE ("channelId")');
SELECT public._schema_add_constraint('public."GoogleCalendarWebhooks"'::regclass, 'uniq_webhook_barber_calendar', 'ALTER TABLE public."GoogleCalendarWebhooks" ADD CONSTRAINT uniq_webhook_barber_calendar UNIQUE ("barberId", "calendarId")');
SELECT public._schema_add_constraint('public."SequelizeMeta"'::regclass, 'SequelizeMeta_pkey', 'ALTER TABLE public."SequelizeMeta" ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name)');
SELECT public._schema_add_constraint('public."Sessions"'::regclass, 'Sessions_pkey', 'ALTER TABLE public."Sessions" ADD CONSTRAINT "Sessions_pkey" PRIMARY KEY (sid)');
SELECT public._schema_add_constraint('public.sessions'::regclass, 'sessions_pkey', 'ALTER TABLE public.sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid)');
SELECT public._schema_add_constraint('public."VerificationCodes"'::regclass, 'VerificationCodes_pkey', 'ALTER TABLE public."VerificationCodes" ADD CONSTRAINT "VerificationCodes_pkey" PRIMARY KEY (id)');
SELECT public._schema_add_constraint('public.clients'::regclass, 'clients_pkey', 'ALTER TABLE public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id)');
SELECT public._schema_add_constraint('public.barbers'::regclass, 'barbers_pkey', 'ALTER TABLE public.barbers ADD CONSTRAINT barbers_pkey PRIMARY KEY (id)');
SELECT public._schema_add_constraint('public.barbers'::regclass, 'barbers_cpf_key', 'ALTER TABLE public.barbers ADD CONSTRAINT barbers_cpf_key UNIQUE (cpf)');
SELECT public._schema_add_constraint('public.service_types'::regclass, 'service_types_pkey', 'ALTER TABLE public.service_types ADD CONSTRAINT service_types_pkey PRIMARY KEY (id)');
SELECT public._schema_add_constraint('public.users'::regclass, 'users_pkey', 'ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id)');
SELECT public._schema_add_constraint('public.users'::regclass, 'users_username_key', 'ALTER TABLE public.users ADD CONSTRAINT users_username_key UNIQUE (username)');
SELECT public._schema_add_constraint('public.users'::regclass, 'users_email_key', 'ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email)');
SELECT public._schema_add_constraint('public.system_configs'::regclass, 'system_configs_pkey', 'ALTER TABLE public.system_configs ADD CONSTRAINT system_configs_pkey PRIMARY KEY (key)');
SELECT public._schema_add_constraint('public.fixed_expenses'::regclass, 'fixed_expenses_pkey', 'ALTER TABLE public.fixed_expenses ADD CONSTRAINT fixed_expenses_pkey PRIMARY KEY (id)');
SELECT public._schema_add_constraint('public.message_templates'::regclass, 'message_templates_pkey', 'ALTER TABLE public.message_templates ADD CONSTRAINT message_templates_pkey PRIMARY KEY (id)');
SELECT public._schema_add_constraint('public.appointments'::regclass, 'appointments_pkey', 'ALTER TABLE public.appointments ADD CONSTRAINT appointments_pkey PRIMARY KEY (id)');
SELECT public._schema_add_constraint('public.appointment_services'::regclass, 'appointment_services_pkey', 'ALTER TABLE public.appointment_services ADD CONSTRAINT appointment_services_pkey PRIMARY KEY (id)');
SELECT public._schema_add_constraint('public.appointment_services'::regclass, 'appointment_services_appointmentId_serviceTypeId_key', 'ALTER TABLE public.appointment_services ADD CONSTRAINT "appointment_services_appointmentId_serviceTypeId_key" UNIQUE ("appointmentId", "serviceTypeId")');
SELECT public._schema_add_constraint('public.cash_flows'::regclass, 'cash_flows_pkey', 'ALTER TABLE public.cash_flows ADD CONSTRAINT cash_flows_pkey PRIMARY KEY (id)');
SELECT public._schema_add_constraint('public.commissions'::regclass, 'commissions_pkey', 'ALTER TABLE public.commissions ADD CONSTRAINT commissions_pkey PRIMARY KEY (id)');
SELECT public._schema_add_constraint('public.google_calendar_sync_tokens'::regclass, 'google_calendar_sync_tokens_pkey', 'ALTER TABLE public.google_calendar_sync_tokens ADD CONSTRAINT google_calendar_sync_tokens_pkey PRIMARY KEY (id)');
SELECT public._schema_add_constraint('public.google_calendar_sync_tokens'::regclass, 'unique_barber_calendar_resource', 'ALTER TABLE public.google_calendar_sync_tokens ADD CONSTRAINT unique_barber_calendar_resource UNIQUE ("barberId", "calendarId", "resourceType")');
SELECT public._schema_add_constraint('public.message_logs'::regclass, 'message_logs_pkey', 'ALTER TABLE public.message_logs ADD CONSTRAINT message_logs_pkey PRIMARY KEY (id)');

SELECT public._schema_add_constraint('public."GoogleCalendarConflicts"'::regclass, 'GoogleCalendarConflicts_appointmentId_fkey', 'ALTER TABLE public."GoogleCalendarConflicts" ADD CONSTRAINT "GoogleCalendarConflicts_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES public.appointments(id) ON DELETE CASCADE');
SELECT public._schema_add_constraint('public."GoogleCalendarConflicts"'::regclass, 'GoogleCalendarConflicts_barberId_fkey', 'ALTER TABLE public."GoogleCalendarConflicts" ADD CONSTRAINT "GoogleCalendarConflicts_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES public.barbers(id) ON DELETE CASCADE');
SELECT public._schema_add_constraint('public."GoogleCalendarConflicts"'::regclass, 'GoogleCalendarConflicts_resolvedBy_fkey', 'ALTER TABLE public."GoogleCalendarConflicts" ADD CONSTRAINT "GoogleCalendarConflicts_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES public.users(id) ON DELETE SET NULL');
SELECT public._schema_add_constraint('public."GoogleCalendarSyncLogs"'::regclass, 'GoogleCalendarSyncLogs_appointmentId_fkey', 'ALTER TABLE public."GoogleCalendarSyncLogs" ADD CONSTRAINT "GoogleCalendarSyncLogs_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES public.appointments(id) ON DELETE SET NULL');
SELECT public._schema_add_constraint('public."GoogleCalendarSyncLogs"'::regclass, 'GoogleCalendarSyncLogs_barberId_fkey', 'ALTER TABLE public."GoogleCalendarSyncLogs" ADD CONSTRAINT "GoogleCalendarSyncLogs_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES public.barbers(id) ON DELETE CASCADE');
SELECT public._schema_add_constraint('public."GoogleCalendarWebhooks"'::regclass, 'GoogleCalendarWebhooks_barberId_fkey', 'ALTER TABLE public."GoogleCalendarWebhooks" ADD CONSTRAINT "GoogleCalendarWebhooks_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES public.barbers(id) ON DELETE CASCADE');
SELECT public._schema_add_constraint('public.appointment_services'::regclass, 'appointment_services_serviceTypeId_fkey', 'ALTER TABLE public.appointment_services ADD CONSTRAINT "appointment_services_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES public.service_types(id) ON UPDATE CASCADE ON DELETE CASCADE');
SELECT public._schema_add_constraint('public.appointments'::regclass, 'appointments_barberId_fkey', 'ALTER TABLE public.appointments ADD CONSTRAINT "appointments_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES public.barbers(id) ON UPDATE CASCADE ON DELETE RESTRICT');
SELECT public._schema_add_constraint('public.appointments'::regclass, 'appointments_clientId_fkey', 'ALTER TABLE public.appointments ADD CONSTRAINT "appointments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public.clients(id) ON UPDATE CASCADE ON DELETE CASCADE');
SELECT public._schema_add_constraint('public.appointments'::regclass, 'appointments_serviceTypeId_fkey', 'ALTER TABLE public.appointments ADD CONSTRAINT "appointments_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES public.service_types(id) ON UPDATE CASCADE ON DELETE RESTRICT');
SELECT public._schema_add_constraint('public.cash_flows'::regclass, 'cash_flows_appointmentId_fkey', 'ALTER TABLE public.cash_flows ADD CONSTRAINT "cash_flows_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES public.appointments(id) ON UPDATE CASCADE ON DELETE SET NULL');
SELECT public._schema_add_constraint('public.cash_flows'::regclass, 'cash_flows_expenseId_fkey', 'ALTER TABLE public.cash_flows ADD CONSTRAINT "cash_flows_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES public.fixed_expenses(id) ON UPDATE CASCADE ON DELETE SET NULL');
SELECT public._schema_add_constraint('public.commissions'::regclass, 'commissions_serviceTypeId_fkey', 'ALTER TABLE public.commissions ADD CONSTRAINT "commissions_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES public.service_types(id) ON UPDATE CASCADE ON DELETE CASCADE');
SELECT public._schema_add_constraint('public.google_calendar_sync_tokens'::regclass, 'google_calendar_sync_tokens_barberId_fkey', 'ALTER TABLE public.google_calendar_sync_tokens ADD CONSTRAINT "google_calendar_sync_tokens_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES public.barbers(id) ON DELETE CASCADE');
SELECT public._schema_add_constraint('public.message_logs'::regclass, 'message_logs_appointmentId_fkey', 'ALTER TABLE public.message_logs ADD CONSTRAINT "message_logs_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES public.appointments(id) ON UPDATE CASCADE ON DELETE CASCADE');
SELECT public._schema_add_constraint('public.message_logs'::regclass, 'message_logs_templateId_fkey', 'ALTER TABLE public.message_logs ADD CONSTRAINT "message_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public.message_templates(id) ON UPDATE CASCADE ON DELETE CASCADE');

DROP FUNCTION public._schema_add_constraint(regclass, text, text);

CREATE UNIQUE INDEX IF NOT EXISTS appointment_services_appointment_id_service_type_id
  ON public.appointment_services ("appointmentId", "serviceTypeId");
CREATE INDEX IF NOT EXISTS cash_flows_appointment_id
  ON public.cash_flows ("appointmentId");
CREATE INDEX IF NOT EXISTS cash_flows_category
  ON public.cash_flows (category);
CREATE INDEX IF NOT EXISTS cash_flows_date_type
  ON public.cash_flows (date, type);
CREATE INDEX IF NOT EXISTS commissions_is_active
  ON public.commissions ("isActive");
CREATE UNIQUE INDEX IF NOT EXISTS unique_barber_service_commission
  ON public.commissions ("barberId", "serviceTypeId");
CREATE INDEX IF NOT EXISTS fixed_expenses_category
  ON public.fixed_expenses (category);
CREATE INDEX IF NOT EXISTS fixed_expenses_frequency_due_day
  ON public.fixed_expenses (frequency, "dueDay");
CREATE INDEX IF NOT EXISTS fixed_expenses_is_active
  ON public.fixed_expenses ("isActive");
CREATE INDEX IF NOT EXISTS google_calendar_sync_tokens_barber_id_calendar_id
  ON public.google_calendar_sync_tokens ("barberId", "calendarId");
CREATE INDEX IF NOT EXISTS google_calendar_sync_tokens_is_active
  ON public.google_calendar_sync_tokens ("isActive");
CREATE INDEX IF NOT EXISTS google_calendar_webhooks_expires_at
  ON public."GoogleCalendarWebhooks" ("expiresAt");
CREATE INDEX IF NOT EXISTS google_calendar_webhooks_status
  ON public."GoogleCalendarWebhooks" (status);
CREATE INDEX IF NOT EXISTS idx_appointments_barber_date
  ON public.appointments ("barberId", "appointmentDate");
CREATE INDEX IF NOT EXISTS idx_appointments_status
  ON public.appointments (status);
CREATE INDEX IF NOT EXISTS idx_conflicts_barber_status
  ON public."GoogleCalendarConflicts" ("barberId", status);
CREATE INDEX IF NOT EXISTS idx_conflicts_created
  ON public."GoogleCalendarConflicts" ("createdAt");
CREATE INDEX IF NOT EXISTS idx_sync_logs_barber_date
  ON public."GoogleCalendarSyncLogs" ("barberId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_sync_logs_operation
  ON public."GoogleCalendarSyncLogs" ("operationType");
CREATE INDEX IF NOT EXISTS idx_sync_logs_status
  ON public."GoogleCalendarSyncLogs" (status);
CREATE INDEX IF NOT EXISTS message_logs_appointment_id
  ON public.message_logs ("appointmentId");
CREATE INDEX IF NOT EXISTS message_logs_platform_status
  ON public.message_logs (platform, status);
CREATE INDEX IF NOT EXISTS message_logs_status_scheduled_for
  ON public.message_logs (status, "scheduledFor");
CREATE INDEX IF NOT EXISTS message_templates_type_is_active
  ON public.message_templates (type, "isActive");

DO $$
DECLARE
  existing_definition text;
BEGIN
  SELECT pg_get_indexdef(indexrelid)
  INTO existing_definition
  FROM pg_index
  WHERE indexrelid = 'public.uq_appointments_regular_slot'::regclass;

  IF existing_definition IS NULL THEN
    CREATE UNIQUE INDEX uq_appointments_regular_slot
      ON public.appointments ("barberId", "appointmentDate", "appointmentTime")
      WHERE "isEncaixe" = false
        AND "isBlock" = false
        AND status <> ALL (ARRAY['cancelled'::public.enum_appointments_status, 'no_show'::public.enum_appointments_status]);
  ELSIF existing_definition NOT LIKE '%"isBlock" = false%' THEN
    DROP INDEX public.uq_appointments_regular_slot;
    CREATE UNIQUE INDEX uq_appointments_regular_slot
      ON public.appointments ("barberId", "appointmentDate", "appointmentTime")
      WHERE "isEncaixe" = false
        AND "isBlock" = false
        AND status <> ALL (ARRAY['cancelled'::public.enum_appointments_status, 'no_show'::public.enum_appointments_status]);
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    CREATE UNIQUE INDEX uq_appointments_regular_slot
      ON public.appointments ("barberId", "appointmentDate", "appointmentTime")
      WHERE "isEncaixe" = false
        AND "isBlock" = false
        AND status <> ALL (ARRAY['cancelled'::public.enum_appointments_status, 'no_show'::public.enum_appointments_status]);
END $$;
