-- Adiciona à telemetria os projetos que já tinham conector no portal HI
-- Tecnologia mas ainda não estavam em telemetry_devices:
--   40182, Damasceno  -> configuration_id 4838
--   40245, Aratu      -> configuration_id 4820 (Dow Aratu - RI4023)
--   40404, Brenntag   -> configuration_id 4827 (RI4038)
-- configuration_id = coluna "id" da lista de conectores do portal.
-- reference_id = código do projeto (40XXX). Nome no padrão "40XXX, Nome"
-- (igual ao nome do projeto). dados_id fica null — tela "Dados do Sistema" é
-- opcional, só usada no Modo TV (ver scripts/telemetry_devices_add_dados_id.sql).
--
-- "where not exists" porque telemetry_devices não tem unique em
-- configuration_id: um "on conflict do nothing" não evitaria duplicar se o
-- script rodar duas vezes.

insert into telemetry_devices (project_id, name, configuration_id, reference_id, status)
select v.project_id::uuid, v.name, v.configuration_id, v.reference_id, 'unknown'
from (values
  ('18c90c30-6d08-47d7-82a4-eba4fa784ec9', '40182, Damasceno', '4838', '40182'),
  ('00b62706-dd99-4df5-9695-f64ec98fa0db', '40245, Aratu',     '4820', '40245'),
  ('3bea0ef2-5f0e-40d8-8350-b9a4eedbabda', '40404, Brenntag',  '4827', '40404')
) as v(project_id, name, configuration_id, reference_id)
where not exists (
  select 1 from telemetry_devices d where d.configuration_id = v.configuration_id
);

-- Padroniza o nome de TODOS os equipamentos pro nome do projeto
-- ("40XXX, Nome"), em vez de "Equipamento Nome". Idempotente.
update telemetry_devices d
set name = p.name
from projects p
where p.id = d.project_id
  and d.name is distinct from p.name;
