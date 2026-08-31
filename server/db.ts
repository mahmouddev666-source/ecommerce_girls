import { randomUUID } from "node:crypto";

export type SupabaseConfig = { url: string; serviceRoleKey: string };

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && serviceRoleKey);
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase is not configured");
  return { url, serviceRoleKey };
}

export class SupabaseError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

// In-Memory Database Store for Preview / Offline operation
const initialProducts = [
  { id: "set-01", name: "طقم كتان بلون الجمل", name_en: "Camel Linen Set", price: 2490, numericPrice: 2490, category: "أطقم", image: "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=700&q=85", tag: "جديد", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "set-02", name: "طقم يومي بلون رمادي", name_en: "Grey Everyday Set", price: 2190, numericPrice: 2190, category: "أطقم", image: "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "set-03", name: "طقم واسع بلون الزيتي", name_en: "Olive Relaxed Set", price: 2350, numericPrice: 2350, category: "أطقم", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "set-04", name: "طقم السفر المريح", name_en: "Comfort Travel Set", price: 1990, numericPrice: 1990, category: "أطقم", image: "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "set-05", name: "طقم كريمي ناعم", name_en: "Soft Cream Set", price: 2250, numericPrice: 2250, category: "أطقم", image: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=700&q=85", tag: "جديد", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "set-06", name: "طقم كتان صيفي", name_en: "Summer Linen Set", price: 2590, numericPrice: 2590, category: "أطقم", image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "linen-shirt", name: "قميص Linen الناعم", name_en: "Soft Linen Shirt", price: 990, numericPrice: 990, category: "توبس", image: "https://images.unsplash.com/photo-1605763240000-7e93b172d754?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "top-02", name: "توب أسود مضلع", name_en: "Ribbed Black Top", price: 790, numericPrice: 790, category: "توبس", image: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=700&q=85", tag: "جديد", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "top-03", name: "قميص أبيض واسع", name_en: "Relaxed White Shirt", price: 1150, numericPrice: 1150, category: "توبس", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "top-04", name: "بلوزة بأزرار أمامية", name_en: "Front Button Blouse", price: 1050, numericPrice: 1050, category: "توبس", image: "https://images.unsplash.com/photo-1564257577054-8e7c5f8e8e8a?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "top-05", name: "توب كتان بلون الحجر", name_en: "Stone Linen Top", price: 890, numericPrice: 890, category: "توبس", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "top-06", name: "قميص أزرق مطبع", name_en: "Blue Printed Shirt", price: 1650, numericPrice: 1650, category: "توبس", image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "wide-leg-pants", name: "بنطلون الـ Wide Leg", name_en: "Wide Leg Pants", price: 1290, numericPrice: 1290, category: "بنطال", image: "https://images.unsplash.com/photo-1506629905607-d9b1c7d8b7d9?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "pants-02", name: "بنطلون كتان مستقيم", name_en: "Straight Linen Pants", price: 1390, numericPrice: 1390, category: "بنطال", image: "https://images.unsplash.com/photo-1506629905607-d9b1c7d8b7d9?auto=format&fit=crop&w=700&q=85", tag: "جديد", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "pants-03", name: "بنطلون أسود كلاسيك", name_en: "Classic Black Pants", price: 1250, numericPrice: 1250, category: "بنطال", image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "pants-04", name: "بنطلون واسع بلون رملي", name_en: "Wide Sand Pants", price: 1350, numericPrice: 1350, category: "بنطال", image: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "pants-05", name: "بنطلون جيرسي مريح", name_en: "Comfort Jersey Pants", price: 1090, numericPrice: 1090, category: "بنطال", image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "pants-06", name: "بنطلون جينز مستقيم", name_en: "Straight Leg Jeans", price: 1490, numericPrice: 1490, category: "بنطال", image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "everyday-jacket", name: "جاكيت الـ Everyday", name_en: "Everyday Jacket", price: 1890, numericPrice: 1890, category: "جاكيتات", image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=700&q=85", tag: "الأكثر طلباً", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "classic-blazer", name: "بليزر الـ Classic", name_en: "Classic Blazer", price: 2150, numericPrice: 2150, category: "جاكيتات", image: "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "jacket-03", name: "جاكيت دنيم واسع", name_en: "Oversized Denim Jacket", price: 1750, numericPrice: 1750, category: "جاكيتات", image: "https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=700&q=85", tag: "جديد", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "jacket-04", name: "جاكيت كتان خفيف", name_en: "Light Linen Jacket", price: 1690, numericPrice: 1690, category: "جاكيتات", image: "https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "jacket-05", name: "كارديجان طويل", name_en: "Long Cardigan", price: 1590, numericPrice: 1590, category: "جاكيتات", image: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "jacket-06", name: "بليزر بلون العاج", name_en: "Ivory Blazer", price: 2290, numericPrice: 2290, category: "جاكيتات", image: "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "denim-01", name: "جينز مستقيم أزرق", name_en: "Straight Blue Jeans", price: 1490, numericPrice: 1490, category: "جينز", image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=700&q=85", tag: "جديد", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "denim-02", name: "جينز واسع فاتح", name_en: "Light Wide Jeans", price: 1550, numericPrice: 1550, category: "جينز", image: "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "denim-03", name: "جاكيت جينز كلاسيك", name_en: "Classic Denim Jacket", price: 1750, numericPrice: 1750, category: "جينز", image: "https://images.unsplash.com/photo-1523205565295-f8e0c1b7d3a2?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "denim-04", name: "جينز داكن مستقيم", name_en: "Dark Straight Jeans", price: 1590, numericPrice: 1590, category: "جينز", image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "denim-05", name: "تنورة جينز طويلة", name_en: "Long Denim Skirt", price: 1290, numericPrice: 1290, category: "جينز", image: "https://images.unsplash.com/photo-1583496661160-fb5886a13d27?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "denim-06", name: "قميص جينز خفيف", name_en: "Light Denim Shirt", price: 1350, numericPrice: 1350, category: "جينز", image: "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "dress-01", name: "فستان Siena الحريري", name_en: "Siena Silk Dress", price: 2450, numericPrice: 2450, category: "فساتين", image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=700&q=85", tag: "جديد", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "dress-02", name: "فستان Laila اليومي", name_en: "Laila Day Dress", price: 1790, numericPrice: 1790, category: "فساتين", image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "dress-03", name: "فستان كتان طويل", name_en: "Long Linen Dress", price: 1990, numericPrice: 1990, category: "فساتين", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "dress-04", name: "فستان صيفي واسع", name_en: "Relaxed Summer Dress", price: 1650, numericPrice: 1650, category: "فساتين", image: "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "dress-05", name: "فستان أسود بسيط", name_en: "Simple Black Dress", price: 1850, numericPrice: 1850, category: "فساتين", image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
  { id: "dress-06", name: "فستان كريمي ناعم", name_en: "Soft Cream Dress", price: 2090, numericPrice: 2090, category: "فساتين", image: "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=700&q=85", tag: "", is_active: true, stock: 12, low_stock_threshold: 3, created_at: new Date().toISOString() },
];

const inMemoryStore = {
  products: new Map<string, any>(initialProducts.map((p) => [p.id, p])),
  variants: new Map<string, any>(),
  settings: new Map<string, any>([
    ["announcement", "Free shipping on orders over 2,500 EGP · Cash on delivery available"],
    ["accent", "#d4775c"],
    ["heroTitle", "New for Summer 2026"],
    ["heroDescription", "Modest styles designed for everyday comfort."],
    ["salesWhatsappNumber", "201068568250"],
    ["salesWhatsappUrl", "https://wa.me/201068568250"],
  ]),
  coupons: new Map<string, any>([
    ["WELCOME10", { id: "c1", code: "WELCOME10", discount: 10, uses: 0, active: true, created_at: new Date().toISOString() }],
  ]),
  orders: new Map<string, any>(),
  orderItems: new Map<string, any[]>(),
};

export async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (isSupabaseConfigured()) {
    const { url, serviceRoleKey } = getSupabaseConfig();
    const response = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new SupabaseError(response.status, `Supabase request failed (${response.status})`, details);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  // In-Memory emulation for dev/preview
  const method = (init.method || "GET").toUpperCase();
  const [tablePart, queryPart] = path.split("?");
  const table = tablePart.replace(/^\//, "");
  const queryParams = new URLSearchParams(queryPart || "");

  if (table === "products") {
    if (method === "GET") {
      let items = Array.from(inMemoryStore.products.values());
      const idEq = queryParams.get("id");
      if (idEq && idEq.startsWith("eq.")) {
        const id = decodeURIComponent(idEq.slice(3));
        const found = inMemoryStore.products.get(id);
        return (found ? [found] : []) as T;
      }
      const catEq = queryParams.get("category");
      if (catEq && catEq.startsWith("eq.")) {
        const cat = decodeURIComponent(catEq.slice(3));
        items = items.filter((p) => p.category === cat);
      }
      const activeEq = queryParams.get("is_active");
      if (activeEq === "eq.true") {
        items = items.filter((p) => p.is_active !== false);
      }
      return items as T;
    }
    if (method === "POST") {
      const body = JSON.parse((init.body as string) || "{}");
      const id = body.id || randomUUID();
      const product = { ...body, id, created_at: new Date().toISOString() };
      inMemoryStore.products.set(id, product);
      return [product] as T;
    }
    if (method === "PATCH") {
      const idEq = queryParams.get("id");
      const id = idEq?.startsWith("eq.") ? decodeURIComponent(idEq.slice(3)) : "";
      const body = JSON.parse((init.body as string) || "{}");
      const existing = inMemoryStore.products.get(id) || {};
      const updated = { ...existing, ...body, updated_at: new Date().toISOString() };
      inMemoryStore.products.set(id, updated);
      return [updated] as T;
    }
  }

  if (table === "product_variants") {
    if (method === "GET") {
      const pIdEq = queryParams.get("product_id");
      const productId = pIdEq?.startsWith("eq.") ? decodeURIComponent(pIdEq.slice(3)) : null;
      let variants = Array.from(inMemoryStore.variants.values());
      if (productId) variants = variants.filter((v) => v.product_id === productId);
      return variants as T;
    }
    if (method === "POST") {
      const body = JSON.parse((init.body as string) || "{}");
      const id = body.id || randomUUID();
      const variant = { ...body, id };
      inMemoryStore.variants.set(id, variant);
      return [variant] as T;
    }
    if (method === "PATCH") {
      const idEq = queryParams.get("id");
      const id = idEq?.startsWith("eq.") ? decodeURIComponent(idEq.slice(3)) : "";
      const body = JSON.parse((init.body as string) || "{}");
      const existing = inMemoryStore.variants.get(id) || {};
      const updated = { ...existing, ...body };
      inMemoryStore.variants.set(id, updated);
      return [updated] as T;
    }
    if (method === "DELETE") {
      const idEq = queryParams.get("id");
      const id = idEq?.startsWith("eq.") ? decodeURIComponent(idEq.slice(3)) : "";
      inMemoryStore.variants.delete(id);
      return undefined as T;
    }
  }

  if (table === "store_settings") {
    if (method === "GET") {
      const rows = Array.from(inMemoryStore.settings.entries()).map(([key, value]) => ({ key, value }));
      return rows as T;
    }
    if (method === "POST") {
      const body = JSON.parse((init.body as string) || "[]");
      if (Array.isArray(body)) {
        for (const item of body) inMemoryStore.settings.set(item.key, item.value);
        return body as T;
      }
      inMemoryStore.settings.set(body.key, body.value);
      return [body] as T;
    }
  }

  if (table === "coupons") {
    if (method === "GET") {
      return Array.from(inMemoryStore.coupons.values()) as T;
    }
    if (method === "POST") {
      const body = JSON.parse((init.body as string) || "{}");
      const code = String(body.code).toUpperCase();
      const coupon = { ...body, code, id: randomUUID(), created_at: new Date().toISOString() };
      inMemoryStore.coupons.set(code, coupon);
      return [coupon] as T;
    }
    if (method === "PATCH") {
      const codeEq = queryParams.get("code");
      const code = codeEq?.startsWith("eq.") ? decodeURIComponent(codeEq.slice(3)).toUpperCase() : "";
      const body = JSON.parse((init.body as string) || "{}");
      const existing = inMemoryStore.coupons.get(code) || {};
      const updated = { ...existing, ...body };
      inMemoryStore.coupons.set(code, updated);
      return [updated] as T;
    }
  }

  if (table === "orders") {
    if (method === "GET") {
      const idEq = queryParams.get("id");
      if (idEq?.startsWith("eq.")) {
        const id = decodeURIComponent(idEq.slice(3));
        const order = inMemoryStore.orders.get(id);
        return (order ? [order] : []) as T;
      }
      return Array.from(inMemoryStore.orders.values()).reverse() as T;
    }
    if (method === "PATCH") {
      const idEq = queryParams.get("id");
      const id = idEq?.startsWith("eq.") ? decodeURIComponent(idEq.slice(3)) : "";
      const body = JSON.parse((init.body as string) || "{}");
      const existing = inMemoryStore.orders.get(id) || {};
      const updated = { ...existing, ...body };
      inMemoryStore.orders.set(id, updated);
      return [updated] as T;
    }
  }

  if (table === "order_items") {
    if (method === "GET") {
      const oIdEq = queryParams.get("order_id");
      const orderId = oIdEq?.startsWith("eq.") ? decodeURIComponent(oIdEq.slice(3)) : "";
      return (inMemoryStore.orderItems.get(orderId) || []) as T;
    }
  }

  return [] as unknown as T;
}

export async function supabaseRpc<T>(name: string, payload: Record<string, unknown>): Promise<T> {
  if (isSupabaseConfigured()) {
    return supabaseRequest<T>(`rpc/${encodeURIComponent(name)}`, { method: "POST", body: JSON.stringify(payload) });
  }

  if (name === "create_store_order") {
    const rawPayload = (payload.payload as any) || payload;
    const orderId = rawPayload.id || `ORD-${Date.now()}`;
    const items = rawPayload.items || [];
    let subtotal = 0;
    const orderItemsList = items.map((item: any) => {
      const product = inMemoryStore.products.get(item.product_id) || {};
      const unitPrice = product.price || 1000;
      const total = unitPrice * item.quantity;
      subtotal += total;
      return {
        id: randomUUID(),
        order_id: orderId,
        product_id: item.product_id,
        name: item.name || product.name || "Product",
        quantity: item.quantity,
        size: item.size || "M",
        color: item.color || "#222222",
        unit_price: unitPrice,
        total,
      };
    });

    let discount = 0;
    if (rawPayload.coupon_code) {
      const coupon = inMemoryStore.coupons.get(String(rawPayload.coupon_code).toUpperCase());
      if (coupon && coupon.active) {
        discount = Math.round((subtotal * coupon.discount) / 100);
        coupon.uses = (coupon.uses || 0) + 1;
      }
    }

    const shipping = rawPayload.shipping_amount || 0;
    const total = Math.max(0, subtotal - discount + shipping);

    const orderRecord = {
      id: orderId,
      customer_name: rawPayload.customer_name,
      phone: rawPayload.phone,
      address: rawPayload.address,
      notes: rawPayload.notes || "",
      payment_method: rawPayload.payment_method || "cod",
      transfer_number: rawPayload.transfer_number,
      receipt_path: rawPayload.receipt_path,
      subtotal,
      discount_amount: discount,
      shipping_amount: shipping,
      coupon_code: rawPayload.coupon_code,
      total,
      status: "جديد",
      items: items.length,
      created_at: new Date().toISOString(),
    };

    inMemoryStore.orders.set(orderId, orderRecord);
    inMemoryStore.orderItems.set(orderId, orderItemsList);
    return orderRecord as T;
  }

  return {} as T;
}

export async function createSignedStorageUrl(bucket: string, path: string, expiresIn = 3600) {
  if (isSupabaseConfigured()) {
    const { url, serviceRoleKey } = getSupabaseConfig();
    const response = await fetch(`${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST", headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn }),
    });
    if (!response.ok) throw new SupabaseError(response.status, "Unable to sign storage URL", await response.text().catch(() => ""));
    const result = await response.json() as { signedURL?: string; signedUrl?: string };
    return `${url}/storage/v1${result.signedURL || result.signedUrl || ""}`;
  }
  return `/placeholder.svg?path=${encodeURIComponent(path)}`;
}

export function encodeQuery(value: string) { return encodeURIComponent(value); }
export function serviceUnavailable(error: unknown) { return error instanceof Error && error.message === "Supabase is not configured"; }
