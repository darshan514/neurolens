import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Fingerprint,
  Footprints,
  Gauge,
  Mic,
  ScanFace,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Vibrate,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { getBaseline, getCurrentState, getHistory, getTrend } from "../lib/mockApi";
import { DOMAIN_WEIGHTS } from "../lib/scoring";
import type { TestId } from "../lib/types";
import { Badge, Card, DisclaimerBanner, PageHeading, ProgressRing, RiskBadge, ScoreBar, Stat, cn } from "../components/ui";
import { DomainRadar, TrendChart } from "../components/charts";
import { MotionPage } from "../components/Layout";

export default function Dashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const current = getCurrentState();
  const baseline = getBaseline();
  const trend = getTrend();
  const history = getHistory();
  const latest = history[history.length - 1];

  const motor = Math.round(
    (current.domainScores.tap + current.domainScores.spiral) / 2
  );
  const delta = current.overall - baseline.overall;
  const risk = current.overall >= 65 ? "Low" : current.overall >= 45 ? "Moderate" : "High";

  const tiles: Array<{ id: string; label: string; icon: ReactNode; key: TestId }> = [
    { id: "voice", label: t("speechScore"), icon: <Mic size={17} />, key: "voice" },
    { id: "motor", label: t("motorScore"), icon: <Fingerprint size={17} />, key: "tap" },
    { id: "tremor", label: t("tremorScore"), icon: <Vibrate size={17} />, key: "tremor" },
    { id: "walking", label: t("walkingScore"), icon: <Footprints size={17} />, key: "walking" },
    { id: "facial", label: t("facialRigidity"), icon: <ScanFace size={17} />, key: "facial" },
    { id: "balance", label: "Balance", icon: <Gauge size={17} />, key: "balance" },
  ];

  const deltaFor = (key: TestId) => {
    const cur = key === "tap" ? motor : current.domainScores[key];
    const b = key === "tap" ? Math.round((baseline.domainScores.tap + baseline.domainScores.spiral) / 2) : baseline.domainScores[key];
    return Math.round(cur - b);
  };

  return (
    <MotionPage>
      <PageHeading
        title={`${t("dashboard")}, ${user?.name.split(" ")[0] ?? "there"}`}
        subtitle={latest ? `${t("lastSession")}: ${new Date(latest.dateISO).toLocaleDateString()}` : t("completeSession")}
        action={
          <Link
            to="/screen"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:from-brand-400 hover:to-brand-500"
          >
            <Activity size={16} /> {t("startScreening")}
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* overall risk */}
        <Card className="lg:row-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-white/95">{t("overallRisk")}</h3>
            <RiskBadge risk={risk} />
          </div>
          <div className="mt-4 flex flex-col items-center gap-3">
            <ProgressRing value={current.overall} size={150} stroke={12}>
              <span className="font-display text-4xl font-bold text-white">{current.overall}</span>
              <span className="text-[10px] uppercase tracking-wider text-white/40">/ 100</span>
            </ProgressRing>
            <div className={cn("flex items-center gap-1.5 text-sm font-medium", delta >= 0 ? "text-teal-300" : "text-rose-400")}>
              {delta >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {delta >= 0 ? "+" : ""}{delta} {t("vsBaseline")}
            </div>
          </div>
          <div className="mt-5 space-y-3 border-t border-white/8 pt-4">
            <ScoreBar label="Speech" value={current.domainScores.voice} />
            <ScoreBar label="Motor" value={motor} />
            <ScoreBar label="Tremor" value={current.domainScores.tremor} />
            <ScoreBar label="Cognition" value={current.domainScores.cognitive} />
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-white/45">
            <span>{t("confidence")}</span>
            <span className="font-semibold text-white/80">{latest ? latest.confidence : 78}%</span>
          </div>
        </Card>

        {/* domain tiles */}
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {tiles.map((tile) => {
            const value = tile.key === "tap" ? motor : current.domainScores[tile.key];
            const d = deltaFor(tile.key);
            return (
              <Stat
                key={tile.id}
                label={tile.label}
                value={
                  <span className="flex items-baseline gap-1">
                    {value}
                    <span className="text-xs font-normal text-white/35">/100</span>
                  </span>
                }
                delta={d}
                hint={t("vsBaseline")}
                icon={tile.icon}
              />
            );
          })}
        </div>

        {/* radar */}
        <Card title={t("trendRadar")} subtitle={t("vsBaseline")}>
          <DomainRadar scores={current.domainScores} height={250} />
        </Card>

        {/* weekly trend */}
        <Card
          title={t("weeklyProgress")}
          subtitle="Last 8 weeks — fused overall score"
          className="lg:col-span-2"
        >
          <TrendChart
            points={trend}
            series={[
              { key: "overall", name: "Overall", color: "#4a6ef0" },
              { key: "voice", name: "Speech", color: "#2dd4bf" },
              { key: "tap", name: "Finger dexterity", color: "#fbbf24" },
            ]}
            height={250}
          />
        </Card>

        {/* history + recommendations */}
        <Card title={t("history")} action={<Link to="/history" className="text-xs text-brand-300 hover:text-brand-200">View all →</Link>}>
          <div className="space-y-2.5">
            {history.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-white/40">
                {t("noData")}
              </div>
            )}
            {history.slice(-4).reverse().map((r) => (
              <Link
                key={r.id}
                to="/results"
                className="flex items-center justify-between rounded-xl border border-white/8 bg-ink-900/50 px-3.5 py-2.5 transition-colors hover:border-white/20"
              >
                <div>
                  <p className="text-sm font-medium text-white/85">
                    {new Date(r.dateISO).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </p>
                  <p className="text-[11px] text-white/40">{r.domains.length} domains · {r.confidence}% confidence</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-bold" style={{ color: r.overall >= 65 ? "#2dd4bf" : r.overall >= 45 ? "#fbbf24" : "#fb7185" }}>
                    {r.overall}
                  </span>
                  <ArrowRight size={14} className="text-white/30" />
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card title={t("doctorRecs")} className="lg:col-span-2">
          <div className="space-y-3">
            {latest ? (
              latest.recommendations.map((r, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-white/8 bg-ink-900/50 px-4 py-3 text-sm text-white/75">
                  <Stethoscope size={15} className="mt-0.5 shrink-0 text-teal-300" />
                  <span>{r}</span>
                </div>
              ))
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-white/8 bg-ink-900/50 px-4 py-3 text-sm text-white/75">
                <Stethoscope size={15} className="mt-0.5 shrink-0 text-teal-300" />
                <span>
                  Complete your first screening to receive personalized recommendations. Until then, here are general
                  monitoring tips: keep a consistent weekly schedule, screen at the same time of day, and log
                  medication timing.
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge tone="slate">{t("weeklyReports")}</Badge>
              <Badge tone="slate">Personalized baseline</Badge>
              <Badge tone="slate">{Object.keys(DOMAIN_WEIGHTS).length} biomarker domains</Badge>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <DisclaimerBanner />
      </div>
    </MotionPage>
  );
}
