-- Ajusta a frequência de checagem de 15 para 10 minutos, junto com a
-- mudança no código do check-alarms que passa a revezar o endpoint de
-- alarmes (1 equipamento por rodada) em vez de checar todos toda vez.
--
-- Motivo: a HI Tecnologia informou os limites reais da API REST — o
-- endpoint de alarmes ("Histórico de Dados, Alarmes e Eventos") permite só
-- 288 requisições/dia NA CONTA INTEIRA e 1/minuto. Com 8 equipamentos,
-- checar o alarme de todos numa mesma rodada de 15 min já estourava os dois
-- limites (burst de 8 GETs quase juntos, e 8 × 96 rodadas/dia = 768/dia).
-- Com rodadas de 10 min e revezamento (1 equipamento por rodada), o uso
-- cai pra 144 requisições de alarme/dia — folgado dentro do limite — e o
-- endpoint de status de conexão (mais permissivo, 1.440/dia) continua
-- checando todos os equipamentos toda rodada (1.152/dia), mantendo a
-- detecção de offline rápida.
select cron.schedule(
  'check-telemetry-alarms',
  '*/10 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_URL') || '/functions/v1/check-alarms',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body := '{}'::jsonb
    );
  $$
);
