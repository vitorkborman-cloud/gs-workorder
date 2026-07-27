-- Etapa 2 da reestruturação RDO/Work Order.
-- Introduz o novo ciclo de vida do RDO (programado -> rascunho -> finalizado),
-- substituindo o uso implícito do booleano `draft`. Aditiva e não-destrutiva:
-- `draft` NÃO é removida aqui — o código continua podendo lê-la durante a
-- transição. Aplicar manualmente no SQL Editor do Supabase (ou `supabase db push`).

alter table rdo_reports
  add column if not exists status text not null default 'rascunho'
    check (status in ('programado', 'rascunho', 'finalizado'));

-- Backfill dos registros existentes a partir do booleano atual.
update rdo_reports set status = case when draft = true then 'rascunho' else 'finalizado' end;

-- Campos de agendamento: quem programou o RDO, quando, e para qual data de campo.
alter table rdo_reports
  add column if not exists scheduled_by uuid references auth.users(id),
  add column if not exists scheduled_at timestamptz,
  add column if not exists scheduled_date date;

-- Consulta mais comum do mobile: "existe RDO programado/rascunho para este projeto?"
create index if not exists idx_rdo_reports_project_status
  on rdo_reports (project_id, status, scheduled_date);
