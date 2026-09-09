-- Direção do fluxo de água subterrânea, por rodada de amostragem — usada
-- pra alongar a interpolação IDW da pluma na direção real do fluxo em vez
-- de espalhar em círculo (isotrópico). Ver lib/geo/plume.ts.
--
-- A direção não é digitada em graus: o usuário desenha uma seta sobre o
-- próprio mapa (dois pontos, origem e ponta), olhando pro mapa/relatório
-- que o cliente já manda pronto — ninguém sabe de cabeça que uma seta
-- aponta "135°". Guardamos os dois pontos (em UTM, mesmo referencial dos
-- poços) pra poder redesenhar a seta ajustável da próxima vez, e o grau já
-- calculado pra não recalcular toda hora.
--
-- Chave por (project_id, rodada) — "rodada" é o mesmo texto usado em
-- analytical_results (campanha, ou a data de coleta quando não há
-- campanha nomeada) — não uma FK, porque "rodada" é um agrupamento lógico
-- calculado em código, não uma entidade com id próprio no banco ainda.
create table if not exists groundwater_flow_directions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  rodada text not null,
  origem_x numeric not null,
  origem_y numeric not null,
  ponta_x numeric not null,
  ponta_y numeric not null,
  utm_zona text not null,
  direcao_graus numeric not null,
  razao_anisotropia numeric not null default 2.5,
  mapa_referencia_url text,
  mapa_referencia_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, rodada)
);

create index if not exists idx_groundwater_flow_directions_project on groundwater_flow_directions (project_id, rodada);

alter table groundwater_flow_directions enable row level security;

drop policy if exists "authenticated_full_access" on groundwater_flow_directions;
create policy "authenticated_full_access"
  on groundwater_flow_directions
  for all
  to authenticated
  using (true)
  with check (true);
