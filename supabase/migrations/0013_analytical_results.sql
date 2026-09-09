-- Resultados analíticos de laboratório (concentração de contaminante por
-- ponto amostrado) — base de dados pra depois desenhar as plumas de
-- contaminação no Mapa Geral (ver docs/CONTROLE_DOCUMENTOS.md, "Fase 2").
--
-- Ancorado em soil_descriptions.id (o mesmo poço/sondagem já plotado no
-- mapa) em vez de water_samplings: o boletim de laboratório chega semanas
-- depois da coleta e cobre tanto água subterrânea quanto solo, enquanto
-- water_samplings é só leitura de campo (pH/ORP/OD) durante a purga do
-- poço — dado de natureza e timing diferentes.
--
-- Um "lançamento" no app corresponde a um boletim (1 poço + 1 data de
-- coleta + N contaminantes); aqui cada contaminante fica em uma linha
-- própria pra facilitar consulta/agregação por analito nas plumas depois.
create table if not exists analytical_results (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  soil_description_id uuid not null references soil_descriptions(id) on delete cascade,
  matriz text not null default 'agua_subterranea' check (matriz in ('agua_subterranea', 'solo')),
  data_coleta date not null,
  profundidade_m numeric,
  contaminante text not null,
  concentracao numeric not null,
  unidade text not null default 'µg/L',
  -- Valor de referência regulatório (ex.: Valor de Intervenção CETESB) pro
  -- mesmo contaminante/matriz — permite já marcar excedência sem esperar a
  -- etapa de plumas. Preenchido manualmente por lançamento (não existe
  -- tabela de valores oficiais no sistema ainda) — cada lançamento registra
  -- também de onde tirou o número.
  vmp numeric,
  vmp_fonte text,
  observacoes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_analytical_results_soil_description_id on analytical_results (soil_description_id);
create index if not exists idx_analytical_results_project_data on analytical_results (project_id, data_coleta);

alter table analytical_results enable row level security;

drop policy if exists "authenticated_full_access" on analytical_results;
create policy "authenticated_full_access"
  on analytical_results
  for all
  to authenticated
  using (true)
  with check (true);
