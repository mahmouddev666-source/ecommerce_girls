import { Router } from "express";
import { z } from "zod";
import { createSignedStorageUrl, serviceUnavailable, supabaseRequest, supabaseRpc } from "../db";

const itemSchema = z.object({ productId: z.string().trim().min(1).max(128), quantity: z.number().int().min(1).max(100), name: z.string().trim().max(300).optional() });
const orderSchema = z.object({ id: z.string().trim().max(128).optional(), idempotencyKey: z.string().trim().min(8).max(200), customerName: z.string().trim().regex(/^\p{L}+(?:\s+\p{L}+)*$/u).max(120), phone: z.string().trim().regex(/^\d{7,15}$/), address: z.string().trim().min(3).max(1000), notes: z.string().trim().max(1000).optional(), paymentMethod: z.enum(["cod", "wallet", "instapay"]), transferNumber: z.string().trim().max(100).optional(), receiptPath: z.string().regex(/^[a-zA-Z0-9/_-]+$/).max(300).optional(), shippingAmount: z.number().min(0).max(100000).default(0), couponCode: z.string().trim().toUpperCase().max(64).optional(), items: z.array(itemSchema).min(1).max(100) });

export const ordersRouter = Router();
ordersRouter.post("/", async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid order details.", details: parsed.error.flatten() }); return; }
  if (parsed.data.paymentMethod !== "cod" && !parsed.data.receiptPath) { res.status(400).json({ error: "A payment receipt is required." }); return; }
  try {
    const order = await supabaseRpc<Record<string, unknown>>("create_store_order", { payload: { ...parsed.data, idempotency_key: parsed.data.idempotencyKey, customer_name: parsed.data.customerName, payment_method: parsed.data.paymentMethod, transfer_number: parsed.data.transferNumber, receipt_path: parsed.data.receiptPath, shipping_amount: parsed.data.shippingAmount, coupon_code: parsed.data.couponCode, items: parsed.data.items.map((item) => ({ ...item, product_id: item.productId })) } });
    res.status(201).json({ ...order, receiptUrl: parsed.data.receiptPath ? await createSignedStorageUrl("receipts", parsed.data.receiptPath) : undefined });
  } catch (error) {
    console.error("Order creation failed", error);
    const message = error instanceof Error ? error.message : "";
    res.status(serviceUnavailable(error) ? 503 : message.includes("Insufficient") || message.includes("Invalid coupon") || message.includes("unavailable") ? 409 : 500).json({ error: serviceUnavailable(error) ? "Supabase is not configured." : "Unable to create order." });
  }
});
ordersRouter.get("/:id", async (req, res) => {
  try {
    const orders = await supabaseRequest<Array<Record<string, unknown>>>(`orders?select=*&id=eq.${encodeURIComponent(req.params.id)}&limit=1`);
    if (!orders[0]) { res.status(404).json({ error: "Order not found." }); return; }
    const items = await supabaseRequest<unknown[]>(`order_items?select=*&order_id=eq.${encodeURIComponent(req.params.id)}`);
    const receiptPath = typeof orders[0].receipt_path === "string" ? orders[0].receipt_path : undefined;
    res.json({ ...orders[0], items, receiptUrl: receiptPath ? await createSignedStorageUrl("receipts", receiptPath) : undefined });
  } catch (error) { res.status(serviceUnavailable(error) ? 503 : 500).json({ error: "Unable to load order." }); }
});
