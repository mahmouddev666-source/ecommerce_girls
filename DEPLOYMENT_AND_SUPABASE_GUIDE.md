# No Name Store - دليل الربط، المزامنة، والنشر المباشر (Supabase, Netlify, Hostinger)

تم تجهيز هذا المستند ليوضح لك خطوة بخطوة كيفية مزامنة البيانات الحالية إلى Supabase، وكيفية نشر المتجر على Netlify أو Hostinger بنجاح تام وبأعلى معايير الأمان والسرعة.

---

## 1. كيف تسحب وترفع البيانات الحالية إلى Supabase الآن؟

إذا كنت قد قمت بتعديل أو إضافة أي منتجات أو إعدادات وتريد رفعها أو مزامنتها مباشرة إلى قاعدة بيانات Supabase:

### الطريقة الأولى: من لوحة التحكم مباشرة بنقرة واحدة (أسهل وأسرع طريقة)
1. افتحي لوحة التحكم `/admin`.
2. في الشريط العلوي، ستجدين زر **"تصدير البيانات" (Export local data)** اضغطي عليه لتحميل ملف `no-name-local-export.json`.
3. اضغطي على زر **"مزامنة الكل مع Supabase" (Sync to Supabase)** الموجود في الترويسة العلوية بجانب أزرار التصدير. سيقوم المتجر تلقائياً بقراءة كافة المنتجات، الكوبونات، وإعدادات المتجر وحفظها في قاعدة البيانات السحابية فوراً.
4. أو يمكنك الضغط على **"استيراد JSON" (Import JSON)** واختيار الملف الذي قمتِ بتصديره ليتم إدخاله ودمجه مباشرة في قاعدة البيانات.

### الطريقة الثانية: عبر تنفيذ ملف الـ SQL الموحد (أسرع وأشمل طريقة)
1. ادخلي إلى حسابك في **Supabase** وافتحي مشروعك.
2. توجهي إلى قائمة **SQL Editor** ثم اضغطي على **New Query**.
3. افتحي ملف `supabase/ALL_IN_ONE_SETUP.sql` وانسخي محتواه بالكامل والصقيه في المحرر ثم اضغطي **Run**.
4. سينشئ هذا الملف كل شيء فورياً:
   - جداول الأمان وحساب الأدمن الافتراضي: **`admin`** / **`admin123`**.
   - جداول المتجر: `products`, `store_settings`, `orders`, `order_items`, `coupons`, `categories`.
   - الصلاحيات والدوال التلقائية للطلبات وتحديث الأسعار والمخزون.

---

## 2. توضيح ملفات الـ SQL الثلاثة (هل هي مرتبطة ببعضها؟)
نعم، الملفات الثلاثة في مجلد `supabase/migrations` هي ملفات تتابعية (Migrations):
- **`001_admin_security.sql`**: مسؤول عن جداول الأدمن وجلسات تسجيل الدخول والصلاحيات وحساب المشرف الافتراضي.
- **`002_store_schema.sql`**: مسؤول عن جداول التجارة (المنتجات، الأقسام، الطلبات، الكوبونات، الإعدادات).
- **`003_authoritative_commerce.sql`**: يضيف تحسينات إضافية على أرقام التتبع والطلبات ومفاتيح التحقق.

💡 **لتسهيل الأمر عليك بنسبة 100%:** قمنا بدمج وترتيب هذه الملفات الثلاثة في ملف موحد جاهز للتنفيذ بضغطة واحدة:
👉 **`supabase/ALL_IN_ONE_SETUP.sql`** (شغل هذا الملف فقط وستحصل على كل شيء جاهزاً فوراً مع حساب الأدمن).

---

## 2. التحقق من الاتصال وربط المتغيرات البيئية (Environment Variables)

لضمان عمل الخادم مع Supabase، تأكدي من ضبط المتغيرات التالية في بيئة التشغيل أو ملف `.env`:

```env
# رابط مشروع Supabase الخاص بك
SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co

# المفتاح السري للخادم (Service Role Key) - لا يتم عرضه للمتصفح أبداً
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# مفتاح تشفير جلسات الأدمن (JWT/Session Secret)
ADMIN_JWT_SECRET=super_secret_secure_random_key_here_32_chars
```

> **ملاحظة:** في حالة عدم ضبط Supabase في بيئة المعاينة (Preview)، يعمل المتجر تلقائياً بنظام المحاكاة الذكي (In-Memory Failover) حتى لا يتوقف المتجر مطلقاً.

---

## 3. خطوات النشر على Netlify (خطوة بخطوة)

Netlify يدعم استضافة التطبيق كـ SPA فائق السرعة عبر شبكة الـ CDN العالمية:

1. **بناء المشروع محلياً أو عبر Git:**
   - أمر البناء (Build Command): `pnpm build` أو `npm run build`
   - مجلد المخرجات (Publish Directory): `dist`
2. **إعداد مسارات الـ SPA (Redirects):**
   - ملف `public/_redirects` أو `netlify.toml` يحتوي على:
     ```toml
     [[redirects]]
       from = "/*"
       to = "/index.html"
       status = 200
     ```
3. **ضبط متغيرات البيئة في Netlify:**
   - ادخلي على **Site Settings** > **Environment Variables** وأضيفي المتغيرات الخاصة بـ Supabase.

---

## 4. خطوات النشر على Hostinger (Web Hosting / VPS)

### الخيار (أ): استضافة عادية (Shared / Cloud Hosting عبر cPanel أو hPanel)
1. قومي بتشغيل الأمر:
   ```bash
   pnpm build
   ```
2. ادخلي إلى **File Manager** في لوحة تحكم Hostinger.
3. افتحي مجلد `public_html`.
4. ارفعي جميع الملفات الموجودة داخل مجلد `dist` إلى `public_html`.
5. تأكدي من وجود ملف `.htaccess` داخل `public_html` لضمان عمل React Router وإعادة التوجيه لصفحات المنتجات وإتمام الطلب:
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

### الخيار (ب): استضافة VPS / Node.js
1. رفع المشروع كاملاً إلى السيرفر.
2. تشغيل الأمر `pnpm install` ثم `pnpm build`.
3. تشغيل الخادم عبر PM2:
   ```bash
   pm2 start dist/server.cjs --name "noname-store"
   ```
4. توجيه النطاق عبر Nginx Reverse Proxy إلى المنفذ 3000 أو 8080.

---

## 5. اختبار الأزرار وعملية إتمام الطلب (Checkout Verified)
- تم فحص زر **"تأكيد الطلب" (Confirm Order)** والتأكد من استجابته الفورية:
  - يقبل الضغط في جميع الحالات ويقوم بالتحقق السلس من صحة الحقول (الاسم، الهاتف، العنوان، الإيصال).
  - يرسل رسالة تفصيلية فورية للطلب مع رابط الواتساب الرسمي للمبيعات ويحفظ الطلب فورياً في قاعدة البيانات.
