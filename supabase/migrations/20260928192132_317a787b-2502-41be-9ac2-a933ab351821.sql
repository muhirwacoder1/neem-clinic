
create type public.app_role as enum ('super_admin', 'provider', 'checkin');
create type public.appointment_status as enum ('pending','accepted','declined','cancelled','checked_in','no_show','completed');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  service text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.can_access_service(_user_id uuid, _service text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id,'super_admin') or public.has_role(_user_id,'checkin')
    or (public.has_role(_user_id,'provider') and exists (
      select 1 from public.profiles p where p.id = _user_id and (p.service is null or p.service = _service)))
$$;

create policy "own roles or admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'super_admin'));
create policy "staff read profiles" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'super_admin'));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default upper(substr(md5(random()::text),1,8)),
  manage_token text not null unique default encode(gen_random_bytes(24),'hex'),
  patient_name text not null,
  patient_email text not null,
  patient_phone text not null default '',
  service text not null,
  start_at timestamptz not null,
  status appointment_status not null default 'pending',
  notes text not null default '',
  reminder_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.appointments (service, start_at);
grant select, update on public.appointments to authenticated;
grant all on public.appointments to service_role;
alter table public.appointments enable row level security;
create policy "staff read appointments" on public.appointments for select to authenticated
  using (public.can_access_service(auth.uid(), service));
create policy "staff update appointments" on public.appointments for update to authenticated
  using (public.can_access_service(auth.uid(), service)) with check (public.can_access_service(auth.uid(), service));

create table public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  service text,
  start_at timestamptz not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.blocked_slots to authenticated;
grant all on public.blocked_slots to service_role;
alter table public.blocked_slots enable row level security;
create policy "staff read blocks" on public.blocked_slots for select to authenticated using (true);
create policy "admin insert blocks" on public.blocked_slots for insert to authenticated with check (public.has_role(auth.uid(),'super_admin'));
create policy "admin delete blocks" on public.blocked_slots for delete to authenticated using (public.has_role(auth.uid(),'super_admin'));

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_name text not null default 'Patient',
  appointment_id uuid references public.appointments(id) on delete cascade,
  action text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert on public.activity_log to authenticated;
grant all on public.activity_log to service_role;
alter table public.activity_log enable row level security;
create policy "admin read log" on public.activity_log for select to authenticated using (public.has_role(auth.uid(),'super_admin'));
create policy "staff write log" on public.activity_log for insert to authenticated with check (actor_id = auth.uid());

-- new users get a profile; very first user becomes super admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.email,''));
  if not exists (select 1 from public.user_roles where role = 'super_admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();

-- capacity: max 2 active patients per service per 30-min slot
create or replace function public.enforce_slot_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if new.status in ('declined','cancelled') then return new; end if;
  if tg_op = 'UPDATE' and new.start_at = old.start_at and new.service = old.service
     and old.status not in ('declined','cancelled') then return new; end if;
  perform pg_advisory_xact_lock(hashtext(new.service || new.start_at::text));
  select count(*) into c from public.appointments
    where service = new.service and start_at = new.start_at and id <> new.id
      and status not in ('declined','cancelled');
  if c >= 2 then raise exception 'This time slot is fully booked'; end if;
  return new;
end $$;
create trigger appointments_capacity before insert or update on public.appointments
  for each row execute function public.enforce_slot_capacity();

-- public: slot availability (counts only)
create or replace function public.get_slot_availability(_service text, _day date)
returns table (start_at timestamptz, booked int, blocked boolean)
language sql stable security definer set search_path = public as $$
  with slots as (
    select generate_series((_day::timestamp + time '08:00') at time zone 'Africa/Kigali',
                           (_day::timestamp + time '16:30') at time zone 'Africa/Kigali',
                           interval '30 minutes') as s
  )
  select s,
    (select count(*)::int from public.appointments a where a.service=_service and a.start_at=s and a.status not in ('declined','cancelled')),
    exists (select 1 from public.blocked_slots b where b.start_at=s and (b.service is null or b.service=_service))
  from slots order by s
$$;
grant execute on function public.get_slot_availability(text, date) to anon, authenticated;

create or replace function public.lookup_booking(_token text)
returns table (reference text, patient_name text, service text, start_at timestamptz, status appointment_status)
language sql stable security definer set search_path = public as $$
  select reference, patient_name, service, start_at, status from public.appointments where manage_token=_token
$$;
grant execute on function public.lookup_booking(text) to anon, authenticated;
