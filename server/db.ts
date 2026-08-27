export type SupabaseConfig = { url: string; serviceRoleKey: string };

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase is not configured");
  return { url, serviceRoleKey };
}

export class SupabaseError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}

export async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new SupabaseError(response.status, `Supabase request failed (${response.status})`, details);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function supabaseRpc<T>(name: string, payload: Record<string, unknown>): Promise<T> {
  return supabaseRequest<T>(`rpc/${encodeURIComponent(name)}`, { method: "POST", body: JSON.stringify(payload) });
}

export async function createSignedStorageUrl(bucket: string, path: string, expiresIn = 3600) {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const response = await fetch(`${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST", headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn }),
  });
  if (!response.ok) throw new SupabaseError(response.status, "Unable to sign storage URL", await response.text().catch(() => ""));
  const result = await response.json() as { signedURL?: string; signedUrl?: string };
  return `${url}/storage/v1${result.signedURL || result.signedUrl || ""}`;
}

export function encodeQuery(value: string) { return encodeURIComponent(value); }
export function serviceUnavailable(error: unknown) { return error instanceof Error && error.message === "Supabase is not configured"; }
