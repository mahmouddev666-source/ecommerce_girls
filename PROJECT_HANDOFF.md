# Project Handoff

## 0. Pre-change audit

This section records the repository before the Supabase commerce integration.

### What existed and worked

- React 18/Vite SPA with React Router in `client/App.tsx`.
- Express 5 server in `server/index.ts`, used by Vite in development and wrapped by `netlify/functions/api.ts`.
- Admin authentication/session foundation in `server/auth.ts` backed by `supabase/migrations/001_admin_security.sql`.
- Vitest test setup and existing demo endpoint.
- Baseline verification before changes: `pnpm typecheck`, `pnpm test` (5 tests), and `pnpm build` all passed.

### Frontend data and responsibilities before changes

- `client/components/store/StoreLayout.tsx` owned the storefront layout, context, catalog, settings, sections, pages, coupons, orders, cart, and presentation helpers.
- `client/pages/Index.tsx` rendered the home page and static editorial content.
- `client/pages/Shop.tsx` rendered catalog filtering/search.
- `client/pages/Product.tsx` rendered product details and selected size/color only visually.
- `client/pages/Cart.tsx` calculated cart totals locally.
- `client/pages/Checkout.tsx` created local orders, encoded receipts as data URLs, and opened WhatsApp.
- `client/pages/OrderSummary.tsx` loaded orders from local storage.
- `client/pages/Admin.tsx` performed all product/settings/page/coupon/order operations in the browser.
- `client/pages/AdminLogin.tsx` was the only commerce-adjacent frontend API client, calling admin login.

Local storage keys were `no-name-products`, `no-name-settings`, `no-name-sections`, `no-name-pages`, `no-name-coupons`, `no-name-orders`, `no-name-language`, and `no-name-language-version`. The catalog contained roughly 36 static products in `StoreLayout.tsx`; home/editorial/filter defaults were static in page files. Cart state was memory-only.

### Backend and database before changes

- Existing API routes were `/api/ping`, `/api/demo`, `/api/admin/login`, `/api/admin/logout`, `/api/admin/session`, and `/api/admin/check`.
- `server/auth.ts` used raw server-side Supabase REST calls and HTTP-only sessions. `SUPABASE_SERVICE_ROLE_KEY` was not used by the browser.
- `001_admin_security.sql` defined `admin_users`, `admin_sessions`, and `audit_logs`, enabled RLS, and did not define commerce tables, storage, policies, triggers, or commerce functions.
- No product, category, variant, order, coupon, settings, upload, import, or export API existed.
- `netlify.toml` routed `/api/*` to one function but did not have a SPA fallback.

### Risks and missing pieces found

- Commerce data and customer/order PII were browser-local and editable.
- Prices, discounts, stock, coupon usage, and order totals were not server-authoritative.
- Receipt data URLs could exceed local-storage limits.
- Product variants were not retained in cart/order lines.
- No atomic stock reservation or idempotent order creation existed.
- Most admin operations had no server persistence.
- Direct SPA routes could 404 on Netlify.

### Scope protection

The existing visual hierarchy, Tailwind classes, layout, typography, colors, cards, navigation, and responsive structure are treated as source of truth. Subsequent changes are limited to data loading, form submission, persistence, loading/error states, and the minimum variant/import/export wiring required by the approved plan.

## 1. Implementation status

### Architecture after changes

- `server/db.ts` centralizes server-only Supabase REST/RPC and signed storage requests.
- `server/routes/` now contains public product/category/settings routes, order creation and lookup, receipt upload, and admin product/order/settings/coupon/import/export routes.
- `supabase/migrations/002_store_schema.sql` adds commerce tables, product variants, order snapshots, constraints, indexes, RLS enablement, timestamp triggers, and the `create_store_order` security-definer function. Apply `001_admin_security.sql` first.
- `client/lib/api.ts` is the typed browser API boundary. The browser never receives `SUPABASE_SERVICE_ROLE_KEY`.
- `StoreLayout.tsx` loads products/settings from the API when available, keeps localStorage fallback for existing data and migration, and persists only the local migration copy plus cart. Existing sections/pages remain local because the original UI stores them locally and no unnecessary redesign was introduced.
- Product/cart/checkout/order summary now retain variants, upload receipts server-side, submit idempotent orders, and prefer server order data. Admin product/settings/coupon/order operations call protected routes, and the dashboard can export/import a versioned localStorage JSON file without clearing localStorage.
- `netlify.toml` now sends `/api/*` to the Function before the SPA fallback and supports direct BrowserRouter paths. `package-lock.json` was removed after confirming the pnpm lockfile and package manager setup.

### API reference

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/api/products` | Public | Active products; optional category filter and variants. |
| GET | `/api/products/:id` | Public | Active product detail with variants. |
| GET | `/api/categories` | Public | Categories derived from active catalog data. |
| GET | `/api/site/settings` | Public | Public settings only; alias of `/api/settings`. |
| POST | `/api/orders` | Public | Zod-validated order; server RPC recalculates prices, coupon, total, and decrements stock atomically by idempotency key. |
| GET | `/api/orders/:id` | Public reference lookup | Order summary and short-lived receipt URL when configured. |
| POST | `/api/uploads/receipt` | Public | JPEG/PNG/WebP receipt upload, 5MB maximum, random storage key. `/api/uploads` is also supported. |
| GET | `/api/admin/products` | Admin | Full product list. |
| POST | `/api/admin/products` | Admin | Create product. |
| PATCH/DELETE | `/api/admin/products/:id` | Admin | Update/archive product. |
| POST | `/api/admin/products/:id/variants` | Admin | Create variant. |
| PATCH/DELETE | `/api/admin/products/variants/:id` | Admin | Update/delete variant. |
| GET/PATCH | `/api/admin/orders` and `/api/admin/orders/:id` | Admin | List/detail/update order status. |
| PUT | `/api/admin/settings` | Admin | Upsert a setting key/value. |
| GET/POST/PATCH/DELETE | `/api/admin/coupons[/]:code` | Admin | Coupon management. |
| GET/POST | `/api/admin/export` and `/api/admin/import` | Admin | Versioned export and validated upsert import. |
| POST/GET | `/api/admin/login`, `/api/admin/logout`, `/api/admin/session` | Session cookie | Existing authentication flow. |

The frontend API functions are in `client/lib/api.ts`: `products`, `categories`, `settings`, `createOrder`, `order`, `uploadReceipt`, and the `admin` product/settings/coupon/order/import/export methods.

### Environment and Supabase setup

Put these values in the server/hosting environment, never in frontend code:

- `SUPABASE_URL`: actual Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: actual rotated service-role key; **server/function only**, never `VITE_*`, browser JavaScript, or public build output.
- `APP_ORIGIN`: exact production origin used for credentialed CORS.
- `NODE_ENV=production` in production so secure cookies are enabled.

Run `001_admin_security.sql`, then `002_store_schema.sql`. Create a private Storage bucket named `order-receipts` in Supabase Storage. Keep it private and access it through signed URLs; configure upload size/MIME restrictions in the server route and hosting limits. Run `pnpm admin:create` only with the required server environment available. For migration, use Admin → Export Data, retain the generated JSON/localStorage copy, then Admin → Import Data. Import is additive/upsert-oriented and does not clear localStorage or delete database rows.

### File map

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/002_store_schema.sql` | New/modified | Commerce schema, constraints, RLS, triggers, atomic order function. |
| `supabase/REFERENCE_SCHEMA.sql` | Updated | Human reference and storage/security notes; executable commerce definitions live in migration. |
| `server/db.ts` | New | Central Supabase request/RPC/storage layer. |
| `server/routes/products.ts`, `categories.ts`, `settings.ts`, `orders.ts`, `uploads.ts` | New | Public commerce APIs. |
| `server/routes/admin-products.ts`, `admin-orders.ts`, `admin-settings.ts`, `admin-coupons.ts`, `admin-import.ts` | New | Protected administration and migration APIs. |
| `server/index.ts` | Modified | Registers APIs and aliases. |
| `shared/api.ts` | Modified | Shared request/response contracts. |
| `client/lib/api.ts` | New | Typed frontend API calls. |
| `client/components/store/StoreLayout.tsx` | Modified | API catalog/settings loading, persistent cart, variant-aware cart, admin mutation bridges. Existing visual structure retained. |
| `client/pages/Product.tsx`, `Cart.tsx`, `Checkout.tsx`, `OrderSummary.tsx`, `Admin.tsx` | Modified | Minimal API, variant, upload, order, import/export wiring. |
| `netlify.toml` | Modified | pnpm build command, API redirect, SPA fallback. |
| `package.json` | Modified | Uses pnpm for the composite build command. |
| `package-lock.json` | Deleted | Removed after pnpm lockfile validation. |
| `PROJECT_HANDOFF.md` | New/updated | Audit, before/after report, file map, API and setup reference. |

No existing visual-only component library, global design tokens, colors, typography, navigation structure, product card styling, or responsive layout was intentionally redesigned. Existing localStorage is not automatically cleared.

### Verification

- `pnpm install --frozen-lockfile`: passed; pnpm lockfile is current.
- `pnpm typecheck`: passed.
- `pnpm test`: passed (1 file, 5 tests; existing suite).
- `pnpm build`: passed for SPA and server bundles; Vite emitted only the existing large-chunk informational warning.
- Preview navigation to `/shop` succeeded. Full browser flow could not be completed because the project dev-server process is unset in Builder settings; configure the dev command as `pnpm dev` before running the manual Supabase flow.

### Remaining external prerequisites/limits

- The actual Supabase project must have the migrations applied, the private `receipts` bucket created, and server environment variables configured before API calls can succeed.
- Existing legacy local product records use the original client shape; export preserves them, while the server import endpoint expects normalized product records. Normalize legacy records in the exported JSON if a record is rejected, and use the per-import response to review failures.
- Informational page/section settings remain localStorage-backed because the approved schema/API list did not include their persistence tables/routes. They remain exportable and are not lost.
- The repository has the existing five Vitest tests; comprehensive Supabase integration tests require a configured test project or mocked REST/RPC harness and were not fabricated against an unavailable database.
