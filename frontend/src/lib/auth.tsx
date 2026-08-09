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
    // Real Google OAuth isn't configured yet — never fabricate a fake
    // account (previously this logged everyone in as "Alex Kumar").
    throw new ApiError(400, "Google sign-in is not set up yet. Use email sign-in for now.");
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
