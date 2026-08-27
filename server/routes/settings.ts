import { Router } from "express";
import { supabaseRequest, serviceUnavailable } from "../db";
export const settingsRouter = Router();
settingsRouter.get("/", async (_req, res) => {
  try {
    const rows = await supabaseRequest<Array<{ key: string; value: unknown }>>("store_settings?select=key,value");
    res.json(rows.reduce<Record<string, unknown>>((out, row) => { out[row.key] = row.value; return out; }, {}));
  } catch (error) { res.status(serviceUnavailable(error) ? 503 : 500).json({ error: "Unable to load settings." }); }
});
