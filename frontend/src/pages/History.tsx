import { useState } from "react";
import { CalendarDays, TrendingUp } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { getHistory, getBaseline } from "../lib/mockApi";
import { DOMAIN_LABELS, type TestId } from "../lib/types";
import { Badge, Card, DisclaimerBanner, PageHeading, RiskBadge, cn } from "../components/ui";
import { TrendChart } from "../components/charts";
import { MotionPage } from "../components/Layout";

const ALL_IDS = Object.keys(DOMAIN_LABELS) as TestId[];

export default function History() {
  const { t } = useI18n();
  const history = getHistory();
  const baseline = getBaseline();
  const [selected, setSelected] = useState<TestId | null>(null);
  const [viewId, setViewId] = useState<string | null>(history.length ? history[history.length - 1].id : null);
  const selectedReport = history.find((r) => r.id === viewId) ?? null;

  const trendPoints = history.map((r) => ({
    dateISO: r.dateISO,
    label: new Date(r.dateISO).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    overall: r.overall,
    domainScores: r.domainScores,
  }));

  const series = selected
    ? [
        { key: selected, name: DOMAIN_LABELS[selected], color: "#2dd4bf" },
        { key: "overall", name: "Overall", color: "#4a6ef0" },
      ]
    : [
        { key: "overall", name: "Overall", color: "#4a6ef0" },
        { key: "voice", name: "Speech", color: "#2dd4bf" },
        { key: "tap", name: "Dexterity", color: "#fbbf24" },
      ];

  return (
    <MotionPage>
      <PageHeading
        title={t("history")}
        subtitle="Every completed report — track progression, improvement and decline over time."
        action={
          history.length > 0 ? (
            <Badge tone="teal">
              <TrendingUp size={12} /> {history.length} reports
            </Badge>
          ) : undefined
        }
      />

      {history.length === 0 ? (
        <Card className="py-12 text-center text-sm text-white/50">{t("noData")}</Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* report list */}
          <div className="space-y-2.5 lg:col-span-2">
            {[...history].reverse().map((r) => (
              <button
                key={r.id}
                onClick={() => setViewId(r.id)}
                className={cn(
                  "w-full rounded-2xl border px-4 py-3.5 text-left transition-colors",
                  viewId === r.id ? "border-brand-400/40 bg-brand-500/10" : "border-white/8 bg-ink-800/60 hover:border-white/20"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-white/85">
                    <CalendarDays size={14} className="text-white/35" />
                    {new Date(r.dateISO).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span className="font-display text-lg font-bold" style={{ color: r.overall >= 65 ? "#2dd4bf" : r.overall >= 45 ? "#fbbf24" : "#fb7185" }}>
                    {r.overall}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/40">
                  <span>{r.domains.length} domains</span>
                  <RiskBadge risk={r.risk} />
                </div>
              </button>
            ))}
          </div>

          {/* detail */}
          <div className="space-y-4 lg:col-span-3">
            {selectedReport && (
              <Card title={`Report · ${new Date(selectedReport.dateISO).toLocaleDateString()}`} subtitle={`${selectedReport.confidence}% confidence · ${selectedReport.domains.length} domains`}>
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ALL_IDS.filter((id) => selectedReport.domainScores[id] != null).map((id) => {
                    const v = selectedReport.domainScores[id];
                    const b = baseline.domainScores[id] ?? v;
                    const delta = v - b;
                    return (
                      <div key={id} className="rounded-xl border border-white/8 bg-ink-900/60 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-white/35">{DOMAIN_LABELS[id]}</p>
                        <p className="mt-0.5 flex items-baseline gap-2">
                          <span className="font-semibold text-white">{v}</span>
                          <span className={cn("text-[11px] font-medium", delta >= 0 ? "text-teal-300" : "text-rose-400")}>
                            {delta >= 0 ? "+" : ""}{Math.round(delta)} vs baseline
                          </span>
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2.5">
                  {selectedReport.explanations.slice(0, 3).map((e, i) => (
                    <p key={i} className="text-xs leading-relaxed text-white/55">• {e}</p>
                  ))}
                </div>
              </Card>
            )}

            <Card title="Progression" subtitle="Compare domains over time — click a domain below">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {ALL_IDS.map((id) => (
                  <button
                    key={id}
                    onClick={() => setSelected(selected === id ? null : id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                      selected === id
                        ? "border-teal-400/40 bg-teal-500/15 text-teal-200"
                        : "border-white/10 text-white/45 hover:border-white/25"
                    )}
                  >
                    {DOMAIN_LABELS[id]}
                  </button>
                ))}
              </div>
              <TrendChart points={trendPoints} series={series} height={260} />
            </Card>
          </div>
        </div>
      )}

      <div className="mt-6">
        <DisclaimerBanner />
      </div>
    </MotionPage>
  );
}
