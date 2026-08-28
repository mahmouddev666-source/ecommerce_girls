import { Router } from "express";
import { z } from "zod";
import { requireAdmin, writeAuditLog } from "../auth";
import { serviceUnavailable, supabaseRequest } from "../db";
const productSchema = z.object({
  id: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(300),
  nameEn: z.string().max(300).optional(),
  numericPrice: z.number().min(0),
  originalPrice: z.number().min(0).optional(),
  salePrice: z.number().min(0).optional(),
  category: z.string().trim().min(1).max(100),
  image: z.string().max(2000),
  images: z.array(z.string().max(2000)).max(10).optional(),
  description: z.string().max(5000).optional(),
  descriptionEn: z.string().max(5000).optional(),
  badge: z.string().max(100).optional(),
  tag: z.string().max(100).optional(),
  colors: z.array(z.string().max(30)).max(20).optional(),
  sizes: z.array(z.string().max(30)).max(20).optional(),
  video: z.string().max(2000).optional(),
  stock: z.number().int().min(0).max(100000),
  lowStockThreshold: z.number().int().min(0).max(100000),
});
const row = (p: z.infer<typeof productSchema>) => ({
  id: p.id,
  name: p.name,
  name_en: p.nameEn,
  price:
    p.salePrice && p.salePrice < p.numericPrice ? p.salePrice : p.numericPrice,
  original_price: p.originalPrice,
  sale_price: p.salePrice,
  category: p.category,
  image: p.image,
  images: p.images || [],
  description: p.description,
  description_en: p.descriptionEn,
  badge: p.badge,
  tag: p.tag,
  colors: p.colors || [],
  sizes: p.sizes || [],
  video: p.video,
  stock: p.stock,
  low_stock_threshold: p.lowStockThreshold,
  is_active: true,
  updated_at: new Date().toISOString(),
});
export const adminProductsRouter = Router();
adminProductsRouter.use(requireAdmin);
adminProductsRouter.get("/", async (_req, res) => {
  try {
    res.json(await supabaseRequest("products?select=*&order=created_at.desc"));
  } catch (e) {
    res
      .status(serviceUnavailable(e) ? 503 : 500)
      .json({ error: "Unable to load products." });
  }
});
adminProductsRouter.post("/", async (req, res) => {
  const p = productSchema.safeParse(req.body);
  if (!p.success) {
    res
      .status(400)
      .json({ error: "Invalid product.", details: p.error.flatten() });
    return;
  }
  try {
    const out = await supabaseRequest("products", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(row(p.data)),
    });
    await writeAuditLog("product.create", req.admin?.id, { id: p.data.id });
    res.status(201).json(out);
  } catch (e) {
    res
      .status(serviceUnavailable(e) ? 503 : 409)
      .json({ error: "Unable to create product." });
  }
});
adminProductsRouter.patch("/:id", async (req, res) => {
  const p = productSchema.partial().omit({ id: true }).safeParse(req.body);
  if (!p.success) {
    res
      .status(400)
      .json({ error: "Invalid product.", details: p.error.flatten() });
    return;
  }
  const value = p.data as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  const fields: Record<string, string> = {
    name: "name",
    nameEn: "name_en",
    numericPrice: "price",
    originalPrice: "original_price",
    salePrice: "sale_price",
    category: "category",
    image: "image",
    images: "images",
    description: "description",
    descriptionEn: "description_en",
    badge: "badge",
    tag: "tag",
    colors: "colors",
    sizes: "sizes",
    video: "video",
    stock: "stock",
    lowStockThreshold: "low_stock_threshold",
  };
  for (const [key, column] of Object.entries(fields))
    if (key in value) patch[column] = value[key];
  if (
    "numericPrice" in value &&
    !(
      (value.salePrice as number | undefined) &&
      (value.salePrice as number) < (value.numericPrice as number)
    )
  )
    patch.price = value.numericPrice;
  patch.updated_at = new Date().toISOString();
  try {
    const out = await supabaseRequest(
      `products?id=eq.${encodeURIComponent(req.params.id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(patch),
      },
    );
    await writeAuditLog("product.update", req.admin?.id, { id: req.params.id });
    res.json(out);
  } catch (e) {
    res
      .status(serviceUnavailable(e) ? 503 : 500)
      .json({ error: "Unable to update product." });
  }
});
adminProductsRouter.delete("/:id", async (req, res) => {
  try {
    await supabaseRequest(
      `products?id=eq.${encodeURIComponent(req.params.id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          is_active: false,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    await writeAuditLog("product.archive", req.admin?.id, {
      id: req.params.id,
    });
    res.status(204).send();
  } catch (e) {
    res
      .status(serviceUnavailable(e) ? 503 : 500)
      .json({ error: "Unable to archive product." });
  }
});

const variantSchema = z.object({
  productId: z.string().min(1).max(128),
  size: z.string().trim().min(1).max(30),
  color: z.string().trim().min(1).max(60),
  sku: z.string().trim().max(128).optional(),
  stock: z.number().int().min(0).max(100000),
  reservedStock: z.number().int().min(0).max(100000).default(0),
});
adminProductsRouter.post("/:id/variants", async (req, res) => {
  const parsed = variantSchema.safeParse({
    ...req.body,
    productId: req.params.id,
  });
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid variant.", details: parsed.error.flatten() });
    return;
  }
  try {
    const value = parsed.data;
    const result = await supabaseRequest("product_variants", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        product_id: value.productId,
        size: value.size,
        color: value.color,
        sku: value.sku,
        stock: value.stock,
        reserved_stock: value.reservedStock,
      }),
    });
    await writeAuditLog("variant.create", req.admin?.id, {
      productId: value.productId,
    });
    res.status(201).json(result);
  } catch (error) {
    res
      .status(serviceUnavailable(error) ? 503 : 409)
      .json({ error: "Unable to create variant." });
  }
});
adminProductsRouter.patch("/variants/:id", async (req, res) => {
  const parsed = variantSchema
    .partial()
    .omit({ productId: true })
    .safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid variant.", details: parsed.error.flatten() });
    return;
  }
  const value = parsed.data as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if ("size" in value) patch.size = value.size;
  if ("color" in value) patch.color = value.color;
  if ("sku" in value) patch.sku = value.sku;
  if ("stock" in value) patch.stock = value.stock;
  if ("reservedStock" in value) patch.reserved_stock = value.reservedStock;
  try {
    res.json(
      await supabaseRequest(
        `product_variants?id=eq.${encodeURIComponent(req.params.id)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(patch),
        },
      ),
    );
    await writeAuditLog("variant.update", req.admin?.id, { id: req.params.id });
  } catch (error) {
    res
      .status(serviceUnavailable(error) ? 503 : 500)
      .json({ error: "Unable to update variant." });
  }
});
adminProductsRouter.delete("/variants/:id", async (req, res) => {
  try {
    await supabaseRequest(
      `product_variants?id=eq.${encodeURIComponent(req.params.id)}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } },
    );
    await writeAuditLog("variant.delete", req.admin?.id, { id: req.params.id });
    res.status(204).send();
  } catch (error) {
    res
      .status(serviceUnavailable(error) ? 503 : 500)
      .json({ error: "Unable to delete variant." });
  }
});
