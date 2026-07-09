-- Adiciona o id da tela "Dados do Sistema" do portal HI Tecnologia (nem todo
-- equipamento tem essa tela, por isso a coluna é opcional).
-- URL: https://app.telemetria.hitecnologia.com.br/dashboard/equipment/{configuration_id}/{dados_id}

alter table telemetry_devices add column if not exists dados_id text;

update telemetry_devices set dados_id = '3228' where configuration_id = '4271'; -- Marelli SP
update telemetry_devices set dados_id = '3387' where configuration_id = '4393'; -- Taranto
update telemetry_devices set dados_id = '3075' where configuration_id = '4066'; -- Vedacit BA
update telemetry_devices set dados_id = '2620' where configuration_id = '3608'; -- Siemens Energy
-- Ecopro (3875) e Niterra (3525) não têm tela "Dados do Sistema" — dados_id fica null
