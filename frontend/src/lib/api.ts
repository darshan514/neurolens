// HTTP client for the FastAPI backend.
// Every call degrades gracefully: callers fall back to the local demo
// layer when the API is unreachable, so the app always works.

const TOKEN_KEY = "nl_token";
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ""; // "" -> same origin /api (Vite proxy)

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = false } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (!token) throw new ApiError(401, "Not authenticated");
    headers["Authorization"] = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Network error — API unreachable");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      if (typeof j.detail === "string") detail = j.detail;
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

let healthCache: { ok: boolean; at: number } | null = null;

/** Cheap availability probe (cached 30s) used to pick API vs demo paths. */
export async function isApiAvailable(): Promise<boolean> {
  if (healthCache && Date.now() - healthCache.at < 30_000) return healthCache.ok;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${BASE}/api/health`, { signal: ctrl.signal });
    clearTimeout(t);
    healthCache = { ok: res.ok, at: Date.now() };
  } catch {
    healthCache = { ok: false, at: Date.now() };
  }
  return healthCache.ok;
}

export function invalidateHealth(): void {
  healthCache = null;
}
