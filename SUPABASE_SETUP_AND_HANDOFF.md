# دليل إعداد وتسليم Supabase

هذا الدليل يوضح الخطوات اليدوية المطلوبة لتشغيل المتجر بعد ربطه بقاعدة البيانات. لا توجد مفاتيح حقيقية داخل المستودع.

## 1. القيم المطلوبة

| المتغير | القيمة المطلوبة | مكان الحصول عليها | مكان وضعها |
|---|---|---|---|
| `SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` | Supabase → Project Settings → API → Project URL | Environment Variables في Netlify أو بيئة Node/Hostinger |
| `SUPABASE_SERVICE_ROLE_KEY` | `PUT_YOUR_VALUE_HERE` | Supabase → Project Settings → API → service_role secret | الخادم فقط أو Netlify Function environment؛ ممنوع في المتصفح |
| `APP_ORIGIN` | `https://your-production-domain.example` | اسم الدومين النهائي | Netlify/Node environment؛ يجب أن يطابق أصل الواجهة |
| `NODE_ENV` | `production` | قيمة ثابتة | Netlify/Node environment |

يوجد ملف `.env.example` للتوثيق فقط. انسخ القيم إلى إعدادات الاستضافة، ولا تضعها داخل ملفات `client/` أو متغيرات `VITE_*`. لا تضع `SUPABASE_SERVICE_ROLE_KEY` في Git أو في JavaScript العام.

## 2. تطبيق قاعدة البيانات

1. أنشئ مشروع Supabase جديدًا أو استخدم المشروع المخصص للعميل.
2. افتح Supabase → SQL Editor.
3. نفّذ كامل `supabase/migrations/001_admin_security.sql` أولًا.
4. أنشئ حساب المدير من بيئة الخادم بعد ضبط المتغيرات عبر `pnpm admin:create`، أو استخدم الحساب الموجود إذا كان قد أُنشئ بالفعل.
5. نفّذ كامل `supabase/migrations/002_store_schema.sql` ثانيًا.
6. احتفظ بنسخة `supabase/REFERENCE_SCHEMA.sql` كمرجع؛ التعريف التنفيذي الكامل موجود في migration التجارية.
7. تحقق من الجداول: `admin_users`, `admin_sessions`, `audit_logs`, `categories`, `products`, `product_variants`, `orders`, `order_items`, `coupons`, `coupon_redemptions`, `store_settings`, `site_settings`, `uploads`.

## 3. إعداد Storage

1. افتح Storage → New bucket.
2. الاسم: `order-receipts`.
3. اجعل bucket خاصًا `Private`، وليس Public.
4. لا تضف سياسات رفع عامة. الرفع يتم عبر `/api/uploads/receipt` باستخدام الخادم.
5. الخادم يسمح فقط بـ `image/jpeg`, `image/png`, `image/webp` وبحجم أقصى 5MB، ويولّد اسمًا عشوائيًا.
6. الوصول الإداري إلى الإيصال يكون من خلال Signed URL قصيرة العمر، وليس رابطًا عامًا.
7. راجع حدود حجم الطلب في Netlify/Node قبل الإنتاج، ولا تسمح بامتدادات أو MIME أخرى.

## 4. تشغيل الحساب الإداري

- تسجيل الدخول: `POST /api/admin/login`.
- الجلسة Cookie من نوع HTTP-only وتُرسل مع `credentials: include`.
- تحقق من أن الحساب `is_active=true` وأن دوره `admin` للعمليات الحساسة.
- لا تنشئ كلمة المرور داخل الواجهة. استخدم `pnpm admin:create` من بيئة آمنة، ولا تسجل كلمة المرور في الطرفية أو Git.
- تحقق من `GET /api/admin/session` بعد تسجيل الدخول، ثم اختبر أن مستخدمًا غير مصادق يحصل على `401`.

## 5. تصدير البيانات المحلية

من لوحة الإدارة اختر `Export Data`. التصدير الحالي من الواجهة يحفظ نسخة JSON من مفاتيح localStorage التالية دون حذفها:

- `no-name-products`
- `no-name-settings`
- `no-name-sections`
- `no-name-pages`
- `no-name-coupons`
- `no-name-orders`
- `no-name-cart`

المنتجات الثابتة الموجودة في الكود داخل `StoreLayout.tsx` تُستخدم كـ fallback وتظهر ضمن حالة المتجر الحالية في حال عدم وجود نسخة localStorage، لكنها لا تُضاف تلقائيًا إلى payload API من زر التصدير الحالي إذا كانت localStorage خالية. لذلك يجب التأكد من أن `no-name-products` يحتوي المنتجات قبل التصدير، أو تجهيز ملف استيراد منسق وفق الشكل أدناه.

## 6. استيراد البيانات

1. سجّل دخول المدير.
2. اختر `Import Data`.
3. اختر JSON الإصدار 1.
4. يبقي المتجر localStorage ولا يمسحه تلقائيًا.
5. يحاول إرسال المنتجات والكوبونات إلى `/api/admin/import`، ويُجري upsert للبيانات المتوافقة مع مخطط Supabase.
6. لا يتم حذف سجلات قاعدة البيانات الموجودة تلقائيًا.
7. راجع رد API قبل اعتبار العملية ناجحة.

### شكل JSON المقبول في API الحالي

```json
{
  "version": 1,
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "products": [
    {
      "id": "dress-01",
      "name": "اسم المنتج بالعربية",
      "nameEn": "Product name",
      "numericPrice": 1990,
      "originalPrice": 2200,
      "salePrice": 1990,
      "category": "Dresses",
      "image": "https://example.com/image.jpg",
      "images": ["https://example.com/image.jpg"],
      "description": "وصف",
      "descriptionEn": "Description",
      "badge": "New",
      "tag": "جديد",
      "colors": ["#222222"],
      "sizes": ["S", "M", "L"],
      "stock": 12,
      "lowStockThreshold": 3,
      "video": ""
    }
  ],
  "settings": [
    { "key": "announcement", "value": "Free shipping" }
  ],
  "coupons": [
    { "code": "WELCOME", "discount": 10, "active": true }
  ]
}
```

الـ API الحالي لا يستقبل كائن `localStorage` كغلاف للاستيراد، ولا يرسل sections/pages/orders/cart إلى قاعدة البيانات. شكل `localStorage` الذي تصدره الواجهة صالح للحفظ والرجوع المحلي، لكنه يحتاج استخراج `localStorage.no-name-products` و`localStorage.no-name-coupons` وتحويل أسماء الحقول إلى `nameEn`, `numericPrice`, `lowStockThreshold` قبل استيراده إلى API. لا يوجد normalization تلقائي كامل للـ legacy data حاليًا؛ لا تعتبر الترحيل مكتملًا إلا بعد مراجعة رد الاستيراد والتحقق من الجداول.

## 7. التحقق بعد الترحيل

- `select count(*) from products;` يساوي عدد المنتجات المستوردة.
- افحص `products.id`, `name`, `price`, `category`, `stock` والصور.
- افحص `categories` و`product_variants`؛ variants القديمة لا تُنشأ تلقائيًا من مصفوفتَي `sizes` و`colors` في المنتج الحالي.
- افحص `store_settings` للمفاتيح `announcement`, `walletNumber`, `instapayNumber`, `salesWhatsappNumber`.
- افحص `coupons` وتأكد من `code`, `discount`, `active`.
- أنشئ طلب اختبار بـ COD، ثم افحص `orders` و`order_items` وانخفاض المخزون.
- ارفع إيصال اختبار غير حقيقي، افحص ظهوره داخل bucket الخاص، ثم احذف ملف الاختبار يدويًا.
- أعد استيراد نفس JSON وتأكد من عدم إنشاء duplicate بسبب مفاتيح المنتجات/الكوبونات.

## 8. API endpoints

### عامة

- `GET /api/products`: المنتجات النشطة.
- `GET /api/products/:id`: تفاصيل المنتج والـ variants.
- `GET /api/categories`: التصنيفات المستخرجة من المنتجات النشطة.
- `GET /api/site/settings`: الإعدادات العامة دون أسرار.
- `POST /api/orders`: إنشاء طلب؛ السعر والخصم والمخزون يحسبها الخادم.
- `GET /api/orders/:id`: ملخص الطلب عبر المعرف العام الحالي.
- `POST /api/uploads/receipt`: رفع إيصال.

### الإدارة

- `GET/POST /api/admin/products`.
- `PATCH/DELETE /api/admin/products/:id`.
- `POST /api/admin/products/:id/variants`.
- `PATCH/DELETE /api/admin/products/variants/:id`.
- `GET/PATCH /api/admin/orders` و`/api/admin/orders/:id`.
- `PUT /api/admin/settings`.
- `GET/POST/PATCH/DELETE /api/admin/coupons`.
- `GET /api/admin/export` لتصدير بيانات قاعدة البيانات الحالية.
- `POST /api/admin/import` لاستيراد JSON المتوافق.

كل المسارات الإدارية تتطلب جلسة مدير. المتوقع: `401` بدون جلسة، و`403` عند دور غير مسموح به.

## 9. SQL functions

- `public.set_updated_at()`: يحدّث `updated_at` قبل تعديل المنتجات أو الإعدادات.
- `public.create_store_order(payload jsonb)`: يتحقق من المنتجات والكميات، يقفل صفوف المنتجات، يحسب subtotal والخصم والإجمالي، يزيد استخدام الكوبون، ينقص المخزون، وينشئ الطلب وعناصره ضمن عملية PostgreSQL واحدة تقريبًا، مع منع التكرار عبر `idempotency_key`.

## 10. Functions الربط البرمجية

### `server/db.ts`

- `getSupabaseConfig()`: يقرأ إعدادات الخادم فقط.
- `supabaseRequest()`: طلبات PostgREST المركزية ومعالجة أخطاء Supabase.
- `supabaseRpc()`: استدعاء PostgreSQL RPC.
- `createSignedStorageUrl()`: إنشاء Signed URL.
- `serviceUnavailable()`: تمييز غياب إعداد Supabase.

### `client/lib/api.ts`

هذه الطبقة API boundary فقط؛ لا تحسب الأسعار أو الخصومات أو المخزون. تحتوي على استدعاءات المنتجات والتصنيفات والإعدادات والطلب والرفع وعمليات الإدارة والاستيراد والتصدير.

## 11. التشغيل المحلي

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

ضع القيم في `.env` محليًا، ولا ترفع الملف. إذا لم تضبط Supabase سيستمر fallback المحلي للواجهة، لكن API التجاري لن يعمل.

## 12. Netlify

1. اربط المستودع بالموقع.
2. Build command: `pnpm build:client`.
3. Publish directory: `dist/spa`.
4. Functions directory: `netlify/functions`.
5. أضف `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ORIGIN`, `NODE_ENV=production` في Site configuration → Environment variables.
6. لا تضع service-role في متغير public أو client build.
7. تحقق أن redirect `/api/*` يأتي قبل `/*` في `netlify.toml`.
8. اختبر `/shop`, `/product/dress-01`, `/checkout`, `/admin/login` بالفتح المباشر.

## 13. Express/Node/Hostinger

1. ثبّت Node 22 وPNPM.
2. ارفع المستودع دون `.env` أو ملفات receipts.
3. اضبط متغيرات البيئة الأربع في مدير العمليات أو لوحة Hostinger.
4. نفّذ `pnpm install --frozen-lockfile && pnpm build`.
5. شغّل `pnpm start` خلف HTTPS وReverse Proxy.
6. اجعل `APP_ORIGIN` هو دومين الواجهة الحقيقي.
7. لا تعرض منفذ Node مباشرة إن كان Reverse Proxy متاحًا.

## 14. التحقق النهائي قبل التسليم

- [ ] تم تدوير service-role key ولم يظهر في Git أو bundle.
- [ ] تم تطبيق migration 001 ثم 002.
- [ ] تم إنشاء bucket خاص `order-receipts`.
- [ ] تم إنشاء حساب المدير واختبار الجلسة.
- [ ] المنتجات والتصنيفات والأسعار والمخزون صحيحة.
- [ ] variants والكوبونات والإعدادات راجعتها يدويًا.
- [ ] الطلب يعيد الحساب من الخادم وليس من total العميل.
- [ ] الطلب المكرر بنفس idempotency key لا يخصم المخزون مرتين.
- [ ] الكمية الأكبر من المخزون مرفوضة.
- [ ] رفع MIME غير مسموح أو ملف أكبر من 5MB مرفوض.
- [ ] الإيصال غير متاح كرابط عام.
- [ ] عمليات الإدارة بدون جلسة تعيد 401.
- [ ] المسارات المباشرة لا تعطي 404 على Netlify.
- [ ] تم تشغيل `pnpm typecheck`, `pnpm test`, `pnpm build`.
- [ ] تم الاحتفاظ بملف export الأصلي وعدم مسح localStorage قبل التحقق.
- [ ] تمت مراجعة القيود الموثقة في `PROJECT_HANDOFF.md` قبل تسليم العميل.
