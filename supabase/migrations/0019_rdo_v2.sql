-- RDO simplificado (formato "v2").
--
-- Aditiva e não-destrutiva: RDOs antigos continuam exatamente como estão
-- (formato 'v1', gerador de PDF e telas antigas). Só os RDOs criados daqui
-- pra frente nascem como 'v2'.
--
-- Aplicar manualmente no SQL Editor do Supabase. Depois rodar
-- scripts/rdo_instrumentos_seed.sql pra carregar os instrumentos dos projetos.

-- ── Configuração por projeto ────────────────────────────────────────────────

-- Instrumentos de leitura (hidrômetros, medidores de pressão etc.).
--   acumulado   -> totalizador (FM, hidrômetro): volume do dia = leitura − anterior
--   instantaneo -> valor direto (pressão, %, vazão, sensores)
--   estoque     -> nível de tanque (Volume IBC): consumo = anterior − atual;
--                  se subir, é reabastecimento
create table if not exists rdo_instrumentos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  grupo text not null default 'Geral',
  nome text not null,
  tipo text not null default 'instantaneo'
    check (tipo in ('acumulado', 'instantaneo', 'estoque')),
  unidade text not null default '',
  instrucao text,
  ordem int not null default 0,
  ativo boolean not null default true,
  -- O instrumento só aparece nos RDOs com data >= vigente_desde.
  vigente_desde date not null default current_date,
  created_at timestamptz not null default now(),
  unique (project_id, nome)
);

create index if not exists idx_rdo_instrumentos_project
  on rdo_instrumentos (project_id, ordem);

-- Atividades fixas do projeto (interruptor Sim/Não "Realizado" em cada RDO).
create table if not exists rdo_atividades_fixas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, nome)
);

create index if not exists idx_rdo_atividades_fixas_project
  on rdo_atividades_fixas (project_id, ordem);

-- Equipe do projeto (nomes cadastrados que podem ser responsáveis).
create table if not exists rdo_equipe (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, nome)
);

create index if not exists idx_rdo_equipe_project
  on rdo_equipe (project_id);

alter table rdo_instrumentos enable row level security;
alter table rdo_atividades_fixas enable row level security;
alter table rdo_equipe enable row level security;

drop policy if exists "authenticated_full_access" on rdo_instrumentos;
create policy "authenticated_full_access" on rdo_instrumentos
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on rdo_atividades_fixas;
create policy "authenticated_full_access" on rdo_atividades_fixas
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on rdo_equipe;
create policy "authenticated_full_access" on rdo_equipe
  for all to authenticated using (true) with check (true);

-- ── Campos novos no RDO ─────────────────────────────────────────────────────

alter table rdo_reports
  add column if not exists formato text not null default 'v1'
    check (formato in ('v1', 'v2')),
  -- [{instrumento_id, grupo, nome, tipo, unidade, instrucao, valor, nao_coletado}]
  -- Snapshot do instrumento no momento do preenchimento (renomear/desativar
  -- depois não altera RDOs antigos). valor null = não coletado (≠ 0).
  add column if not exists leituras jsonb not null default '[]'::jsonb,
  -- [{id, nome, realizado, obs}]
  add column if not exists atividades_fixas jsonb not null default '[]'::jsonb,
  -- ["Fulano", "Ciclano"] — equipe presente em campo no dia
  add column if not exists equipe jsonb not null default '[]'::jsonb,
  -- {houve: boolean, descricao: text}
  add column if not exists ocorrencias jsonb not null default '{"houve": false, "descricao": ""}'::jsonb;

-- Quem preencheu (entra automático no cabeçalho do RDO novo).
alter table rdo_reports
  add column if not exists preenchido_por text;

create index if not exists idx_rdo_reports_project_formato_data
  on rdo_reports (project_id, formato, data);
