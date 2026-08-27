import { randomUUID } from "node:crypto";
import { Router } from "express";
import { getSupabaseConfig, serviceUnavailable, SupabaseError } from "../db";

const MAX_FILE = 5 * 1024 * 1024;
const allowed = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
async function readMultipart(req: import("express").Request) {
  const type = req.headers["content-type"] || "";
  const match = /^multipart\/form-data;\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(type);
  if (!match) throw new Error("multipart/form-data is required");
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > MAX_FILE + 64 * 1024) throw new Error("File too large"); chunks.push(Buffer.from(chunk)); }
  const body = Buffer.concat(chunks); const boundary = Buffer.from(`--${match[1] || match[2]}`); const start = body.indexOf(Buffer.from("\r\n\r\n"));
  if (start < 0) throw new Error("Invalid multipart body");
  const header = body.subarray(0, start).toString("utf8"); const disposition = /name="file"(?:;\s*filename="([^"]*)")?/i.exec(header); const contentType = /content-type:\s*([^\r\n]+)/i.exec(header)?.[1]?.trim().toLowerCase();
  if (!disposition?.[1] || !contentType || !allowed.has(contentType)) throw new Error("Only JPEG, PNG, and WebP images are allowed");
  const contentStart = start + 4; const endMarker = Buffer.concat([Buffer.from("\r\n"), boundary]); const contentEnd = body.indexOf(endMarker, contentStart);
  if (contentEnd < 0) throw new Error("Invalid multipart boundary"); const content = body.subarray(contentStart, contentEnd);
  if (!content.length || content.length > MAX_FILE) throw new Error("File too large or empty");
  return { content, extension: allowed.get(contentType)! };
}
export const uploadsRouter = Router();
uploadsRouter.post("/", async (req, res) => {
  try {
    const { content, extension } = await readMultipart(req); const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`; const { url, serviceRoleKey } = getSupabaseConfig();
    const response = await fetch(`${url}/storage/v1/object/order-receipts/${path}`, { method: "POST", headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": extension === "jpg" ? "image/jpeg" : `image/${extension}`, "x-upsert": "false" }, body: content });
    if (!response.ok) throw new SupabaseError(response.status, "Upload failed", await response.text());
    res.status(201).json({ path });
  } catch (error) { const status = serviceUnavailable(error) ? 503 : error instanceof Error && /multipart|File|image|body|boundary/.test(error.message) ? 400 : 500; res.status(status).json({ error: serviceUnavailable(error) ? "Supabase is not configured." : error instanceof Error ? error.message : "Unable to upload file." }); }
});
