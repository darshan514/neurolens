import { useState } from "react";
import { BellRing, CalendarClock, HeartHandshake, PhoneCall, Users } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { DEMO_PATIENTS } from "../lib/mockApi";
import type { PatientSummary } from "../lib/types";
import { Badge, Card, DisclaimerBanner, PageHeading, RiskBadge, cn } from "../components/ui";
import { MotionPage } from "../components/Layout";

const ALERTS = [
  { id: 1, level: "warning", text: "Karthik R.'s tremor score declined 7 points over the last 2 weeks." },
  { id: 2, level: "info", text: "Meena S. missed her weekly screening — a gentle reminder was sent." },
  { id: 3, level: "info", text: "Rajesh V. logged a positive medication response (after-dose scores improved +6)." },
  { id: 4, level: "success", text: "Arun P. is stable — 8 consecutive weeks within baseline." },
];

export default function Family() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<PatientSummary>(DEMO_PATIENTS[2]);
  const [read, setRead] = useState<Set<number>>(new Set());

  return (
    <MotionPage>
      <PageHeading
        title="Family dashboard"
        subtitle="Monitor your loved one's progression, receive alerts, and schedule consultations."
        action={
          <Badge tone="blue">
            <Users size={12} /> {DEMO_PATIENTS.length} linked patients
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* alerts */}
        <Card title="Alerts" subtitle="Changes worth knowing about" className="lg:col-span-2">
          <div className="space-y-2">
            {ALERTS.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-4 py-3",
                  a.level === "warning"
                    ? "border-amber-300/25 bg-amber-400/8"
                    : a.level === "success"
                    ? "border-teal-400/25 bg-teal-500/8"
                    : "border-white/8 bg-ink-900/50"
                )}
              >
                <BellRing
                  size={15}
                  className={cn(
                    "mt-0.5 shrink-0",
                    a.level === "warning" ? "text-amber-300" : a.level === "success" ? "text-teal-300" : "text-brand-300"
                  )}
                />
                <p className="flex-1 text-sm text-white/75">{a.text}</p>
                {!read.has(a.id) && (
                  <button
                    onClick={() => setRead((s) => new Set(s).add(a.id))}
                    className="text-[11px] font-medium text-brand-300 hover:text-brand-200"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* schedule */}
        <Card title="Schedule" subtitle="Telemedicine + clinic appointments">
          <div className="space-y-3">
            <button className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-ink-900/50 px-4 py-3 text-left hover:border-white/20">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
                <PhoneCall size={16} />
              </span>
              <span>
                <span className="block text-sm font-medium text-white/85">Book teleconsultation</span>
                <span className="block text-[11px] text-white/40">Video visit with a movement-disorder specialist</span>
              </span>
            </button>
            <button className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-ink-900/50 px-4 py-3 text-left hover:border-white/20">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
                <CalendarClock size={16} />
              </span>
              <span>
                <span className="block text-sm font-medium text-white/85">Schedule clinic visit</span>
                <span className="block text-[11px] text-white/40">Find a neurologist near you</span>
              </span>
            </button>
          </div>
        </Card>
      </div>

      {/* linked patients */}
      <Card className="mt-4" title="Linked patients" subtitle="Latest screening status — demo data">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {DEMO_PATIENTS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className={cn(
                "rounded-2xl border px-4 py-3.5 text-left transition-colors",
                selected.id === p.id ? "border-brand-400/40 bg-brand-500/10" : "border-white/8 bg-ink-900/50 hover:border-white/20"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-teal-500 text-xs font-bold text-white">
                    {p.name.charAt(0)}
                  </span>
                  <span className="text-sm font-medium text-white/90">{p.name}</span>
                </span>
                <RiskBadge risk={p.risk} />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs text-white/45">
                <span>Overall {p.overall}/100 · {p.lastSeen}</span>
                <span className={cn("font-medium", p.trend >= 0 ? "text-teal-300" : "text-rose-400")}>
                  {p.trend >= 0 ? "+" : ""}{p.trend} (8w)
                </span>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <div className="flex items-start gap-3">
          <HeartHandshake size={18} className="mt-0.5 shrink-0 text-teal-300" />
          <p className="text-sm leading-relaxed text-white/60">
            <strong className="text-white/85">Caregiver tip:</strong> family monitoring works best when the patient
            screens on a consistent schedule (same time of day, after the same medication window). Trends matter more
            than single scores — one low reading is not a reason to panic.
          </p>
        </div>
      </Card>

      <div className="mt-6">
        <DisclaimerBanner />
      </div>
    </MotionPage>
  );
}
