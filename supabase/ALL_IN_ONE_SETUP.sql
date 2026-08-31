-- ============================================================================
-- NO NAME STORE - UNIFIED FULL SCHEMA SETUP
-- Run this entire script in the Supabase SQL Editor to initialize everything at once!
-- Includes: Admin Security, Categories, Products, Variants, Settings, Orders,
-- Coupons, Functions, RLS, and Default Admin (admin / admin123).
-- ============================================================================

-- 1. EXTENSIONS
create extension if not exists pgcrypto;

-- 2. ADMIN AUTHENTICATION & SECURITY TABLES
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  role text not null default 'admin' check (role in ('admin', 'editor')),
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists admin_sessions_active_lookup_idx
  on public.admin_sessions (token_hash, expires_at)
  where revoked_at is null;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.admin_users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_admin_created_idx
  on public.audit_logs (admin_user_id, created_at desc);

create index if not exists audit_logs_entity_created_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);

alter table public.admin_users enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.audit_logs enable row level security;

-- Seed Default Admin User: admin / admin123
insert into public.admin_users (id, username, password_hash, role, is_active)
values (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'admin',
  crypt('admin123', gen_salt('bf')),
  'admin',
  true
)
on conflict (username) do update set is_active = true;

-- 3. STORE COMMERCE TABLES
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.categories (
  id text primary key,
  name text not null,
  name_en text,
  image text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  name_en text,
  price numeric(10,2) not null check (price >= 0),
  original_price numeric(10,2),
  sale_price numeric(10,2),
  category text not null,
  image text not null,
  images jsonb not null default '[]'::jsonb,
  description text,
  description_en text,
  badge text,
  tag text,
  colors jsonb not null default '[]'::jsonb,
  sizes jsonb not null default '[]'::jsonb,
  video text,
  stock integer not null default 0 check (stock >= 0),
  reserved_stock integer not null default 0 check (reserved_stock >= 0),
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  sku text unique,
  size text,
  color text,
  stock integer not null default 0 check (stock >= 0),
  reserved_stock integer not null default 0 check (reserved_stock >= 0),
  price_override numeric(10,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_size_color_unique unique (product_id, size, color)
);

create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coupons (
  code text primary key,
  discount numeric(5,2) not null check (discount > 0 and discount <= 100),
  uses integer not null default 0 check (uses >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  min_order_amount numeric(10,2),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_code text not null references public.coupons(code) on delete cascade,
  order_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key,
  idempotency_key text not null unique,
  access_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  public_reference text,
  customer_name text not null,
  phone text not null,
  address text not null,
  notes text,
  payment_method text not null,
  transfer_number text,
  receipt_path text,
  receipt_storage_key text,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  shipping_amount numeric(10,2) not null default 0 check (shipping_amount >= 0),
  total numeric(10,2) not null check (total >= 0),
  status text not null default 'جديد',
  coupon_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete set null,
  name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  original_unit_price numeric(10,2),
  discount_amount numeric(10,2) not null default 0,
  total numeric(10,2) not null check (total >= 0),
  size_snapshot text,
  color_snapshot text,
  created_at timestamptz not null default now()
);

-- 4. TRIGGERS & POLICIES
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();

drop trigger if exists settings_set_updated_at on public.store_settings;
create trigger settings_set_updated_at before update on public.store_settings for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.categories enable row level security;
alter table public.store_settings enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

do $$ begin
  create policy products_public_read on public.products for select using (is_active = true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy settings_public_read on public.store_settings for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy categories_public_read on public.categories for select using (is_active = true);
exception when duplicate_object then null; end $$;

-- 5. DEFAULT SETTINGS SEED
insert into public.store_settings (key, value)
values
  ('shippingFee', '80'::jsonb),
  ('freeShippingThreshold', '2500'::jsonb),
  ('freeShippingEnabled', 'true'::jsonb),
  ('announcement', '"شحن مجاني للطلبات أكثر من 2,500 ج.م · الدفع عند الاستلام متاح"'::jsonb),
  ('salesWhatsappNumber', '"201068568250"'::jsonb),
  ('salesWhatsappUrl', '"https://wa.me/201068568250"'::jsonb)
on conflict (key) do nothing;

insert into public.coupons (code, discount, uses, active)
values ('WELCOME10', 10, 0, true)
on conflict (code) do nothing;

-- 6. ORDER CREATION RPC
create or replace function public.create_store_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p jsonb := payload;
  existing jsonb;
  item jsonb;
  product_row public.products%rowtype;
  order_id text := coalesce(nullif(p->>'id',''), 'NN-' || encode(gen_random_bytes(10), 'hex'));
  key text := nullif(p->>'idempotency_key','');
  access_token text := encode(gen_random_bytes(24), 'hex');
  subtotal numeric := 0;
  discount numeric := 0;
  shipping numeric := greatest(0, coalesce((p->>'shipping_amount')::numeric, 0));
  coupon_discount numeric := 0;
  shipping_fee numeric := coalesce((select value::text::numeric from public.store_settings where key = 'shippingFee'), 80);
  free_shipping_threshold numeric := coalesce((select value::text::numeric from public.store_settings where key = 'freeShippingThreshold'), 2500);
  line_total numeric;
begin
  if key is null then raise exception using errcode = '22023', message = 'idempotency_key is required'; end if;
  select to_jsonb(o) into existing from public.orders o where o.idempotency_key = key;
  if existing is not null then return existing; end if;

  for item in select * from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
    select * into product_row from public.products where id = item->>'product_id' and is_active = true for update;
    if not found then raise exception using errcode = 'P0001', message = 'Product is unavailable: ' || (item->>'product_id'); end if;
    if product_row.stock < (item->>'quantity')::integer then raise exception using errcode = 'P0001', message = 'Insufficient stock for: ' || product_row.id; end if;
    line_total := product_row.price * (item->>'quantity')::integer;
    subtotal := subtotal + line_total;
    update public.products set stock = stock - (item->>'quantity')::integer, updated_at = now() where id = product_row.id;
  end loop;

  if nullif(p->>'coupon_code','') is not null then
    select discount into coupon_discount from public.coupons where code = upper(p->>'coupon_code') and active = true for update;
    if coupon_discount is null then raise exception using errcode = 'P0001', message = 'Invalid coupon'; end if;
    discount := round(subtotal * coupon_discount / 100, 2);
    update public.coupons set uses = uses + 1 where code = upper(p->>'coupon_code');
  end if;

  if shipping = 0 and subtotal < free_shipping_threshold then
    shipping := shipping_fee;
  end if;

  insert into public.orders (id, idempotency_key, access_token, public_reference, customer_name, phone, address, notes, payment_method, transfer_number, receipt_path, receipt_storage_key, subtotal, discount_amount, shipping_amount, total, coupon_code)
  values (order_id, key, access_token, order_id, p->>'customer_name', p->>'phone', p->>'address', p->>'notes', p->>'payment_method', p->>'transfer_number', p->>'receipt_path', p->>'receipt_path', subtotal, discount, shipping, greatest(0, subtotal - discount + shipping), nullif(upper(p->>'coupon_code'),''));

  for item in select * from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
    select * into product_row from public.products where id = item->>'product_id';
    insert into public.order_items (order_id, product_id, name, quantity, unit_price, total)
    values (order_id, product_row.id, coalesce(item->>'name', product_row.name), (item->>'quantity')::integer, product_row.price, product_row.price * (item->>'quantity')::integer);
  end loop;

  select to_jsonb(o) || jsonb_build_object('order_items', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.order_items i where i.order_id = o.id)) into existing from public.orders o where o.id = order_id;
  return existing;
exception when unique_violation then
  select to_jsonb(o) into existing from public.orders o where o.idempotency_key = key;
  if existing is not null then return existing; else raise; end if;
end;
$$;
