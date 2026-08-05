-- Adiciona o equipamento de telemetria do projeto 40344, Niterra.
-- configuration_id = 3525 (conector "40344 Niterra NGK - RI4031" no portal
-- HI Tecnologia). dados_id fica null por enquanto (tela "Dados do Sistema"
-- opcional — só usada no Modo TV; se o Niterra tiver essa tela, adicione
-- depois seguindo o padrão de scripts/telemetry_devices_add_dados_id.sql).

insert into telemetry_devices (project_id, name, configuration_id, reference_id, status)
values (
  'e086115e-936c-4df6-8b1d-db2554d84bc5', -- 40344, Niterra
  'Equipamento Niterra',
  '3525',
  '40344',
  'unknown'
)
on conflict do nothing;
