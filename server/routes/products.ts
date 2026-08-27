import { Router } from "express";
import { supabaseRequest, serviceUnavailable } from "../db";

export const productsRouter = Router();
productsRouter.get("/", async (req, res) => {
  try {
    const filters = ["select=*", "is_active=eq.true"];
    if (typeof req.query.category === "string" && req.query.category.length <= 80) filters.push(`category=eq.${encodeURIComponent(req.query.category)}`);
    const rows = await supabaseRequest<unknown[]>(`products?${filters.join("&")}&order=created_at.desc`);
    const variants = await supabaseRequest<Array<Record<string, unknown>>>("product_variants?select=*&order=size.asc");
    res.json(rows.map((product: any) => ({ ...product, variants: variants.filter((variant) => variant.product_id === product.id) })));
  } catch (error) { console.error("Products lookup failed", error); res.status(serviceUnavailable(error) ? 503 : 500).json({ error: "Unable to load products." }); }
});
productsRouter.get("/:id", async (req, res) => {
  try {
    const rows = await supabaseRequest<unknown[]>(`products?select=*&id=eq.${encodeURIComponent(req.params.id)}&is_active=eq.true&limit=1`);
    if (!rows[0]) { res.status(404).json({ error: "Product not found." }); return; }
    const variants = await supabaseRequest<Array<Record<string, unknown>>>(`product_variants?select=*&product_id=eq.${encodeURIComponent(String((rows[0] as any).id))}&order=size.asc`);
    res.json({ ...(rows[0] as Record<string, unknown>), variants });
  } catch (error) { res.status(serviceUnavailable(error) ? 503 : 500).json({ error: "Unable to load product." }); }
});
