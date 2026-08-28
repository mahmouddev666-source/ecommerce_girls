alter table public.orders
  add column if not exists access_token text,
  add column if not exists receipt_storage_key text;

update public.orders
set access_token = encode(gen_random_bytes(24), 'hex')
where access_token is null;

alter table public.orders
  alter column access_token set not null;

create unique index if not exists orders_access_token_idx on public.orders(access_token);

insert into public.store_settings (key, value)
values
  ('shippingFee', '80'::jsonb),
  ('freeShippingThreshold', '2500'::jsonb)
on conflict (key) do nothing;

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
  variant_row public.product_variants%rowtype;
  order_id text := 'NN-' || encode(gen_random_bytes(12), 'hex');
  key text := nullif(p->>'idempotency_key','');
  access_token text := encode(gen_random_bytes(24), 'hex');
  subtotal numeric := 0;
  discount numeric := 0;
  shipping numeric := 0;
  coupon_discount numeric := 0;
  shipping_fee numeric := coalesce((select value::text::numeric from public.store_settings where key = 'shippingFee'), 80);
  free_shipping_threshold numeric := coalesce((select value::text::numeric from public.store_settings where key = 'freeShippingThreshold'), 2500);
  quantity integer;
  line_total numeric;
begin
  if key is null then raise exception using errcode = '22023', message = 'idempotency_key is required'; end if;
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then raise exception using errcode = '22023', message = 'Order items are required'; end if;

  select to_jsonb(o) into existing from public.orders o where o.idempotency_key = key;
  if existing is not null then
    return existing || jsonb_build_object('order_items', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.order_items i where i.order_id = (existing->>'id')));
  end if;

  for item in select * from jsonb_array_elements(p->'items') loop
    quantity := (item->>'quantity')::integer;
    if quantity is null or quantity < 1 or quantity > 100 then raise exception using errcode = '22023', message = 'Invalid item quantity'; end if;
    select * into product_row from public.products where id = item->>'product_id' and is_active = true for update;
    if not found then raise exception using errcode = 'P0001', message = 'Product is unavailable'; end if;

    if nullif(item->>'variant_id','') is not null then
      select * into variant_row from public.product_variants where id = (item->>'variant_id')::uuid and product_id = product_row.id for update;
      if not found or variant_row.size <> coalesce(item->>'size', variant_row.size) or variant_row.color <> coalesce(item->>'color', variant_row.color) then raise exception using errcode = 'P0001', message = 'Product variant is unavailable'; end if;
      if variant_row.stock - variant_row.reserved_stock < quantity then raise exception using errcode = 'P0001', message = 'Insufficient variant stock'; end if;
      update public.product_variants set stock = stock - quantity where id = variant_row.id;
    elsif jsonb_array_length(product_row.sizes) > 0 or jsonb_array_length(product_row.colors) > 0 then
      if not (product_row.sizes ? coalesce(item->>'size','')) or not (product_row.colors ? coalesce(item->>'color','')) then raise exception using errcode = 'P0001', message = 'A valid product variant is required'; end if;
      if product_row.stock < quantity then raise exception using errcode = 'P0001', message = 'Insufficient stock'; end if;
      update public.products set stock = stock - quantity, updated_at = now() where id = product_row.id;
    else
      if product_row.stock < quantity then raise exception using errcode = 'P0001', message = 'Insufficient stock'; end if;
      update public.products set stock = stock - quantity, updated_at = now() where id = product_row.id;
    end if;

    line_total := product_row.price * quantity;
    subtotal := subtotal + line_total;
  end loop;

  if nullif(p->>'coupon_code','') is not null then
    select discount into coupon_discount from public.coupons where code = upper(p->>'coupon_code') and active = true for update;
    if coupon_discount is null then raise exception using errcode = 'P0001', message = 'Invalid coupon'; end if;
    discount := round(subtotal * coupon_discount / 100, 2);
  end if;
  shipping := case when subtotal >= free_shipping_threshold then 0 else shipping_fee end;

  insert into public.orders (id, idempotency_key, access_token, public_reference, customer_name, phone, address, notes, payment_method, transfer_number, receipt_path, receipt_storage_key, subtotal, discount_amount, shipping_amount, total, coupon_code)
  values (order_id, key, access_token, order_id, p->>'customer_name', p->>'phone', p->>'address', p->>'notes', p->>'payment_method', p->>'transfer_number', p->>'receipt_path', p->>'receipt_path', subtotal, discount, shipping, greatest(0, subtotal - discount + shipping), nullif(upper(p->>'coupon_code'),''));

  if coupon_discount > 0 then
    update public.coupons set uses = uses + 1 where code = upper(p->>'coupon_code');
    insert into public.coupon_redemptions (coupon_code, order_id) values (upper(p->>'coupon_code'), order_id);
  end if;

  for item in select * from jsonb_array_elements(p->'items') loop
    select * into product_row from public.products where id = item->>'product_id';
    insert into public.order_items (order_id, product_id, variant_id, name, quantity, unit_price, original_unit_price, discount_amount, total, size_snapshot, color_snapshot)
    values (order_id, product_row.id, nullif(item->>'variant_id','')::uuid, product_row.name, (item->>'quantity')::integer, product_row.price, product_row.original_price, greatest(0, coalesce(product_row.original_price, product_row.price) - product_row.price) * (item->>'quantity')::integer, product_row.price * (item->>'quantity')::integer, nullif(item->>'size',''), nullif(item->>'color',''));
  end loop;

  select to_jsonb(o) || jsonb_build_object('order_items', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.order_items i where i.order_id = o.id)) into existing from public.orders o where o.id = order_id;
  return existing;
exception when unique_violation then
  select to_jsonb(o) || jsonb_build_object('order_items', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.order_items i where i.order_id = o.id)) into existing from public.orders o where o.idempotency_key = key;
  if existing is not null then return existing; end if;
  raise;
end;
$$;

revoke all on function public.create_store_order(jsonb) from public;
revoke all on function public.create_store_order(jsonb) from anon;
revoke all on function public.create_store_order(jsonb) from authenticated;
grant execute on function public.create_store_order(jsonb) to service_role;
