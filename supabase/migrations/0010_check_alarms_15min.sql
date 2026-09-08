-- Reduz a frequência de checagem de alarmes de 2 em 2 minutos pra 15 em 15
-- minutos. Motivo: o fornecedor da telemetria (HI Tecnologia) informou um
-- limite de aproximadamente 500 requisições GET numa janela de tempo — com
-- 7 equipamentos monitorados e 2 GETs por equipamento a cada execução,
-- rodar de 2 em 2 minutos gerava ~10.080 GETs/dia, provavelmente a causa
-- dos HTTP 429 recorrentes (Niterra, Vedacit BA, Braskem Biopilha). De 15
-- em 15 minutos, o volume cai pra ~1.344 GETs/dia (7 equipamentos × 2 GETs
-- × 96 execuções/dia) — bem mais folgado.
--
-- cron.schedule() com o mesmo nome de job ATUALIZA o agendamento existente
-- em vez de criar um duplicado, então basta rodar de novo com a nova
-- expressão cron (mesmo corpo de sempre).
select cron.schedule(
  'check-telemetry-alarms',
  '*/15 * * * *',
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
