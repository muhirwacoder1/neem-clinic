alter table public.bills add column if not exists current_department text not null default 'reception',
  add column if not exists payment_reference text not null default '',
  add column if not exists receipt_token text not null default encode(extensions.gen_random_bytes(18),'hex'),
  add column if not exists finalized_by_name text not null default '',
  add column if not exists finalized_at timestamptz;

create table public.bill_handoffs (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  from_department text not null default '',
  to_department text not null,
  by_id uuid, by_name text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert on public.bill_handoffs to authenticated;
grant all on public.bill_handoffs to service_role;
alter table public.bill_handoffs enable row level security;
create policy "staff read handoffs" on public.bill_handoffs for select to authenticated using (public.is_staff(auth.uid()));
create policy "staff add handoffs" on public.bill_handoffs for insert to authenticated with check (public.is_staff(auth.uid()) and by_id = auth.uid());

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'physiotherapy',
  price integer not null default 0,
  stock integer not null default 0,
  low_stock_level integer not null default 5,
  image_url text not null default '',
  description text not null default '',
  show_on_site boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "staff read products" on public.products for select to authenticated using (public.is_staff(auth.uid()));
create policy "admin insert products" on public.products for insert to authenticated with check (public.has_role(auth.uid(),'super_admin'));
create policy "admin update products" on public.products for update to authenticated using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));
create policy "admin delete products" on public.products for delete to authenticated using (public.has_role(auth.uid(),'super_admin'));
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  change integer not null,
  reason text not null default '',
  by_id uuid, by_name text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.stock_movements to authenticated;
grant all on public.stock_movements to service_role;
alter table public.stock_movements enable row level security;
create policy "staff read movements" on public.stock_movements for select to authenticated using (public.is_staff(auth.uid()));

alter table public.bill_items add column if not exists product_id uuid references public.products(id) on delete set null;

create or replace function public.stock_in(_product uuid, _qty int, _reason text)
returns integer language plpgsql security definer set search_path = public as $$
declare n int; nm text;
begin
  if not public.has_role(auth.uid(),'super_admin') then raise exception 'Only admins can stock in'; end if;
  if _qty = 0 then raise exception 'Quantity required'; end if;
  update public.products set stock = stock + _qty where id = _product returning stock into n;
  if n is null then raise exception 'Unknown product'; end if;
  if n < 0 then raise exception 'Stock cannot go below zero'; end if;
  select full_name into nm from public.profiles where id = auth.uid();
  insert into public.stock_movements(product_id, change, reason, by_id, by_name) values (_product, _qty, coalesce(_reason,''), auth.uid(), coalesce(nm,''));
  return n;
end $$;
revoke execute on function public.stock_in(uuid,int,text) from public, anon;
grant execute on function public.stock_in(uuid,int,text) to authenticated;

create or replace function public.bill_item_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare it record; pr record; svc text; nm text;
begin
  if (select status from public.bills where id=new.bill_id) <> 'unpaid' then raise exception 'This bill is closed'; end if;
  if new.product_id is not null then
    select * into pr from public.products where id = new.product_id for update;
    if pr is null or not pr.active then raise exception 'Unknown product'; end if;
    if pr.stock < new.quantity then raise exception 'Only % left in stock', pr.stock; end if;
    update public.products set stock = stock - new.quantity where id = pr.id;
    select full_name into nm from public.profiles where id = new.added_by;
    insert into public.stock_movements(product_id, change, reason, by_id, by_name)
      values (pr.id, -new.quantity, 'Sold on bill', new.added_by, coalesce(nm,''));
    new.service_item_id := null; new.department := 'products'; new.name := pr.name; new.unit_price := pr.price;
    return new;
  end if;
  select * into it from public.service_items where id = new.service_item_id;
  if it is null then raise exception 'Unknown price list item'; end if;
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

create or replace function public.bill_item_restock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.product_id is not null then
    update public.products set stock = stock + old.quantity where id = old.product_id;
    insert into public.stock_movements(product_id, change, reason, by_id, by_name)
      values (old.product_id, old.quantity, 'Removed from bill', auth.uid(), '');
  end if;
  return null;
end $$;
create trigger bill_items_restock after delete on public.bill_items for each row execute function public.bill_item_restock();

create or replace function public.get_public_products()
returns table(id uuid, name text, category text, price integer, image_url text, description text, in_stock boolean)
language sql stable security definer set search_path = public as $$
  select id, name, category, price, image_url, description, stock > 0 from public.products
  where active and show_on_site order by category, name
$$;
grant execute on function public.get_public_products() to anon, authenticated;

insert into public.products (name, category, price, stock, low_stock_level, description) values
 ('Knee support brace','physiotherapy',18000,12,4,'Elastic knee sleeve for mild instability and recovery.'),
 ('Lumbar support belt','orthotics',25000,6,3,'Adjustable lower-back belt for posture and pain relief.'),
 ('Resistance band set','physiotherapy',12000,20,5,'Three strengths for home exercise programmes.'),
 ('Cervical collar (soft)','orthotics',9000,3,4,'Soft foam neck collar for short-term support.'),
 ('Ankle stirrup brace','orthotics',22000,8,3,'Stabilises the ankle after sprains.'),
 ('Hot/cold gel pack','physiotherapy',6000,15,5,'Reusable pack for pain and swelling.'),
 ('Diclofenac gel 50g','pharmacy',4500,25,8,'Topical anti-inflammatory gel.'),
 ('Paracetamol 500mg (20)','pharmacy',1500,0,10,'Pain and fever relief tablets.');