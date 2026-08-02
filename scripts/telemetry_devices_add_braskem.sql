-- Adiciona o equipamento de telemetria do projeto 40153, Braskem Biopilha.
-- configuration_id = 4535 (conector "40153 Braskem" no portal HI Tecnologia).
-- dados_id fica null por enquanto (tela "Dados do Sistema" opcional — só
-- usada no Modo TV; se o Braskem tiver essa tela, adicione depois seguindo
-- o padrão de scripts/telemetry_devices_add_dados_id.sql).

insert into telemetry_devices (project_id, name, configuration_id, reference_id, status)
values (
  'a2682dd5-a140-48a4-98c3-e89d181f67ff', -- 40153, Braskem Biopilha
  'Equipamento Braskem Biopilha',
  '4535',
  '40153',
  'unknown'
)
on conflict do nothing;
