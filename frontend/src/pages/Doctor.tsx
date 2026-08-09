import { useState } from "react";
import { Download, Stethoscope, TrendingDown, TrendingUp } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { DEMO_PATIENTS, getTrend } from "../lib/mockApi";
import { DOMAIN_LABELS, type TestId } from "../lib/types";
import { Card, DisclaimerBanner, PageHeading, RiskBadge, ScoreBar, cn } from "../components/ui";
import { TrendChart } from "../components/charts";
import { MotionPage } from "../components/Layout";

const TREND_COLORS: Record<string, string> = {
  overall: "#4a6ef0",
  voice: "#2dd4bf",
  tap: "#fbbf24",
  tremor: "#fb7185",
  walking: "#a78bfa",
};

export default function Doctor() {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState(DEMO_PATIENTS[0].id);
  const patient = DEMO_PATIENTS.find((p) => p.id === selectedId) ?? DEMO_PATIENTS[0];
  const trend = getTrend();

  const exportCsv = () => {
    const header = ["date", "overall", ...Object.keys(DOMAIN_LABELS)];
    const rows = trend.map((p) =>
      [p.dateISO, p.overall, ...Object.keys(DOMAIN_LABELS).map((id) => p.domainScores[id as TestId] ?? "")].join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neurolens-${patient.id}-trend.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const series = [
    { key: "overall", name: "Overall", color: TREND_COLORS.overall },
    { key: "voice", name: "Speech", color: TREND_COLORS.voice },
    { key: "tap", name: "Dexterity", color: TREND_COLORS.tap },
  ];

  return (
    <MotionPage>
      <PageHeading
        title={t("navDoctor")}
        subtitle="Objective measurements, progress tracking and AI-generated reports for your patients."
        action={
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            <Download size={15} /> {t("exportCsv")}
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        {/* patient list */}
        <Card title={t("patientList")} subtitle={`${DEMO_PATIENTS.length} patients · demo data`} className="lg:col-span-2 h-fit">
          <div className="space-y-2">
            {DEMO_PATIENTS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "w-full rounded-xl border px-3.5 py-3 text-left transition-colors",
                  selectedId === p.id ? "border-brand-400/40 bg-brand-500/10" : "border-white/8 bg-ink-900/50 hover:border-white/20"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-teal-500 text-xs font-bold text-white">
                      {p.name.charAt(0)}
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-white/90">{p.name}</span>
                      <span className="block text-[11px] text-white/40">{p.age}y · {p.sex} · {p.lastSeen}</span>
                    </span>
                  </span>
                  <RiskBadge risk={p.risk} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="font-display text-lg font-bold text-white">{p.overall}</span>
                  <span className={cn("flex items-center gap-1 font-medium", p.trend >= 0 ? "text-teal-300" : "text-rose-400")}>
                    {p.trend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {p.trend >= 0 ? "+" : ""}{p.trend} (8w)
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* patient detail */}
        <div className="space-y-4 lg:col-span-3">
          <Card title={`${patient.name} — summary`} subtitle="Weekly AI reports · motor & speech trends">
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <PatientTile label="Overall" value={patient.overall} />
              <PatientTile label="Speech" value={78} />
              <PatientTile label="Motor" value={65} />
              <PatientTile label="Adherence" value={patient.adherence} suffix="%" />
            </div>
            <div className="space-y-3">
              <ScoreBar label="Speech stability" value={78} color="#2dd4bf" />
              <ScoreBar label="Finger dexterity" value={62} color="#fbbf24" />
              <ScoreBar label="Tremor" value={71} color="#4a6ef0" />
              <ScoreBar label="Gait" value={66} color="#a78bfa" />
            </div>
            <div className="mt-4 rounded-xl border border-white/8 bg-ink-900/50 px-4 py-3 text-xs leading-relaxed text-white/60">
              <Stethoscope size={13} className="mr-1.5 inline text-teal-300" />
              AI summary: “{patient.name.split(" ")[0]} shows a {patient.trend < 0 ? "gradual decline" : "stable course"} in
              finger dexterity and gait over the last 8 weeks. Speech remains stable. Recommend a
              neurologist review and repeat screening in 2 weeks.”
            </div>
          </Card>

          <Card title={t("weeklyReports")} subtitle="Last 8 weeks — fused overall + key domains">
            <TrendChart points={trend} series={series} height={240} />
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <DisclaimerBanner />
      </div>
    </MotionPage>
  );
}

function PatientTile({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  const color = value >= 65 ? "#2dd4bf" : value >= 45 ? "#fbbf24" : "#fb7185";
  return (
    <div className="rounded-xl border border-white/8 bg-ink-900/60 px-3 py-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-white/35">{label}</p>
      <p className="mt-0.5 font-display text-xl font-bold" style={{ color }}>
        {value}
        {suffix && <span className="text-xs font-normal text-white/40">{suffix}</span>}
      </p>
    </div>
  );
}
