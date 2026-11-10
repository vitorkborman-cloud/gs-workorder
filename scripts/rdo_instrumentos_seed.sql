-- Carga inicial dos instrumentos do RDO simplificado, a partir das anotações
-- de campo. Rodar DEPOIS da migration 0019_rdo_v2.sql. Idempotente
-- (unique project_id+nome + on conflict do nothing) — dá pra rodar de novo
-- sem duplicar.
--
-- Projetos são localizados pelo código no início do nome ("40398, Nome...").
-- Não incluídos por enquanto: Ecopro 40313, Niterra 40344, Formitex 40176,
-- São Luís 40183, Siemens Fastline 40445.
--
-- Unidades: FM = m³ (acumulado) · PT/pressões = bar · % dosadora = % ·
-- Volume IBC = litros (estoque) · AF, FS, fluxo de ar, flowmeter SVE = m³/h ·
-- O₂ e LEL = % · VOC = ppm.
--
-- Pendências de confirmação:
--   - 40404: hidrômetros ainda sem nome (serão o poço a que se conectam) —
--     cadastrar na tela de configuração do projeto quando existirem.
--   - 40106: PT-181 estava com dúvida na anotação, entra INATIVO.
--   - 40404: "Volume IBC Nutrientes" estava com dúvida de leitura.

with defs(codigo, grupo, nome, tipo, unidade, instrucao, ordem, ativo) as (
  values
  -- ── 40398 ──────────────────────────────────────────────────────────────
  ('40398', 'Fluxômetros', 'FM-101', 'acumulado', 'm³', null, 10, true),
  ('40398', 'Fluxômetros', 'FM-301', 'acumulado', 'm³', null, 20, true),
  ('40398', 'Fluxômetros', 'FM-201', 'acumulado', 'm³', null, 30, true),
  ('40398', 'Fluxômetros', 'FM-302', 'acumulado', 'm³', null, 40, true),
  ('40398', 'Pressão', 'PT-102', 'instantaneo', 'bar', null, 50, true),
  ('40398', 'Pressão', 'PT-104', 'instantaneo', 'bar', null, 60, true),
  ('40398', 'Pressão', 'PT-202', 'instantaneo', 'bar', null, 70, true),
  ('40398', 'Pressão', 'PT-204', 'instantaneo', 'bar', null, 80, true),
  ('40398', 'Dosagem', '% Dosadora', 'instantaneo', '%', null, 90, true),
  ('40398', 'Dosagem', 'Volume IBC Dehalo', 'estoque', 'L', null, 100, true),

  -- ── 40404 ──────────────────────────────────────────────────────────────
  ('40404', 'Fluxômetros', 'FM-101', 'acumulado', 'm³', null, 10, true),
  ('40404', 'Pressão', 'PT-201', 'instantaneo', 'bar', null, 50, true),
  ('40404', 'Pressão', 'PT-301', 'instantaneo', 'bar', null, 60, true),
  ('40404', 'Dosagem', '% Dosadora', 'instantaneo', '%', null, 90, true),
  ('40404', 'Dosagem', 'Volume IBC Nutrientes', 'estoque', 'L', null, 100, true),
  ('40404', 'Dosagem', 'Volume IBC Fase Livre', 'estoque', 'L', null, 110, true),

  -- ── 40356 ──────────────────────────────────────────────────────────────
  ('40356', 'Fluxômetros', 'FM-101', 'acumulado', 'm³', null, 10, true),
  ('40356', 'Fluxômetros', 'FM-201', 'acumulado', 'm³', null, 20, true),
  ('40356', 'Fluxômetros', 'FM-301', 'acumulado', 'm³', null, 30, true),
  ('40356', 'Fluxômetros', 'FM-302', 'acumulado', 'm³', null, 40, true),
  ('40356', 'Pressão', 'PT-121', 'instantaneo', 'bar', null, 50, true),
  ('40356', 'Pressão', 'PT-131', 'instantaneo', 'bar', null, 60, true),
  ('40356', 'Pressão', 'PT-221', 'instantaneo', 'bar', null, 70, true),
  ('40356', 'Pressão', 'PT-231', 'instantaneo', 'bar', null, 80, true),
  ('40356', 'Dosagem', '% Dosadora', 'instantaneo', '%', null, 90, true),
  ('40356', 'Dosagem', 'Volume IBC Disponível', 'estoque', 'L', null, 100, true),

  -- ── 40372 ──────────────────────────────────────────────────────────────
  ('40372', 'Fluxômetros', 'FM-101', 'acumulado', 'm³', null, 10, true),
  ('40372', 'Pressão', 'Pressão Bombas', 'instantaneo', 'bar', null, 50, true),
  ('40372', 'Pressão', 'Pressão Biosparging', 'instantaneo', 'bar', null, 60, true),
  ('40372', 'Dosagem', '% Dosadora', 'instantaneo', '%', null, 90, true),
  ('40372', 'Dosagem', 'Volume IBC', 'estoque', 'L', null, 100, true),
  ('40372', 'Vazão de ar', 'AF-1', 'instantaneo', 'm³/h', null, 120, true),
  ('40372', 'Vazão de ar', 'AF-2', 'instantaneo', 'm³/h', null, 130, true),
  ('40372', 'Vazão de ar', 'AF-3', 'instantaneo', 'm³/h', null, 140, true),
  ('40372', 'Vazão de ar', 'AF-4', 'instantaneo', 'm³/h', null, 150, true),
  ('40372', 'Vazão de ar', 'AF-5', 'instantaneo', 'm³/h', null, 160, true),

  -- ── 40373 ──────────────────────────────────────────────────────────────
  ('40373', 'Fluxômetros', 'FM-101', 'acumulado', 'm³', null, 10, true),
  ('40373', 'Fluxômetros', 'FM-131', 'acumulado', 'm³', null, 20, true),
  ('40373', 'Pressão', 'PT-121', 'instantaneo', 'bar', null, 50, true),
  ('40373', 'Pressão', 'PT-122', 'instantaneo', 'bar', null, 60, true),
  ('40373', 'Pressão', 'PT-301', 'instantaneo', 'bar', null, 70, true),
  ('40373', 'Pressão', 'PT-201', 'instantaneo', 'bar', null, 80, true),
  ('40373', 'Pressão', 'Pressão das Bombas', 'instantaneo', 'bar', null, 85, true),
  ('40373', 'Vazão de ar', 'FS-201', 'instantaneo', 'm³/h', null, 120, true),
  ('40373', 'Vazão de ar', 'Flowmeter SVE', 'instantaneo', 'm³/h', null, 130, true),
  ('40373', 'Dosagem', '% Dosadora', 'instantaneo', '%', null, 90, true),
  ('40373', 'Dosagem', 'Volume IBC Dehalo', 'estoque', 'L', null, 100, true),

  -- ── 40106 (pressões: coletar somente com a bomba ligada) ───────────────
  ('40106', 'Fluxômetros', 'FM-151', 'acumulado', 'm³', null, 10, true),
  ('40106', 'Fluxômetros', 'FM-251', 'acumulado', 'm³', null, 20, true),
  ('40106', 'Fluxômetros', 'FM-331', 'acumulado', 'm³', null, 30, true),
  ('40106', 'Fluxômetros', 'FM-332', 'acumulado', 'm³', null, 40, true),
  ('40106', 'Pressão', 'PT-141', 'instantaneo', 'bar', 'Coletar somente com a bomba em funcionamento. Desligada: marcar "não coletado".', 50, true),
  ('40106', 'Pressão', 'PT-161', 'instantaneo', 'bar', 'Coletar somente com a bomba em funcionamento. Desligada: marcar "não coletado".', 60, true),
  ('40106', 'Pressão', 'PT-241', 'instantaneo', 'bar', 'Coletar somente com a bomba em funcionamento. Desligada: marcar "não coletado".', 70, true),
  ('40106', 'Pressão', 'PT-261', 'instantaneo', 'bar', 'Coletar somente com a bomba em funcionamento. Desligada: marcar "não coletado".', 80, true),
  ('40106', 'Pressão', 'PT-281', 'instantaneo', 'bar', 'Coletar somente com a bomba em funcionamento. Desligada: marcar "não coletado".', 85, true),
  ('40106', 'Pressão', 'PT-181', 'instantaneo', 'bar', 'Coletar somente com a bomba em funcionamento. Desligada: marcar "não coletado".', 88, false),
  ('40106', 'Dosagem', '% Bomba Dosadora', 'instantaneo', '%', null, 90, true),
  ('40106', 'Dosagem', 'Volume IBC Dosagem', 'estoque', 'L', null, 100, true),

  -- ── 40153 (Braskem) ────────────────────────────────────────────────────
  ('40153', 'Fluxômetros', 'FM-101', 'acumulado', 'm³', null, 10, true),
  ('40153', 'Fluxômetros', 'FM-111', 'acumulado', 'm³', null, 20, true),
  ('40153', 'Fluxômetros', 'FM-121', 'acumulado', 'm³', null, 30, true),
  ('40153', 'Sensores', 'Sensor O₂', 'instantaneo', '%', null, 50, true),
  ('40153', 'Sensores', 'Sensor VOC', 'instantaneo', 'ppm', null, 60, true),
  ('40153', 'Sensores', 'Sensor LEL', 'instantaneo', '%', null, 70, true),
  ('40153', 'Pressão', 'PT-201', 'instantaneo', 'bar', null, 80, true),
  ('40153', 'Pressão', 'PT-202', 'instantaneo', 'bar', null, 90, true),
  ('40153', 'Vazão de ar', 'Fluxo de ar', 'instantaneo', 'm³/h', null, 120, true),

  -- ── 40143 ──────────────────────────────────────────────────────────────
  ('40143', 'Fluxômetros', 'FM-101', 'acumulado', 'm³', null, 10, true),
  ('40143', 'Fluxômetros', 'FM-102', 'acumulado', 'm³', null, 20, true),
  ('40143', 'Fluxômetros', 'FM-203', 'acumulado', 'm³', null, 30, true),
  ('40143', 'Dosagem', '% Dosadora', 'instantaneo', '%', null, 90, true),
  ('40143', 'Dosagem', 'Volume IBC Dehalo', 'estoque', 'L', null, 100, true),

  -- ── 40182 ──────────────────────────────────────────────────────────────
  ('40182', 'Vazão de ar', 'AF-1', 'instantaneo', 'm³/h', null, 10, true),
  ('40182', 'Vazão de ar', 'AF-2', 'instantaneo', 'm³/h', null, 20, true),
  ('40182', 'Vazão de ar', 'AF-3', 'instantaneo', 'm³/h', null, 30, true),
  ('40182', 'Vazão de ar', 'AF-4', 'instantaneo', 'm³/h', null, 40, true),
  ('40182', 'Vazão de ar', 'AF-5', 'instantaneo', 'm³/h', null, 50, true),
  ('40182', 'Pressão', 'Pressão Compressor', 'instantaneo', 'bar', null, 60, true),

  -- ── 40245 ──────────────────────────────────────────────────────────────
  ('40245', 'Fluxômetros', 'FM-101', 'acumulado', 'm³', null, 10, true),
  ('40245', 'Pressão', 'PT-101', 'instantaneo', 'bar', null, 50, true),
  ('40245', 'Dosagem', '% Dosadora', 'instantaneo', '%', null, 90, true),
  ('40245', 'Dosagem', 'Volume IBC Dehalo', 'estoque', 'L', null, 100, true)
)
insert into rdo_instrumentos
  (project_id, grupo, nome, tipo, unidade, instrucao, ordem, ativo, vigente_desde)
select p.id, d.grupo, d.nome, d.tipo, d.unidade, d.instrucao, d.ordem, d.ativo, date '2020-01-01'
from defs d
join projects p on p.name like d.codigo || '%'
on conflict (project_id, nome) do nothing;

-- Confere o que entrou (um projeto por linha).
select p.name, count(*) as instrumentos
from rdo_instrumentos i
join projects p on p.id = i.project_id
group by p.name
order by p.name;
