alter table public.services add column show_on_home boolean not null default false,
  add column details text not null default '',
  add column image_url text not null default '';