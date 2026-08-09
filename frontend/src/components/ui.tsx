import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { RiskLevel } from "../lib/types";
import { riskColor } from "../lib/scoring";

export function cn(...parts: Array<string | false | null | undefined>) {
  return clsx(parts);
}

// ------------------------------------------------------------------ button

type BtnVariant = "primary" | "outline" | "ghost" | "danger" | "success";

const btnStyles: Record<BtnVariant, string> = {
  primary:
    "bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-400 hover:to-brand-500 shadow-glow",
  outline:
    "border border-white/15 text-white/90 hover:bg-white/5 hover:border-white/30",
  ghost: "text-white/70 hover:text-white hover:bg-white/5",
  danger: "bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25",
  success: "bg-teal-500/15 text-teal-300 border border-teal-400/30 hover:bg-teal-500/25",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: {
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60",
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-4 py-2.5 text-sm",
        size === "lg" && "px-6 py-3 text-base",
        btnStyles[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------- card

export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "rounded-2xl border border-white/8 bg-ink-800/60 backdrop-blur-sm shadow-card",
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-1">
          <div>
            {title && <h3 className="font-display text-sm font-semibold text-white/95">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-white/45">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn(padded && "p-5", !padded && "p-0")}>{children}</div>
    </motion.div>
  );
}

// ------------------------------------------------------------------ badge

export function Badge({
  tone = "blue",
  children,
  className,
}: {
  tone?: "blue" | "teal" | "amber" | "rose" | "slate";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    blue: "bg-brand-500/15 text-brand-200 border-brand-400/25",
    teal: "bg-teal-500/15 text-teal-300 border-teal-400/25",
    amber: "bg-amber-400/15 text-amber-300 border-amber-300/25",
    rose: "bg-rose-500/15 text-rose-300 border-rose-400/25",
    slate: "bg-white/5 text-white/60 border-white/10",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const tone = risk === "Low" ? "teal" : risk === "Moderate" ? "amber" : "rose";
  return <Badge tone={tone}>{risk} risk</Badge>;
}

// ------------------------------------------------------------ progress ring

export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  color,
  track = "rgba(255,255,255,0.08)",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (value / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? (value >= 65 ? "#2dd4bf" : value >= 45 ? "#fbbf24" : "#fb7185")}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - filled }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

// ------------------------------------------------------------------- stat

export function Stat({
  label,
  value,
  delta,
  icon,
  hint,
}: {
  label: string;
  value: ReactNode;
  delta?: number;
  icon?: ReactNode;
  hint?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-white/8 bg-ink-800/60 p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</p>
        {icon && <span className="text-brand-300/70">{icon}</span>}
      </div>
      <p className="mt-1.5 font-display text-2xl font-bold text-white">{value}</p>
      {delta !== undefined && (
        <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", up ? "text-teal-300" : "text-rose-400")}>
          {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {up ? "+" : ""}
          {delta}
          {hint ? <span className="ml-1 text-white/35 font-normal">{hint}</span> : null}
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------- score bar

export function ScoreBar({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: number;
  color?: string;
  sub?: string;
}) {
  const c = color ?? (value >= 65 ? "#2dd4bf" : value >= 45 ? "#fbbf24" : "#fb7185");
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-white/75">{label}</span>
        <span className="text-xs font-semibold" style={{ color: c }}>
          {value}
          {sub && <span className="ml-1 font-normal text-white/35">{sub}</span>}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
        <motion.div
          className="h-full rounded-full"
          style={{ background: c }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------- disclaimer

export function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-amber-300/20 bg-amber-400/8 px-4 py-3 text-amber-200/90",
        compact ? "text-[11px]" : "text-xs"
      )}
    >
      <AlertTriangle size={compact ? 13 : 15} className="mt-0.5 shrink-0 text-amber-300" />
      <p>
        <strong className="font-semibold">Screening aid — not a diagnosis.</strong> NeuroLens AI estimates
        neurological risk from digital biomarkers. It does <em>not</em> diagnose Parkinson's disease or any
        other condition. Always consult a qualified neurologist for clinical decisions.
      </p>
    </div>
  );
}

// ------------------------------------------------------------- heading

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function riskTone(value: number): "teal" | "amber" | "rose" {
  return value >= 65 ? "teal" : value >= 45 ? "amber" : "rose";
}

export { riskColor };
