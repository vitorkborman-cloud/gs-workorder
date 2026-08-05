-- Agenda pg_cron do vigia independente (supabase/functions/pipeline-watchdog).
-- Roda a cada 20 min, numa agenda PRÓPRIA (não encadeada com o check-alarms),
-- pra detectar o cron parar de disparar o check-alarms de vez — cenário que
-- o log de execuções sozinho não cobre, já que nesse caso não existe nenhuma
-- execução nova pra registrar o problema.
--
-- Requer as extensões pg_cron e pg_net habilitadas (Database → Extensions),
-- as mesmas já usadas pela agenda do check-alarms em scripts/push_subscriptions.sql.

select cron.schedule(
  'pipeline-watchdog',
  '*/20 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_URL') || '/functions/v1/pipeline-watchdog',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body := '{}'::jsonb
    );
  $$
);
