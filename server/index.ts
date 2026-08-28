import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { registerAuthRoutes } from "./auth";
import { productsRouter } from "./routes/products";
import { settingsRouter } from "./routes/settings";
import { ordersRouter } from "./routes/orders";
import { uploadsRouter } from "./routes/uploads";
import { adminProductsRouter } from "./routes/admin-products";
import { adminOrdersRouter } from "./routes/admin-orders";
import { adminSettingsRouter } from "./routes/admin-settings";
import { adminCouponsRouter } from "./routes/admin-coupons";
import { adminImportRouter } from "./routes/admin-import";
import { categoriesRouter } from "./routes/categories";

export function createServer() {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors(process.env.APP_ORIGIN ? { origin: process.env.APP_ORIGIN, credentials: true } : undefined));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    next();
  });

  app.get("/api/ping", (_req, res) => {
    res.json({ message: "ok" });
  });

  app.get("/api/demo", handleDemo);
  app.use("/api/products", productsRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/site/settings", settingsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/uploads/receipt", uploadsRouter);
  app.use("/api/admin/products", adminProductsRouter);
  app.use("/api/admin/orders", adminOrdersRouter);
  app.use("/api/admin/settings", adminSettingsRouter);
  app.use("/api/admin/coupons", adminCouponsRouter);
  app.use("/api/admin", adminImportRouter);
  registerAuthRoutes(app);

  return app;
}
