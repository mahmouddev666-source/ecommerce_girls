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

The remaining sections are updated as implementation proceeds.
