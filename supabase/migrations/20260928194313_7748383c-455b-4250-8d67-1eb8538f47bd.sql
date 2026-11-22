create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;

select cron.unschedule('daily-booking-reminders') where exists (select 1 from cron.job where jobname = 'daily-booking-reminders');

select cron.schedule(
  'daily-booking-reminders',
  '0 16 * * *',
  $$
  select net.http_post(
    url := 'https://motionwell.lovable.app/api/public/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || config.decrypted_secret
    ),
    body := '{}'::jsonb
  )
  from vault.decrypted_secrets as config
  where config.name = 'clinic_legacy_cron_secret'
    and nullif(btrim(config.decrypted_secret), '') is not null;
  $$
);