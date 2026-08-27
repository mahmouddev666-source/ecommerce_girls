/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

export interface ProductRecord {
  id: string;
  name: string;
  name_en?: string;
  price: number;
  original_price?: number;
  sale_price?: number;
  category: string;
  image: string;
  images?: string[];
  description?: string;
  description_en?: string;
  badge?: string;
  tag?: string;
  colors?: string[];
  sizes?: string[];
  video?: string;
  stock?: number;
  low_stock_threshold?: number;
  is_active?: boolean;
}

export interface SiteSettingsRecord { key: string; value: unknown }
export interface CategoryRecord { label: string; image?: string }
export interface CartRequestItem { productId: string; variantId?: string; quantity: number; name?: string; size?: string; color?: string }
export interface CreateOrderRequest {
  id?: string;
  idempotencyKey: string;
  customerName: string;
  phone: string;
  address: string;
  notes?: string;
  paymentMethod: "cod" | "wallet" | "instapay";
  transferNumber?: string;
  receiptPath?: string;
  shippingAmount: number;
  couponCode?: string;
  items: CartRequestItem[];
}
export interface OrderRecord { id: string; date?: string; created_at?: string; total?: number; [key: string]: unknown }
export interface UploadReceiptResponse { path: string }
export interface ImportStoreRequest { products?: Record<string, unknown>[]; settings?: SiteSettingsRecord[]; coupons?: Record<string, unknown>[] }
export interface ImportStoreResponse { imported: { products: number; settings: number; coupons: number } }
