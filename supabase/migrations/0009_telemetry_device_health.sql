-- Colunas de controle de falha POR DISPOSITIVO: alerta quando um equipamento
-- específico fica sem resposta da HI Tecnologia por tempo suficiente, mesmo
-- que o pipeline como um todo continue funcionando normalmente pros outros
-- (achado real: Niterra ficou ~4h travado por um 429 da HI Tecnologia
-- específico daquele conector, sem nenhum alerta, porque o alerta existente
-- só cobre falha do pipeline inteiro).
alter table telemetry_devices
  add column if not exists consecutive_failures int not null default 0,
  add column if not exists failure_alerted boolean not null default false;

-- Permite que usuários autenticados atualizem dispositivos de telemetria —
-- usado pelo botão "Atualizar leitura" no painel do projeto. Antes só
-- existia policy de leitura, então o botão nunca conseguia persistir nada
-- (nem sucesso nem falha), embora mostrasse o erro real na hora (foi assim
-- que o 429 do Niterra foi descoberto).
create policy "Authenticated users can update telemetry_devices"
  on telemetry_devices for update
  to authenticated
  using (true)
  with check (true);
