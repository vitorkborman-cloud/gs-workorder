ALTER TABLE notification_preferences
  DROP COLUMN IF EXISTS disabled_device_ids,
  ADD COLUMN IF NOT EXISTS disabled_alarm_ids TEXT[] NOT NULL DEFAULT '{}';
