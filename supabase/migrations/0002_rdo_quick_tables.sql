-- Etapa 2 da reestruturação RDO/Work Order.
-- Sistema de "tabelas rápidas": tabelas ad-hoc que o colaborador cria em campo
-- dentro de um RDO (colunas livres, sem estrutura pré-definida), com um
-- catálogo separado de modelos reutilizáveis entre projetos.

-- Modelos reutilizáveis de estrutura de tabela (catálogo, não pertence a
-- nenhum RDO específico). `colunas` é um snapshot no formato
-- [{ id: string, label: string }].
create table if not exists rdo_table_templates (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  colunas jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Tabelas rápidas de fato, uma ou mais por RDO. `colunas` é copiada do
-- template no momento da criação (não segue o template se ele mudar depois);
-- `linhas` é um array de objetos { "<coluna_id>": valor, ... }.
create table if not exists rdo_quick_tables (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references rdo_reports(id) on delete cascade,
  template_id uuid references rdo_table_templates(id),
  titulo text not null,
  colunas jsonb not null,
  linhas jsonb not null default '[]',
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rdo_quick_tables_rdo_id on rdo_quick_tables (rdo_id);
