-- Adiciona o equipamento de telemetria do projeto 40398, Bardusch.
-- configuration_id = 4626 (conector no portal HI Tecnologia). dados_id fica
-- null por enquanto (tela "Dados do Sistema" opcional — só usada no Modo TV;
-- se o Bardusch tiver essa tela, adicione depois seguindo o padrão de
-- scripts/telemetry_devices_add_dados_id.sql).

insert into telemetry_devices (project_id, name, configuration_id, reference_id, status)
values (
  'abd9691a-6de3-4aed-8295-1956c6c60c2d', -- 40398, Bardusch
  'Equipamento Bardusch',
  '4626',
  '40398',
  'unknown'
)
on conflict do nothing;
