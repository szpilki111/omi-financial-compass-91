
-- Schedule daily reminder check at 8:00 AM Warsaw time (7:00 UTC)
-- This will automatically send reminders 5 days before, 1 day before, and on overdue deadlines
SELECT cron.schedule(
  'send-report-reminders-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vzalrnwnpzbpzvcrjitt.supabase.co/functions/v1/send-report-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6YWxybnducHpicHp2Y3JqaXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc2NjEwMjUsImV4cCI6MjA2MzIzNzAyNX0.-YpKnsjN8rZpDtWWmgcWNtrfAz8-KEh7KZtwp1vFKX8"}'::jsonb,
    body := '{"batch_size": 10}'::jsonb
  ) AS request_id;
  $$
);
