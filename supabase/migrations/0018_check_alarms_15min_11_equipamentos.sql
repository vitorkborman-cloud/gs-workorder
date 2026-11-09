-- Passa a checagem de 10 para 15 minutos, junto com a entrada de 3 novos
-- equipamentos (Damasceno, Aratu, Brenntag — ver
-- scripts/telemetry_devices_add_novos_projetos.sql), totalizando 11.
--
-- Motivo: com 11 equipamentos, o ciclo de revezamento do endpoint de
-- alarmes e a fila de checagem de status (STATUS_CHECKS_PER_ROUND no
-- check-alarms) ficam num ritmo confortável dentro dos limites da HI
-- Tecnologia: status 5 × 96 = 480 chamadas/dia (limite 1.440) e alarmes
-- 96/dia (limite 288). Mantenha em sincronia com ROUND_INTERVAL_MIN em
-- supabase/functions/check-alarms/index.ts (15) e STALE_AFTER_MS do
-- pipeline-watchdog (5x o intervalo = 75 min).
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
