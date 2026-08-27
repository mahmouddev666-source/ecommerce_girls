import { Router } from "express";
import { serviceUnavailable, supabaseRequest } from "../db";

export const categoriesRouter = Router();
categoriesRouter.get("/", async (_req, res) => {
  try {
    const products = await supabaseRequest<Array<{ category?: string; image?: string }>>("products?select=category,image&is_active=eq.true&order=created_at.desc");
    const seen = new Set<string>();
    res.json(products.filter((product) => product.category && !seen.has(product.category) && seen.add(product.category)).map((product) => ({ label: product.category, image: product.image })));
  } catch (error) { res.status(serviceUnavailable(error) ? 503 : 500).json({ error: "Unable to load categories." }); }
});
