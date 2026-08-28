import { Router } from "express";
import { z } from "zod";
import { requireAdmin, writeAuditLog } from "../auth";
import { serviceUnavailable, supabaseRequest } from "../db";
export const adminImportRouter = Router();
adminImportRouter.use(requireAdmin);
adminImportRouter.get("/export", async (_req, res) => {
  try {
    const [products, settings, coupons] = await Promise.all([
      supabaseRequest("products?select=*&order=id"),
      supabaseRequest("store_settings?select=*&order=key"),
      supabaseRequest("coupons?select=*&order=code"),
    ]);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="no-name-store-export.json"`,
    );
    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      products,
      settings,
      coupons,
    });
  } catch (e) {
    res
      .status(serviceUnavailable(e) ? 503 : 500)
      .json({ error: "Unable to export store data." });
  }
});
adminImportRouter.post("/import", async (req, res) => {
  const p = z
    .object({
      products: z.array(z.record(z.unknown())).max(1000).optional(),
      settings: z
        .array(z.object({ key: z.string().max(80), value: z.unknown() }))
        .max(100)
        .optional(),
      coupons: z.array(z.record(z.unknown())).max(500).optional(),
    })
    .safeParse(req.body);
  if (!p.success) {
    res
      .status(400)
      .json({ error: "Invalid import file.", details: p.error.flatten() });
    return;
  }
  try {
    if (p.data.products?.length)
      await supabaseRequest("products", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(p.data.products),
      });
    if (p.data.settings?.length)
      await supabaseRequest("store_settings", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(p.data.settings),
      });
    if (p.data.coupons?.length)
      await supabaseRequest("coupons", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(p.data.coupons),
      });
    await writeAuditLog("store.import", req.admin?.id, {
      products: p.data.products?.length || 0,
      settings: p.data.settings?.length || 0,
      coupons: p.data.coupons?.length || 0,
    });
    res.json({
      imported: {
        products: p.data.products?.length || 0,
        settings: p.data.settings?.length || 0,
        coupons: p.data.coupons?.length || 0,
      },
    });
  } catch (e) {
    res
      .status(serviceUnavailable(e) ? 503 : 409)
      .json({ error: "Unable to import store data." });
  }
});
