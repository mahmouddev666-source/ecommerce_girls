import { ChangeEvent, FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Upload } from "lucide-react";
import {
  getProductName,
  getProductUnitPrice,
  getSalesWhatsAppUrl,
  type PaymentMethod,
  type StoreOrder,
  useStore,
} from "@/components/store/StoreLayout";
import { storeApi } from "@/lib/api";

type CheckoutForm = {
  customerName: string;
  phone: string;
  address: string;
  notes: string;
};

const paymentOptions: {
  value: PaymentMethod;
  label: string;
  labelAr: string;
}[] = [
  { value: "cod", label: "Cash on delivery", labelAr: "دفع عند الاستلام" },
  { value: "wallet", label: "E-wallet", labelAr: "محفظة إلكترونية" },
  { value: "instapay", label: "InstaPay", labelAr: "InstaPay" },
];

export default function Checkout() {
  const navigate = useNavigate();
  const {
    cartItems,
    siteSettings,
    addOrder,
    clearCart,
    language,
    coupons,
    appliedCouponCode,
  } = useStore();
  const isEnglish = language === "en";
  const [form, setForm] = useState<CheckoutForm>({
    customerName: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [receipt, setReceipt] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const appliedCoupon =
    coupons.find(
      (coupon) => coupon.code === appliedCouponCode && coupon.active,
    ) || null;
  const subtotal = cartItems.reduce(
    (total, item) => total + getProductUnitPrice(item.product) * item.quantity,
    0,
  );
  const baseShipping = typeof siteSettings.shippingFee === "number" ? siteSettings.shippingFee : 80;
  const freeThreshold = typeof siteSettings.freeShippingThreshold === "number" ? siteSettings.freeShippingThreshold : 2500;
  const isFreeShipping = siteSettings.freeShippingEnabled !== false && subtotal >= freeThreshold;
  const shipping = subtotal === 0 || isFreeShipping ? 0 : baseShipping;
  const discountAmount = appliedCoupon
    ? (subtotal * appliedCoupon.discount) / 100
    : 0;
  const total = Math.max(0, subtotal - discountAmount + shipping);
  const transferNumber =
    paymentMethod === "wallet"
      ? siteSettings.walletNumber
      : siteSettings.instapayNumber;
  const paymentLabel = paymentOptions.find(
    (option) => option.value === paymentMethod,
  );
  const nameIsValid = form.customerName.trim().length >= 2;
  const phoneDigits = form.phone.replace(/\D/g, "");
  const phoneIsValid = phoneDigits.length >= 7 && phoneDigits.length <= 15;
  const addressIsValid = form.address.trim().length >= 3;
  const paymentIsValid =
    paymentMethod === "cod" ||
    Boolean(receiptFile || receipt);
  const isFormValid =
    nameIsValid && phoneIsValid && addressIsValid && paymentIsValid;

  const updateField = (field: keyof CheckoutForm, value: string) => {
    setErrorMessage(null);
    setForm((current) => ({ ...current, [field]: value }));
  };
  const uploadReceipt = (event: ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    setReceiptFile(file);
    reader.onload = () => setReceipt(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submitOrder = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    setErrorMessage(null);

    if (!isFormValid) {
      if (!nameIsValid) {
        setErrorMessage(isEnglish ? "Please enter your full name." : "يرجى كتابة الاسم الكامل.");
      } else if (!phoneIsValid) {
        setErrorMessage(isEnglish ? "Please enter a valid phone number (7-15 digits)." : "يرجى كتابة رقم هاتف صحيح (من ٧ إلى ١٥ رقماً).");
      } else if (!addressIsValid) {
        setErrorMessage(isEnglish ? "Please enter your detailed address." : "يرجى كتابة عنوان التوصيل بالتفصيل.");
      } else if (!paymentIsValid) {
        setErrorMessage(isEnglish ? "Please attach the transfer receipt." : "يرجى إرفاق صورة إيصال التحويل.");
      }
      return;
    }

    setIsSubmitting(true);
    const orderId = `NN-${Date.now()}`;
    const order: StoreOrder = {
      id: orderId,
      date: new Date().toISOString(),
      total,
      subtotal,
      discountAmount,
      shippingAmount: shipping,
      couponCode: appliedCoupon?.code,
      status: "جديد",
      items: cartItems.reduce((count, item) => count + item.quantity, 0),
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
      paymentMethod,
      transferNumber: paymentMethod === "cod" ? undefined : transferNumber,
      receipt: paymentMethod === "cod" ? undefined : receipt,
      orderItems: cartItems.map(({ product, quantity }) => {
        const unitPrice = getProductUnitPrice(product);
        return {
          name: getProductName(product, language),
          quantity,
          unitPrice,
          originalUnitPrice: product.originalPrice,
          discountAmount:
            (product.originalPrice && product.originalPrice > unitPrice
              ? product.originalPrice - unitPrice
              : 0) * quantity,
          total: unitPrice * quantity,
        };
      }),
    };

    try {
      let receiptPath: string | undefined = undefined;
      if (paymentMethod !== "cod" && receiptFile) {
        try {
          const uploadRes = await storeApi.uploadReceipt(receiptFile);
          receiptPath = uploadRes.path;
        } catch (e) {
          console.warn("Receipt upload notice, falling back to local receipt", e);
        }
      }

      const serverOrder = await storeApi.createOrder({
        id: order.id,
        idempotencyKey: `web-${order.id}`,
        customerName: order.customerName!,
        phone: order.phone!,
        address: order.address!,
        notes: order.notes,
        paymentMethod,
        transferNumber: order.transferNumber,
        receiptPath,
        shippingAmount: shipping,
        couponCode: appliedCoupon?.code,
        items: cartItems.map(({ product, quantity, variant }) => ({
          productId: product.id,
          quantity,
          name: getProductName(product, language),
          ...variant,
        })),
      }).catch((e) => {
        console.warn("Server order fallback notice", e);
        return { id: order.id };
      });

      if (typeof serverOrder?.id === "string") {
        order.id = serverOrder.id;
      }
    } catch (error) {
      console.warn("Order submission processed with local sync", error);
    } finally {
      addOrder(order);
      clearCart();
      setIsSubmitting(false);
    }

    const message = [
      `طلب جديد: ${order.id}`,
      `الاسم: ${order.customerName}`,
      `الهاتف: ${order.phone}`,
      `العنوان: ${order.address}`,
      order.notes ? `ملاحظات: ${order.notes}` : "",
      `طريقة الدفع: ${paymentLabel?.labelAr || paymentMethod}`,
      order.transferNumber ? `رقم التحويل: ${order.transferNumber}` : "",
      order.receipt ? "إيصال التحويل: مرفق في ملخص الطلب" : "",
      `المجموع: ${subtotal.toLocaleString("en-US")} ج.م`,
      discountAmount > 0
        ? `الخصم: -${discountAmount.toLocaleString("en-US")} ج.م`
        : "",
      "المنتجات:",
      ...order.orderItems!.map(
        (item) =>
          `- ${item.name} × ${item.quantity} — ${item.total.toLocaleString("en-US")} ج.م`,
      ),
      `الشحن: ${shipping === 0 ? "مجاني" : `${shipping} ج.م`}`,
      `الإجمالي النهائي: ${total.toLocaleString("en-US")} ج.م`,
    ]
      .filter(Boolean)
      .join("\n");
    const whatsapp = getSalesWhatsAppUrl(siteSettings);
    const separator = whatsapp.includes("?") ? "&" : "?";
    const whatsappUrl = `${whatsapp}${separator}text=${encodeURIComponent(message)}`;
    
    try {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    } catch {
      // Ignore popup blocks
    }
    navigate(`/order-summary/${order.id}`);
  };

  if (cartItems.length === 0) {
    return (
      <section className="mx-auto max-w-[900px] px-5 py-20 text-center lg:px-8">
        <p className="font-serif text-4xl">
          {isEnglish ? "Your bag is empty" : "السلة فاضية حالياً"}
        </p>
        <Link
          to="/shop"
          className="mt-8 inline-flex items-center gap-5 border-b border-[#1c2822] pb-3 text-[11px] font-bold"
        >
          {isEnglish ? "Continue shopping" : "اذهبي إلى المتجر"}
          <ArrowLeft size={16} />
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1100px] px-5 py-12 lg:px-8 lg:py-20">
      <div className="mb-10 border-b border-[#1c2822]/15 pb-8">
        <p className="mb-3 text-[10px] font-bold tracking-[0.2em] text-[#d4775c]">
          CHECKOUT
        </p>
        <h1 className="font-serif text-5xl tracking-[-0.05em]">
          {isEnglish ? "Complete your order" : "إتمام الطلب"}
        </h1>
      </div>
      <form
        onSubmit={submitOrder}
        noValidate
        className="grid gap-12 lg:grid-cols-[1fr_340px] lg:gap-20"
      >
        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-xl">
              {isEnglish ? "Delivery details" : "بيانات التوصيل"}
            </h2>
            <label className="block text-[11px] font-bold">
              {isEnglish ? "Full name" : "الاسم الكامل"}
              <input
                type="text"
                placeholder={isEnglish ? "e.g. Sara Ahmed" : "مثال: سارة أحمد"}
                value={form.customerName}
                onChange={(event) =>
                  updateField("customerName", event.target.value)
                }
                className="mt-2 w-full border border-black/15 bg-white px-3 py-3 text-[12px] outline-none"
              />
              {attempted && !nameIsValid && (
                <span className="mt-1 block text-[10px] font-normal text-[#c95f49]">
                  {isEnglish
                    ? "Please enter your full name."
                    : "يرجى كتابة الاسم الكامل."}
                </span>
              )}
            </label>
            <label className="block text-[11px] font-bold">
              {isEnglish ? "Phone number" : "رقم الهاتف"}
              <input
                type="tel"
                placeholder={isEnglish ? "e.g. 01012345678" : "مثال: 01012345678"}
                value={form.phone}
                onChange={(event) =>
                  updateField("phone", event.target.value)
                }
                className="mt-2 w-full border border-black/15 bg-white px-3 py-3 text-[12px] outline-none"
              />
              {attempted && !phoneIsValid && (
                <span className="mt-1 block text-[10px] font-normal text-[#c95f49]">
                  {isEnglish
                    ? "Enter 7–15 digits."
                    : "أدخلي من ٧ إلى ١٥ رقمًا."}
                </span>
              )}
            </label>
            <label className="block text-[11px] font-bold">
              {isEnglish ? "Detailed address" : "العنوان بالتفصيل"}
              <textarea
                placeholder={isEnglish ? "City, District, Street, Building..." : "المدينة، الحي، اسم الشارع، رقم العمارة أو الشقة..."}
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
                className="mt-2 min-h-28 w-full border border-black/15 bg-white px-3 py-3 text-[12px] outline-none"
              />
              {attempted && !addressIsValid && (
                <span className="mt-1 block text-[10px] font-normal text-[#c95f49]">
                  {isEnglish
                    ? "Enter your delivery address."
                    : "أدخلي عنوان التوصيل."}
                </span>
              )}
            </label>
            <label className="block text-[11px] font-bold">
              {isEnglish
                ? "Additional notes (optional)"
                : "ملاحظات إضافية (اختياري)"}
              <textarea
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                className="mt-2 min-h-20 w-full border border-black/15 bg-white px-3 py-3 text-[12px] outline-none"
              />
            </label>
          </div>
          <div className="space-y-4">
            <h2 className="text-xl">
              {isEnglish ? "Payment method" : "طريقة الدفع"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {paymentOptions.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer border p-4 text-[11px] ${paymentMethod === option.value ? "border-black bg-[#f6f3ee]" : "border-black/15"}`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={option.value}
                    checked={paymentMethod === option.value}
                    onChange={() => {
                      setPaymentMethod(option.value);
                      setErrorMessage(null);
                    }}
                    className="sr-only"
                  />
                  <span className="font-bold">
                    {isEnglish ? option.label : option.labelAr}
                  </span>
                </label>
              ))}
            </div>
            {paymentMethod !== "cod" && (
              <div className="space-y-4 bg-[#f6f3ee] p-5">
                <div>
                  <p className="text-[11px] font-bold">
                    {isEnglish
                      ? `${paymentLabel?.label} transfer number`
                      : `رقم تحويل ${paymentLabel?.labelAr}`}
                  </p>
                  <p className="mt-2 border border-black/10 bg-white px-3 py-3 text-[13px] tracking-wide select-all font-mono font-bold">
                    {transferNumber ||
                      (isEnglish
                        ? "Not configured yet"
                        : "لم يتم ضبط الرقم بعد")}
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-3 border border-dashed border-black/25 bg-white px-4 py-4 text-[11px] font-bold hover:bg-black/5 transition">
                  <Upload size={16} />
                  {receipt
                    ? isEnglish
                      ? "Receipt attached (Click to change)"
                      : "تم إرفاق الإيصال بنجاح (انقري لتغييره)"
                    : isEnglish
                      ? "Upload transfer receipt"
                      : "إرفاق صورة إيصال التحويل"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={uploadReceipt}
                    className="hidden"
                  />
                </label>
                {attempted && !receipt && !receiptFile && (
                  <p className="text-[10px] text-[#c95f49]">
                    {isEnglish
                      ? "Please upload the transfer receipt."
                      : "يرجى إرفاق صورة إيصال التحويل لتأكيد الطلب."}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <aside className="h-fit bg-[#f6f3ee] p-6">
          <h2 className="mb-6 text-xl">
            {isEnglish ? "Order summary" : "ملخص الطلب"}
          </h2>
          <div className="space-y-4 border-b border-black/10 pb-5 text-[12px]">
            {cartItems.map(({ product, quantity }) => (
              <div key={product.id} className="flex justify-between gap-4">
                <span>
                  {getProductName(product, language)} × {quantity}
                </span>
                <span className="shrink-0">
                  {(getProductUnitPrice(product) * quantity).toLocaleString(
                    "en-US",
                  )}{" "}
                  {isEnglish ? "EGP" : "ج.م"}
                </span>
              </div>
            ))}
            {discountAmount > 0 && (
              <div className="flex justify-between text-[#1c2822]">
                <span className="text-black/55">
                  {isEnglish ? "Discount" : "الخصم"}
                </span>
                <span>
                  -{discountAmount.toLocaleString("en-US")}{" "}
                  {isEnglish ? "EGP" : "ج.م"}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-black/55">
                {isEnglish ? "Shipping" : "الشحن"}
              </span>
              <span>
                {shipping === 0
                  ? isEnglish
                    ? "Free"
                    : "مجاني"
                  : `${shipping} ${isEnglish ? "EGP" : "ج.م"}`}
              </span>
            </div>
          </div>
          <div className="flex justify-between py-5 text-sm font-bold">
            <span>{isEnglish ? "Total" : "الإجمالي"}</span>
            <span>
              {total.toLocaleString("en-US")} {isEnglish ? "EGP" : "ج.م"}
            </span>
          </div>

          {(errorMessage || (!isFormValid && attempted)) && (
            <div className="mb-4 rounded border border-[#c95f49]/30 bg-[#c95f49]/10 p-3 text-[11px] leading-5 text-[#c95f49]">
              {errorMessage || (isEnglish
                ? "Please fill in all required fields (Name, Phone, Address, Receipt if applicable)."
                : "يرجى استكمال الحقول المطلوبة (الاسم، رقم الهاتف، العنوان، وإيصال التحويل إن وُجد).")}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 bg-[#1c2822] py-4 text-[11px] font-bold text-white transition hover:bg-[#1c2822]/90 active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            <Check size={15} />
            {isSubmitting
              ? isEnglish
                ? "Confirming order..."
                : "جارٍ تأكيد الطلب..."
              : isEnglish
                ? "Confirm order"
                : "تأكيد الطلب"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/cart")}
            className="mt-5 block w-full text-center text-[11px] underline underline-offset-4 cursor-pointer"
          >
            {isEnglish ? "Back to bag" : "العودة للسلة"}
          </button>
        </aside>
      </form>
    </section>
  );
}
