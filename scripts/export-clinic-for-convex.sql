\set ON_ERROR_STOP on
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_build_object(
  'services',       (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]') FROM public.services t),
  'profiles',       (SELECT coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('email', u.email)), '[]')
                     FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE u.email IS NOT NULL),
  'user_roles',     (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]') FROM public.user_roles t),
  'appointments',   (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]') FROM public.appointments t),
  'blocked_slots',  (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]') FROM public.blocked_slots t),
  'activity_log',   (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]') FROM public.activity_log t),
  'patients',       (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]') FROM public.patients t),
  'service_items',  (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]') FROM public.service_items t),
  'products',       (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]') FROM public.products t),
  'bills',          (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]') FROM public.bills t),
  'bill_items',     (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]') FROM public.bill_items t),
  'bill_handoffs',  (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]') FROM public.bill_handoffs t),
  'stock_movements',(SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]') FROM public.stock_movements t),
  'billNumberHighWater', (SELECT last_value FROM public.bills_number_seq)
);
COMMIT;
