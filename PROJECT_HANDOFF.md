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

## Business Logic & Data Flow Verification

### Verification method and conclusion

تمت مقارنة الكود الحالي مع نسخة ما قبل تكامل Supabase في Git (`19c7a6c^`) بالإضافة إلى قراءة الملفات الحالية فعليًا. النتيجة: الـ backend الجديد مبني حول مصادر البيانات الأصلية الموجودة في `StoreLayout.tsx` وصفحات المتجر، وليس حول واجهة متجر بديلة. مع ذلك، التكامل الحالي هو طبقة انتقالية: بعض منطق المحتوى (sections/pages) وبعض البيانات القديمة ما زالت محلية، كما أن import الكامل للـ legacy data وvariants ليس تلقائيًا بالكامل. هذه القيود موضحة أدناه وليست مخفية.

### خريطة المنطق الأصلي مقابل الحالي

| المجال | المصدر الأصلي والمسؤول | ما بقي | ما نُقل للخادم | اتصال الواجهة الحالي |
|---|---|---|---|---|
| Products | `client/components/store/StoreLayout.tsx`: المصفوفة `products`، state `catalog`، و`addProduct/updateProduct/deleteProduct` | helpers والعرض وfallback المحلي | القراءة العامة في `server/routes/products.ts`، CRUD في `server/routes/admin-products.ts`، REST helpers في `server/db.ts` | `client/lib/api.ts` → `/api/products` أو admin endpoints؛ fallback إلى localStorage/static عند غياب API |
| Categories | `StoreLayout.tsx`: `categories` و`englishCategories`، وتصنيف المنتج عبر `category` | ترجمة/عرض الفئات وhome tiles | `server/routes/categories.ts` يستخرج الفئات من المنتجات النشطة | `storeApi.categories()` متاح؛ `StoreLayout` يستخدم fallback الحالي |
| Product variants | أصليًا كانت `colors` و`sizes` حقولًا على المنتج فقط في `StoreLayout.tsx` و`Product.tsx`، دون variant entity | اختيار اللون/المقاس في `Product.tsx` وvariant key في السلة | جدول `product_variants` ومسارات admin variants، لكن function إنشاء الطلب الحالية لا تطبق variant stock بعد | `Product.tsx` يرسل `size/color` إلى cart؛ Checkout يرسلهما إلى `/api/orders`؛ `variantId` مدعوم في العقد لكن لا يتم تعيينه من API حاليًا |
| Cart | `StoreLayout.tsx`: `cartItems`, `addToCart`, `removeFromCart`, `updateQuantity`, `clearCart` | نفس وظائف React وواجهة Cart | لا يوجد تخزين خادم للسلة؛ إبقاؤها محلية مقصود | localStorage `no-name-cart` مع key المنتج + المقاس + اللون |
| Pricing | `getProductDiscount`, `getProductUnitPrice`, `getProductPrice` في `StoreLayout.tsx`، وحساب subtotal/shipping في Cart/Checkout | العرض المحلي والملخص قبل الإرسال | `create_store_order` يعيد حساب سعر المنتج وsubtotal/total | Checkout يرسل معرفات وكميات فقط؛ `shippingAmount` ما زال قيمة عميل يرسلها للخادم ويُستخدم حاليًا، وهي نقطة تغيير/مخاطرة أدناه |
| Discounts | `getProductDiscount` وsale/original fields في `StoreLayout.tsx` | badges والأسعار المعروضة | الخادم يخزن `price` النهائي عند CRUD ويحسب lines من `products.price` | `productFromApi` يعيد بناء StoreProduct |
| Coupons | state `coupons`, `addCoupon/deleteCoupon` في `StoreLayout.tsx`، والتحقق والحساب في `Cart.tsx` وCheckout | عرض الكوبون والحساب التقديري في Cart | CRUD في `admin-coupons.ts`، تحقق وزيادة `uses` داخل SQL function | Admin mutation عبر `storeApi.admin`; Cart ما زال يختار من cache local حتى ينجح تحميل admin coupons |
| Orders | `Checkout.tsx`: كائن `StoreOrder` و`addOrder` في StoreLayout، `no-name-orders`، وOrderSummary | fallback/نسخة محلية للعرض والهجرة | `orders`, `order_items`, RPC إنشاء الطلب، admin orders | Checkout → upload → POST `/api/orders`; OrderSummary يحاول GET ثم fallback local |
| Checkout | `client/pages/Checkout.tsx`: form validation، payment choice، receipt FileReader، WhatsApp message | التصميم والتحقق المحلي ورسالة WhatsApp | upload route وorder route والحساب/المخزون في RPC | `storeApi.uploadReceipt()` ثم `storeApi.createOrder()`؛ WhatsApp بعد نجاح API |
| Settings | `StoreLayout.tsx`: defaults و`siteSettings` state وlocalStorage، Admin save | presentation defaults وfallback | `store_settings` وGET settings وadmin PUT | `storeApi.settings()` ثم admin settings لكل key |
| Sections | `StoreLayout.tsx`: `defaultSections`, state، `updateSection`؛ Admin section form | بالكامل localStorage | لا يوجد route/جدول متصل فعليًا بالواجهة | `updateSection()` محلي فقط، ويُصدّر ضمن localStorage |
| Pages | `StoreLayout.tsx`: `defaultPageSettings`, state، `updatePageSettings`؛ About/InfoPage تستهلكها | بالكامل localStorage | لا يوجد persistence API لهذه البنية | `updatePageSettings()` محلي فقط، ويُصدّر ضمن localStorage |
| Admin operations | `Admin.tsx` يستدعي context mutations، وStoreLayout يكتب localStorage | layout/forms/report presentation | product/settings/coupon/order APIs محمية بـ `requireAdmin` | بعض handlers تحدث UI/local state ثم fire-and-forget API؛ الفشل قد يترك fallback محليًا |

### لماذا `server/db.ts` موجود؟

قبل الملف، كان اتصال Supabase الوحيد في `server/auth.ts` داخل `supabaseRequest()` ويُستخدم فقط لـ `admin_users`, `admin_sessions`, و`audit_logs`. لم تكن هناك طبقة بيانات للمتجر.

`server/db.ts` فصل المسؤوليات إلى:

- قراءة إعدادات Supabase من environment server-only.
- تنفيذ طلبات PostgREST العامة للمنتجات والإعدادات والطلبات والإدارة.
- تنفيذ RPC `create_store_order`.
- توحيد `SupabaseError` وتفاصيل الاستجابة.
- إنشاء Signed URLs للـ Storage.
- تمييز حالة عدم ضبط Supabase.

لم ينقل إليه `hashPassword`, `verifyPassword`, session cookie، session lookup، login rate limiting، `requireSession`, `requireRole`, أو `requireAdmin`; هذه بقيت في `server/auth.ts`. لذلك لا يستبدل `db.ts` نظام المصادقة ولا يكرر قواعد الجلسات. الاختلاف المقصود هو أن `auth.ts` يملك identity/session security، بينما `db.ts` يملك commerce persistence primitives.

### Data flow

#### Products

```text
StoreLayout initialization
  → client/lib/api.ts: storeApi.products()
  → GET /api/products
  → server/routes/products.ts
  → server/db.ts: supabaseRequest()
  → Supabase products + product_variants
  → productFromApi()
  → StoreProduct catalog + existing ProductCard/UI
```

عند فشل API أو عدم وجود بيانات، يبقى catalog المحلي fallback. عند وجود API ناجح ببيانات، تصبح بيانات Supabase هي المصدر المعروض.

#### Product detail

```text
Product.tsx route id
  → StoreLayout catalog lookup
  → API catalog populated by GET /api/products
  → GET /api/products/:id (available route for direct detail)
  → products route + variants query
  → Supabase
  → selected size/color
  → addToCart(product, { size, color })
```

الملاحظة: `Product.tsx` الحالي لا يستدعي `storeApi.order` أو `storeApi.products/:id` مباشرة؛ يعتمد على catalog المحمل في StoreLayout، مع بقاء endpoint detail جاهزًا.

#### Cart

```text
Product
  → selected size/color
  → CartItem { product, quantity, variant }
  → localStorage no-name-cart
  → Cart.tsx quantity/coupon presentation
  → Checkout
```

الـ cart ليس مصدر ثقة للسعر أو المخزون. الخادم يستقبل identifiers/quantities فقط في order payload.

#### Order

```text
Checkout.tsx
  → local form validation
  → POST /api/uploads (non-COD receipt)
  → storage key
  → POST /api/orders with productId, variantId?, quantity, customer fields, idempotencyKey
  → Zod in server/routes/orders.ts
  → RPC create_store_order
  → lock product rows / validate stock
  → calculate subtotal and coupon discount
  → update stock and coupon uses
  → insert orders + order_items snapshots
  → response
  → add local summary copy + clear cart
  → open WhatsApp + navigate OrderSummary
```

#### Admin

```text
Admin.tsx
  → client/lib/api.ts
  → /api/admin/*
  → requireAdmin (server/auth.ts)
  → Zod route validation
  → server/db.ts / Supabase REST
  → audit log where implemented
  → local UI state refresh/fallback
```

#### Receipt

```text
Checkout File
  → multipart POST /api/uploads/receipt
  → MIME/5MB validation
  → random object key in private order-receipts bucket
  → returned path
  → POST /api/orders
  → orders.receipt_path reference
  → admin/order lookup signed URL
```

### StoreLayout verification

قبل التعديل كان الملف يحتوي على المنتجات الثابتة (36 منتجًا تقريبًا)، defaults للإعدادات والـ sections/pages، localStorage initialization/effects، StoreContext، cart/order/coupon/admin mutations، helpers للأسعار والفئات، وكل markup للheader/footer/ProductCard.

بعد التعديل:

- لم تُحذف مصفوفة `products` الثابتة. ما زالت في `StoreLayout.tsx` وتحتوي نفس catalog الأصلي تقريبًا.
- لم تُحذف helpers العرض: `getProductName`, `getCategoryName`, `getProductDiscount`, `getProductUnitPrice`, `getProductPrice`, colors وWhatsApp URL.
- أُضيف `productFromApi`، `CartVariant`، `cartKey`، API loading effect، persistent cart effect، وserver calls داخل admin mutations.
- `catalog` يبدأ من localStorage مدموجًا مع static products، ثم يستبدل بـ API products عندما يرجع API بيانات.
- localStorage لم يعد المصدر المركزي المقصود عند توفر Supabase، لكنه بقي fallback ونسخة export كما طلب المستخدم.
- sections/pages بقيت في StoreLayout وlocalStorage لأن backend الحالي لا يملك routes/جداول متصلة بها.
- لم يتغير markup الرئيسي أو Tailwind layout.

### Admin.tsx: العمليات قبل وبعد

| العملية الأصلية | قبل التعديل | الوضع الحالي |
|---|---|---|
| إضافة منتج | `addProduct` ثم localStorage products | `addProduct` يحدث UI/local copy ثم `POST /api/admin/products` |
| تعديل منتج | `updateProduct` ثم localStorage | `PATCH /api/admin/products/:id` |
| حذف منتج | filter محلي | `DELETE /api/admin/products/:id`، والخادم archive بـ `is_active=false` |
| الإعدادات | `updateSiteSettings` ثم localStorage | `PUT /api/admin/settings` لكل key مع local update |
| sections | `updateSection` ثم localStorage | ما زالت localStorage فقط |
| pages | `updatePageSettings` ثم localStorage | ما زالت localStorage فقط |
| إضافة كوبون | `addCoupon` ثم localStorage | `POST /api/admin/coupons` |
| حذف كوبون | filter محلي | `DELETE /api/admin/coupons/:code` لتعطيله |
| عرض الطلبات | orders localStorage | StoreLayout يحاول `GET /api/admin/orders`، مع fallback local |
| export | localStorage keys فقط | ما زال export المحلي من Admin؛ يوجد أيضًا server export منفصل |
| import | يكتب localStorage ثم يحاول endpoint | يكتب localStorage، ثم يحاول `/api/admin/import` للمنتجات والكوبونات فقط |
| logout | POST auth route | ما زال `POST /api/admin/logout` |

### Product/Cart/Checkout/OrderSummary verification

- `Product.tsx`: السلوك الأصلي كان lookup من catalog مع fallback لأول منتج، والاختيارات لم تدخل السلة. الحالي يحتفظ بالواجهة، ويضيف `{size,color}` عند `addToCart`. لم يُضف استدعاء detail API مباشر؛ catalog StoreLayout هو المسار الحالي.
- `Cart.tsx`: الحساب والعرض ما زالا محليين، لكن line identity أصبحت product + size + color، وأزرار remove/quantity تستعمل variant. التحقق الفعلي من الكوبون والمخزون ما زال نهائيًا في order RPC.
- `Checkout.tsx`: ما زال يبني local summary ورسالة WhatsApp، لكنه يرفع receipt ويرسل identifiers إلى API قبل اعتبار الطلب ناجحًا. يحتفظ بنسخة order في localStorage لأغراض fallback، لذلك PII قد يبقى محليًا.
- `OrderSummary.tsx`: يحاول `/api/orders/:id` أولًا، ثم `orders` context ثم localStorage. هذا يحافظ على الطلبات القديمة، لكنه يعني أن access control للـ public order endpoint ما زال يعتمد على id فقط.

### client/lib/api.ts boundary check

`client/lib/api.ts` لا يحتوي على حساب subtotal أو سعر أو discount أو stock، ولا يكرر cart/order business rules. وظائفه تبني HTTP requests، تضبط credentials، تحول أخطاء HTTP إلى Error، وتعرض methods typed. الحسابات المحلية الموجودة في Cart/Checkout هي presentation/pre-submit UX وليست مصدر الثقة؛ مصدر order النهائي هو SQL function.

### سلوكيات أصلية فُقدت أو تغيرت

| السلوك | Original behavior | Current behavior | سبب التغيير | التوصية |
|---|---|---|---|---|
| Cart persistence | cart كان memory-only ويضيع بعد reload | cart يُحفظ في `no-name-cart` | الحفاظ على سلة العميل بين الصفحات/إعادة التحميل | مقبول، أو أضف خيار تنظيف يدوي لاحقًا |
| Catalog fallback | static/local catalog هو المصدر دائمًا | Supabase يستبدله عندما يعيد بيانات | جعل قاعدة البيانات المصدر المشترك | الإبقاء على fallback حتى اكتمال migration |
| Product invalid id | يعرض أول منتج بدل not-found | ما زال كذلك | لم يُغير لتجنب تعديل UI خارج الربط | يوصى بإظهار 404 بدل أول منتج |
| Product variants | size/color كانا بصريين ولا يُحفظان | يُحفظان في cart payload | إصلاح فقدان اختيار العميل | يجب إكمال variant stock وربط `variantId` في RPC |
| Order creation | يعتبر الطلب محفوظًا محليًا قبل WhatsApp | يتطلب نجاح API أولًا ثم WhatsApp | منع order محلي غير موثوق | جيد، لكن أصلح public reference/access token |
| Receipt | data URL كامل داخل localStorage | يرفع إلى Storage، لكن local summary ما زال يحتفظ بـ data URL | الحفاظ على OrderSummary fallback | يوصى بعد نجاح server order بحذف receipt data URL من local copy |
| Sections/pages | قابلة للتعديل محليًا | ما زالت محلية | لا توجد جداول/routes مطابقة لها | إضافة content tables/API إذا كان تخزينها المركزي مطلوبًا |
| Export | لا يوجد export موحد سابقًا؛ البيانات موزعة localStorage/static | UI export يلتقط localStorage keys، وserver export يلتقط products/settings/coupons | إضافة migration path دون حذف المحلي | تنفيذ export normalization شامل قبل الإنتاج |
| Admin API failure | لا يوجد backend persistence | mutations تحدث local state وfire-and-forget API | إبقاء الواجهة عاملة أثناء غياب Supabase | إظهار نجاح/فشل API بدل تجاهل Promise في production |
| Shipping | 0 فوق 2500 وإلا 80 في Cart/Checkout | نفس الحساب في العميل، لكن `shippingAmount` يدخل RPC من payload | نقل order pricing مع عدم تغيير السلوك الظاهر | احسب shipping داخل RPC ولا تثق بقيمة العميل |

### Export/Import verification

الإجابة الدقيقة: **لا، الترحيل الكامل التلقائي لكل البيانات الحالية غير متحقق في النسخة الحالية.**

- static products ما زالت موجودة في الكود، لكنها ليست مصدّرًا مباشرًا مستقلًا في `exportLocalData()`. إذا لم توجد `no-name-products` في localStorage، فالزر يصدر `null` لهذه القيمة بدل أن ينسخ مصفوفة `products` من الكود.
- export المحلي يشمل keys: products/settings/sections/pages/coupons/orders/cart، لكنه يضعها تحت `{ version, exportedAt, localStorage }`؛ لا يحولها إلى `categories`, `variants`, `settings`, `pages` normalized schema.
- server `/api/admin/export` يصدر products وstore_settings وcoupons من Supabase، وليس sections/pages/cart، ولا ينشئ variants من arrays.
- categories endpoint يستخرج categories من products ولا يصدّر category records مستقلة.
- variants يمكن أن توجد في جدولها ومساراتها، لكن import الحالي لا يقبل/ينفذ قائمة variants مستقلة.
- لا توجد normalization تلقائية كاملة من legacy keys (`numericPrice`, `nameEn`, `lowStockThreshold`) إلى database columns داخل import. Endpoint الحالي يتوقع records متوافقة تقريبًا مع server schema.
- لذلك لا يمكن ضمان نقل كل المنتجات الحالية إلى Supabase دون تعديل/تطبيع JSON إذا كان المصدر localStorage legacy أو إذا كانت variants مطلوبة ككيانات مستقلة.

شكل import الفعلي الحالي هو:

```json
{
  "version": 1,
  "exportedAt": "ISO-8601",
  "products": [{
    "id": "dress-01",
    "name": "Arabic name",
    "nameEn": "English name",
    "numericPrice": 1990,
    "originalPrice": 2200,
    "salePrice": 1990,
    "category": "Dresses",
    "image": "https://...",
    "images": [],
    "description": "...",
    "descriptionEn": "...",
    "badge": "New",
    "tag": "جديد",
    "colors": ["#222222"],
    "sizes": ["S", "M", "L"],
    "stock": 12,
    "lowStockThreshold": 3,
    "video": ""
  }],
  "settings": [{ "key": "announcement", "value": "..." }],
  "coupons": [{ "code": "WELCOME", "discount": 10, "active": true }]
}
```

لكن Admin UI حاليًا يرسل `data["no-name-products"]` و`data["no-name-coupons"]` إلى endpoint، وليس هذا الشكل normalized دائمًا. هذه فجوة معروفة وليست نجاح ترحيلًا كاملًا.

### Final architecture judgment

- `server/db.ts` يفهم ويعيد استخدام fields الأصلية: product id/name/category/images/colors/sizes/prices/stock، ويدعم cart/checkout payload الذي خرج من الصفحات الحالية.
- لم يُنشأ frontend جديد أو business model منفصل؛ layout وhelpers والـ forms الحالية ما زالت مصدر presentation والسلوك.
- لكن backend schema الحالي ليس مطابقًا 1:1 للخطة الأصلية في أسماء/حقول كل جدول، وبعض requirements (variant atomic stock، normalized import، sections/pages central persistence، public order access token) لم تكتمل بالكامل.
- لذلك هذه المراجعة **ناجحة كتحقق Architecture/Business Logic مع كشف الفجوات**، وليست شهادة بأن كل متطلبات production النهائية مكتملة. أوصي بعدم إعلان migration التجاري مكتملًا قبل معالجة الفجوات الموضحة في قسم السلوكيات المتغيرة وExport/Import.
