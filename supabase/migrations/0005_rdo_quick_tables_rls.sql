-- Corrige "new row violates row-level security policy for table
-- rdo_quick_tables": RLS ficou habilitado nas tabelas novas (0002) sem
-- nenhuma politica, o que bloqueia toda escrita/leitura por padrao no
-- Postgres. Libera para qualquer usuario autenticado, mesmo padrao de
-- acesso de um app interno single-tenant (sem particionamento por empresa).

alter table rdo_quick_tables enable row level security;
alter table rdo_table_templates enable row level security;

drop policy if exists "authenticated_full_access" on rdo_quick_tables;
create policy "authenticated_full_access"
  on rdo_quick_tables
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated_full_access" on rdo_table_templates;
create policy "authenticated_full_access"
  on rdo_table_templates
  for all
  to authenticated
  using (true)
  with check (true);
