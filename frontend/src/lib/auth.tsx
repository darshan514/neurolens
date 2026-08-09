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
      return raw ? (JSON.parse(raw) as AppUser) : null;
    } catch {
      return null;
    }
  });

  const persist = (u: AppUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
    return u;
  };

  const demoUser = (email: string, role: AppUser["role"] = "patient"): AppUser => {
    const name = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return { id: "u_demo", name, email, role, heightCm: 170, preferredLanguage: "en" };
  };

  const login = async (email: string, password: string) => {
    if (await isApiAvailable()) {
      try {
        const res = await apiRequest<TokenResponse>("/auth/login", {
          method: "POST",
          body: { email, password },
        });
        setToken(res.access_token);
        return persist(toAppUser(res.user));
      } catch (err) {
        // A real API rejection (wrong password, unknown account) is an error,
        // not a reason to silently log the user into demo mode.
        if (err instanceof ApiError && err.status !== 0) throw err;
        console.warn("API login failed, using demo mode:", err);
        invalidateHealth();
      }
    }
    await new Promise((r) => setTimeout(r, 500));
    return persist(demoUser(email));
  };

  const loginWithGoogle = async () => {
    if (await isApiAvailable()) {
      try {
        const res = await apiRequest<TokenResponse>("/auth/google", {
          method: "POST",
          body: { google_id_token: `demo-${Date.now()}`, name: "Alex Kumar" },
        });
        setToken(res.access_token);
        return persist(toAppUser(res.user));
      } catch (err) {
        if (err instanceof ApiError && err.status !== 0) throw err;
        console.warn("Google login failed, using demo mode:", err);
        invalidateHealth();
      }
    }
    await new Promise((r) => setTimeout(r, 500));
    return persist({ ...demoUser("alex.kumar@gmail.com"), name: "Alex Kumar" });
  };

  const register = async (name: string, email: string, password: string, role: AppUser["role"]) => {
    if (await isApiAvailable()) {
      try {
        const res = await apiRequest<TokenResponse>("/auth/register", {
          method: "POST",
          body: { name, email, password, role },
        });
        setToken(res.access_token);
        return persist(toAppUser(res.user));
      } catch (err) {
        // Duplicate email, invalid input etc. must surface — not demo login.
        if (err instanceof ApiError && err.status !== 0) throw err;
        console.warn("API register failed, using demo mode:", err);
        invalidateHealth();
      }
    }
    await new Promise((r) => setTimeout(r, 500));
    return persist({ ...demoUser(email, role), name });
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
