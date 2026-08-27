import type { CreateOrderRequest, ImportStoreRequest, ImportStoreResponse, ProductRecord, UploadReceiptResponse } from "@shared/api";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `Request failed (${response.status})`);
  return response.status === 204 ? (undefined as T) : response.json();
};

export const storeApi = {
  products: () => request<ProductRecord[]>("/api/products"),
  categories: () => request<Array<{ label: string; image?: string }>>("/api/categories"),
  settings: () => request<Record<string, unknown>>("/api/site/settings").catch(() => request<Record<string, unknown>>("/api/settings")),
  createOrder: (payload: CreateOrderRequest) => request<Record<string, unknown>>("/api/orders", { method: "POST", body: JSON.stringify(payload) }),
  order: (id: string) => request<Record<string, unknown>>(`/api/orders/${encodeURIComponent(id)}`),
  uploadReceipt: async (file: File): Promise<UploadReceiptResponse> => {
    const body = new FormData(); body.append("file", file);
    const response = await fetch("/api/uploads", { method: "POST", credentials: "include", body });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Receipt upload failed");
    return response.json();
  },
  admin: {
    products: () => request<ProductRecord[]>("/api/admin/products"),
    createProduct: (product: unknown) => request<unknown>("/api/admin/products", { method: "POST", body: JSON.stringify(product) }),
    updateProduct: (id: string, product: unknown) => request<unknown>(`/api/admin/products/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(product) }),
    deleteProduct: (id: string) => request<void>(`/api/admin/products/${encodeURIComponent(id)}`, { method: "DELETE" }),
    settings: (key: string, value: unknown) => request<unknown>("/api/admin/settings", { method: "PUT", body: JSON.stringify({ key, value }) }),
    coupons: () => request<unknown[]>("/api/admin/coupons"),
    createCoupon: (coupon: unknown) => request<unknown>("/api/admin/coupons", { method: "POST", body: JSON.stringify(coupon) }),
    deleteCoupon: (code: string) => request<void>(`/api/admin/coupons/${encodeURIComponent(code)}`, { method: "DELETE" }),
    orders: () => request<unknown[]>("/api/admin/orders"),
    updateOrder: (id: string, status: string) => request<unknown>(`/api/admin/orders/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    export: async () => { const response = await fetch("/api/admin/export", { credentials: "include" }); if (!response.ok) throw new Error("Export failed"); return response.blob(); },
    import: (payload: ImportStoreRequest) => request<ImportStoreResponse>("/api/admin/import", { method: "POST", body: JSON.stringify(payload) }),
  },
};
