alter table public.activity_log add column if not exists category text not null default 'booking';

create table public.service_items (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  name text not null,
  price integer not null default 0 check (price >= 0),
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.service_items to authenticated;
grant all on public.service_items to service_role;
alter table public.service_items enable row level security;
create policy "staff read items" on public.service_items for select to authenticated
  using (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'provider') or public.has_role(auth.uid(),'checkin'));
create policy "admin insert items" on public.service_items for insert to authenticated with check (public.has_role(auth.uid(),'super_admin'));
create policy "admin update items" on public.service_items for update to authenticated using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));
create policy "admin delete items" on public.service_items for delete to authenticated using (public.has_role(auth.uid(),'super_admin'));
create trigger service_items_touch before update on public.service_items for each row execute function public.touch_updated_at();

create or replace function public.is_staff(_user_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id)
$$;

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null default '',
  phone text not null default '',
  location text not null default '',
  date_of_birth date,
  sex text not null default '',
  insurance text not null default '',
  emergency_contact text not null default '',
  national_id text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.patients to authenticated;
grant all on public.patients to service_role;
alter table public.patients enable row level security;
create policy "staff read patients" on public.patients for select to authenticated using (public.is_staff(auth.uid()));
create policy "staff add patients" on public.patients for insert to authenticated with check (public.is_staff(auth.uid()) and created_by = auth.uid());
create policy "staff edit patients" on public.patients for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create trigger patients_touch before update on public.patients for each row execute function public.touch_updated_at();

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  number serial,
  patient_id uuid not null references public.patients(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete set null,
  status text not null default 'unpaid' check (status in ('unpaid','paid','cancelled')),
  payment_method text check (payment_method in ('cash','mobile_money','card','insurance')),
  total integer not null default 0,
  created_by uuid,
  created_by_name text not null default '',
  paid_by uuid,
  paid_by_name text not null default '',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.bills to authenticated;
grant usage on sequence public.bills_number_seq to authenticated;
grant all on public.bills to service_role;
alter table public.bills enable row level security;
create policy "staff read bills" on public.bills for select to authenticated using (public.is_staff(auth.uid()));
create policy "staff add bills" on public.bills for insert to authenticated with check (public.is_staff(auth.uid()) and created_by = auth.uid());
create policy "staff edit bills" on public.bills for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create trigger bills_touch before update on public.bills for each row execute function public.touch_updated_at();

create table public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  service_item_id uuid references public.service_items(id) on delete set null,
  department text not null,
  name text not null,
  unit_price integer not null,
  quantity integer not null default 1 check (quantity > 0),
  added_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.bill_items to authenticated;
grant all on public.bill_items to service_role;
alter table public.bill_items enable row level security;
create policy "staff read bill items" on public.bill_items for select to authenticated using (public.is_staff(auth.uid()));
create policy "staff add bill items" on public.bill_items for insert to authenticated with check (public.is_staff(auth.uid()) and added_by = auth.uid());
create policy "staff remove bill items" on public.bill_items for delete to authenticated
  using (public.is_staff(auth.uid()) and exists (select 1 from public.bills b where b.id = bill_id and b.status='unpaid'));

-- snapshot price, enforce department rights, keep totals
create or replace function public.bill_item_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare it record; svc text;
begin
  select * into it from public.service_items where id = new.service_item_id;
  if it is null then raise exception 'Unknown price list item'; end if;
  if (select status from public.bills where id=new.bill_id) <> 'unpaid' then raise exception 'This bill is closed'; end if;
  new.department := it.department; new.name := it.name; new.unit_price := it.price;
  if not public.has_role(new.added_by,'super_admin') then
    select service into svc from public.profiles where id = new.added_by;
    if not ((public.has_role(new.added_by,'checkin') and it.department='reception')
         or (public.has_role(new.added_by,'provider') and (svc is null or svc = it.department))) then
      raise exception 'You can only bill items from your own department';
    end if;
  end if;
  return new;
end $$;
create trigger bill_items_guard before insert on public.bill_items for each row execute function public.bill_item_guard();

create or replace function public.bill_recalc() returns trigger language plpgsql security definer set search_path = public as $$
declare b uuid := coalesce(new.bill_id, old.bill_id);
begin
  update public.bills set total = coalesce((select sum(unit_price*quantity) from public.bill_items where bill_id=b),0) where id=b;
  return null;
end $$;
create trigger bill_items_recalc after insert or delete on public.bill_items for each row execute function public.bill_recalc();

revoke execute on function public.bill_item_guard() from public, anon, authenticated;
revoke execute on function public.bill_recalc() from public, anon, authenticated;
revoke execute on function public.is_staff(uuid) from public, anon;
grant execute on function public.is_staff(uuid) to authenticated;

insert into public.service_items (department, name, price, description) values
 ('reception','Registration / file opening',5000,'New patient file'),
 ('reception','Consultation fee',10000,'Front-desk consultation fee'),
 ('physiotherapy','Initial assessment',15000,'First physiotherapy evaluation'),
 ('physiotherapy','Manual therapy session',12000,'Hands-on joint and soft tissue therapy'),
 ('physiotherapy','Exercise therapy session',10000,'Guided strengthening and mobility'),
 ('physiotherapy','Electrotherapy (TENS)',8000,'Pain relief with electrical stimulation'),
 ('physiotherapy','Ultrasound therapy',8000,'Therapeutic ultrasound'),
 ('physiotherapy','Hydrotherapy',15000,'Water-based therapy session'),
 ('physiotherapy','Home exercise plan',5000,'Personal exercise programme'),
 ('physiotherapy','Sports injury rehab session',15000,'Return-to-sport rehabilitation'),
 ('prosthetics','Below-knee prosthesis',450000,'Custom below-knee limb'),
 ('prosthetics','Above-knee prosthesis',750000,'Custom above-knee limb'),
 ('prosthetics','Socket adjustment',30000,'Refit and comfort adjustment'),
 ('prosthetics','Prosthesis repair',40000,'Repair of existing limb'),
 ('orthotics','Custom foot insoles',35000,'Made-to-measure insoles'),
 ('orthotics','Knee brace',60000,'Supportive knee orthosis'),
 ('orthotics','Ankle-foot orthosis (AFO)',80000,'Custom AFO'),
 ('orthotics','Spinal brace',120000,'Custom spinal orthosis'),
 ('outpatient','Follow-up rehab session',10000,'Ongoing outpatient session'),
 ('outpatient','Gait training',12000,'Walking re-training'),
 ('consultation','Specialist consultation',20000,'Orthopedic specialist assessment');