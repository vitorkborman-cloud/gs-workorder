-- Execute no SQL editor do Supabase (Dashboard → SQL Editor)
-- Histórico de eventos de alarme (cada ativação detectada, mesmo que o alarme já
-- tenha voltado ao normal antes da próxima checagem). Usado pela função
-- check-alarms para: 1) registro permanente investigável, 2) deduplicar
-- notificações via UNIQUE (device_id, alarm_ref_id, activated_at).

CREATE TABLE IF NOT EXISTS alarm_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    UUID NOT NULL REFERENCES telemetry_devices(id) ON DELETE CASCADE,
  alarm_ref_id TEXT NOT NULL,
  alarm_name   TEXT,
  level        TEXT,
  activated_at TIMESTAMPTZ NOT NULL,
  detected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified     BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (device_id, alarm_ref_id, activated_at)
);

CREATE INDEX IF NOT EXISTS idx_alarm_history_device ON alarm_history(device_id);
CREATE INDEX IF NOT EXISTS idx_alarm_history_activated_at ON alarm_history(activated_at DESC);

ALTER TABLE alarm_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read alarm history"
  ON alarm_history FOR SELECT
  USING (auth.role() = 'authenticated');
