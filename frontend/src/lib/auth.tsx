import { createContext, useContext, useState, type ReactNode } from "react";
import type { AppUser } from "./types";
import { apiRequest, setToken, getToken, isApiAvailable, invalidateHealth, ApiError } from "./api";

const STORAGE_KEY = "nl_user";

interface AuthCtx {
  user: AppUser | null;
  backend: boolean;
  login: (email: string, password: string) => Promise<AppUser>;
  loginWithGoogle: () => Promise<AppUser>;
  register: (name: string, email: string, password: string, role: AppUser["role"]) => Promise<AppUser>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: string;
  height_cm?: number;
  preferred_language?: string;
}

interface TokenResponse {
  access_token: string;
  user: ApiUser;
}

function toAppUser(u: ApiUser): AppUser {
  return {
    id: String(u.id),
    name: u.name,
    email: u.email,
    role: (u.role as AppUser["role"]) || "patient",
    heightCm: u.height_cm ?? 170,
    preferredLanguage: u.preferred_language ?? "en",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AppUser;
      // Drop stale demo sessions (e.g. the old hardcoded "Alex Kumar" login)
      // so users are never silently restored into a fake account.
      if (parsed.id === "u_demo" || parsed.id.startsWith("demo-")) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const persist = (u: AppUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
    return u;
  };

  const login = async (email: string, password: string) => {
    if (await isApiAvailable()) {
      const res = await apiRequest<TokenResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setToken(res.access_token);
      return persist(toAppUser(res.user));
    }
    throw new ApiError(0, "Server is unreachable — please try again in a moment.");
  };

  const loginWithGoogle = async () => {
    // Real Google OAuth via Google Identity Services when a client ID is
    // configured (VITE_GOOGLE_CLIENT_ID). Without it, report clearly.
    const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";
    if (!clientId) {
      throw new ApiError(400, "Google sign-in is not configured yet. Use email sign-in for now.");
    }

    // Load GIS only when actually needed.
    if (!(window as unknown as { google?: { accounts: { id: unknown } } }).google?.accounts?.id) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new ApiError(0, "Could not load Google sign-in."));
        document.head.appendChild(s);
      });
    }

    const token = await new Promise<string>((resolve, reject) => {
      const w = window as unknown as {
        google?: {
          accounts: {
            id: {
              initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void;
              renderButton: (el: HTMLElement, opts: { theme: string; size: string }) => void;
              prompt: () => void;
            };
          };
        };
      };
      const id = w.google?.accounts?.id;
      if (!id) {
        reject(new ApiError(0, "Google sign-in failed to load."));
        return;
      }
      id.initialize({
        client_id: clientId,
        callback: (r) => resolve(r.credential),
      });
      id.prompt();
      // GIS popup may not resolve; give the user a clear timeout rather
      // than hanging forever.
      setTimeout(() => reject(new ApiError(400, "Google sign-in timed out — try again.")), 60_000);
    });

    const res = await apiRequest<TokenResponse>("/auth/google", {
      method: "POST",
      body: { google_id_token: token, name: undefined },
    });
    setToken(res.access_token);
    return persist(toAppUser(res.user));
  };

  const register = async (name: string, email: string, password: string, role: AppUser["role"]) => {
    if (await isApiAvailable()) {
      const res = await apiRequest<TokenResponse>("/auth/register", {
        method: "POST",
        body: { name, email, password, role },
      });
      setToken(res.access_token);
      return persist(toAppUser(res.user));
    }
    throw new ApiError(0, "Server is unreachable — please try again in a moment.");
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, backend: !!getToken(), login, loginWithGoogle, register, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
