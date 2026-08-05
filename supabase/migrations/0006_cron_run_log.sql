-- Log de cada execução do check-alarms, para diagnosticar paradas silenciosas
-- do pipeline de notificações (ex: credenciais HI Tecnologia vencidas, API fora do ar).
create table if not exists cron_run_log (
  id bigint generated always as identity primary key,
  run_at timestamptz not null default now(),
  status text not null, -- 'ok' | 'skipped' | 'error'
  detail text
);

create index if not exists cron_run_log_run_at_idx on cron_run_log (run_at desc);

alter table cron_run_log enable row level security;
-- Sem policies para authenticated: só a service role (usada pela edge function) acessa.
