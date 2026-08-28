import { Router } from "express";
import { z } from "zod";
import { requireAdmin, writeAuditLog } from "../auth";
import { serviceUnavailable, supabaseRequest } from "../db";

const settingSchema = z.object({
  key: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  value: z.unknown(),
});

export const adminSettingsRouter = Router();
adminSettingsRouter.use(requireAdmin);
adminSettingsRouter.put("/", async (req, res) => {
  const p = settingSchema.safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: "Invalid settings payload." });
    return;
  }
  try {
    const out = await supabaseRequest("store_settings", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        key: p.data.key,
        value: p.data.value,
        updated_at: new Date().toISOString(),
      }),
    });
    await writeAuditLog("settings.update", req.admin?.id, { key: p.data.key });
    res.json(out);
  } catch (e) {
    res
      .status(serviceUnavailable(e) ? 503 : 500)
      .json({ error: "Unable to save settings." });
  }
});

adminSettingsRouter.put("/batch", async (req, res) => {
  const parsed = z.object({ settings: z.array(settingSchema).min(1).max(100) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid settings payload." }); return; }
  try {
    const rows = parsed.data.settings.map((setting) => ({ ...setting, updated_at: new Date().toISOString() }));
    const result = await supabaseRequest("store_settings", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(rows) });
    await writeAuditLog("settings.batch_update", req.admin?.id, { keys: rows.map((row) => row.key) });
    res.json(result);
  } catch (error) { res.status(serviceUnavailable(error) ? 503 : 500).json({ error: "Unable to save settings." }); }
});
