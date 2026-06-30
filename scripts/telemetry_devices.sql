-- Tabela de vínculo entre equipamentos da HI Tecnologia e projetos do gs-workorder
create table if not exists telemetry_devices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  configuration_id text not null,
  reference_id text not null,
  status text default 'unknown', -- 'online' | 'offline' | 'unknown'
  last_reading jsonb,
  last_checked_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_telemetry_devices_project on telemetry_devices(project_id);

alter table telemetry_devices enable row level security;

create policy "Authenticated users can read telemetry_devices"
  on telemetry_devices for select
  to authenticated
  using (true);

-- Tabela de alarmes recebidos (histórico + controle de notificação já enviada)
create table if not exists telemetry_alarms (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references telemetry_devices(id) on delete cascade,
  hitec_alarm_id text not null,
  description text,
  severity text,
  triggered_at timestamptz,
  notified boolean default false,
  created_at timestamptz default now(),
  unique(device_id, hitec_alarm_id)
);

alter table telemetry_alarms enable row level security;

create policy "Authenticated users can read telemetry_alarms"
  on telemetry_alarms for select
  to authenticated
  using (true);

-- Seed: equipamentos de teste já mapeados
insert into telemetry_devices (project_id, name, configuration_id, reference_id, status)
values
  ('abb21f04-b113-4f95-bf8e-0b53b6e6d013', 'Equipamento Taranto', '4393', '40356', 'offline'),
  ('1c55873d-0f40-4eb1-ba10-34c8b6561ea9', 'Equipamento Marelli SP', '4271', '40106', 'unknown'),
  ('44105329-1655-4910-a2aa-351b4c780608', 'Equipamento Vedacit BA', '4066', '40372', 'unknown'),
  ('1dc0d937-0d5c-4bef-a247-ad96b2422891', 'Equipamento Ecopro', '3875', '40313', 'unknown')
on conflict do nothing;
