import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Loader2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { Button, Card, cn } from "../components/ui";

export default function Login() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? "/dashboard";

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"patient" | "doctor" | "caregiver">("patient");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        if (name.trim().length < 2) throw new Error("Please enter your name.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        await register(name, email, password, role);
      }
      nav(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(50%_40%_at_50%_0%,rgba(74,110,240,0.22),transparent)]" />
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-teal-500 shadow-glow">
              <Brain size={20} className="text-white" />
            </span>
            <span className="font-display text-xl font-bold text-white">
              Neuro<span className="text-teal-300">Lens</span>
            </span>
          </Link>
          <p className="text-sm text-white/50">
            {mode === "login" ? "Welcome back — screen, monitor, understand." : "Create your screening account"}
          </p>
        </div>

        <Card className="border-white/10 bg-ink-800/80">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-ink-900/80 p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className={cn(
                  "rounded-lg py-2 text-sm font-medium transition-colors",
                  mode === m ? "bg-brand-500/20 text-brand-200" : "text-white/50 hover:text-white"
                )}
              >
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3.5">
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">Full name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-ink-900/80 px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-brand-400/60"
                  placeholder="Priya Sharma"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-ink-900/80 px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-brand-400/60"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-ink-900/80 px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-brand-400/60"
                placeholder="••••••••"
              />
            </div>

            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">I am a…</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["patient", "doctor", "caregiver"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={cn(
                        "rounded-xl border px-2 py-2 text-xs font-medium capitalize transition-colors",
                        role === r
                          ? "border-brand-400/50 bg-brand-500/15 text-brand-200"
                          : "border-white/10 text-white/50 hover:border-white/25"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-white/35">
          Sign in with an account you created, or create one above — credentials are validated against the server.
          NeuroLens is a screening aid — it does not diagnose any condition.
        </p>
      </motion.div>
    </div>
  );
}
