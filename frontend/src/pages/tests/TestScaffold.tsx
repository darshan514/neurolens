import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export function TestScaffold({
  title,
  subtitle,
  icon,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Link to="/screen" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
        <ArrowLeft size={15} /> All tests
      </Link>
      <div className="mb-5 flex items-center gap-3">
        {icon && (
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
            {icon}
          </span>
        )}
        <div>
          <h1 className="font-display text-xl font-bold text-white">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-white/50">{subtitle}</p>}
        </div>
      </div>
      <div className="mx-auto max-w-2xl">{children}</div>
      {footer && <div className="mx-auto mt-6 max-w-2xl">{footer}</div>}
    </motion.div>
  );
}

export function StepBadge({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 w-8 rounded-full ${i < current ? "bg-brand-400" : "bg-white/10"}`}
        />
      ))}
      <span className="ml-1 text-xs text-white/40">Step {Math.min(current, total)}/{total}</span>
    </div>
  );
}
