create table public.services (
  id text primary key,
  name text not null,
  description text not null default '',
  bookable boolean not null default true,
  active boolean not null default true,
  sort int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.services to anon, authenticated;
grant insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "anyone reads services" on public.services for select to anon, authenticated using (true);
create policy "admin insert services" on public.services for insert to authenticated with check (public.has_role(auth.uid(),'super_admin'));
create policy "admin update services" on public.services for update to authenticated using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));
create policy "admin delete services" on public.services for delete to authenticated using (public.has_role(auth.uid(),'super_admin'));
create trigger services_touch before update on public.services for each row execute function public.touch_updated_at();
insert into public.services (id,name,description,bookable,sort) values
 ('reception','Reception','Front desk registration and check-in.',false,0),
 ('prosthetics','Prosthetics','Custom artificial limbs, fitting and adjustments.',true,1),
 ('orthotics','Orthotics','Braces, insoles and supports made for you.',true,2),
 ('physiotherapy','Physiotherapy','Movement therapy to restore strength and mobility.',true,3),
 ('outpatient','Outpatient Therapy','Ongoing rehab sessions without a hospital stay.',true,4),
 ('consultation','Consultation','First assessment with an orthopedic specialist.',true,5);