import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Download,
  FileText,
  Info,
  Lightbulb,
  Printer,
  Save,
  Sparkles,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { getSessionResults, clearSession } from "../lib/session";
import { fuseReport, riskColor } from "../lib/scoring";
import { getLatestReport, saveSessionDomains } from "../lib/mockApi";
import type { ExamReport } from "../lib/types";
import { Badge, Card, DisclaimerBanner, PageHeading, ProgressRing, RiskBadge, cn } from "../components/ui";
import { DomainRadar } from "../components/charts";
import { MotionPage } from "../components/Layout";

export default function Results() {
  const { t } = useI18n();
  const session = getSessionResults();
  const [report, setReport] = useState<ExamReport | null>(() => {
    if (session.length > 0) return fuseReport(session);
    return getLatestReport();
  });
  const [saved, setSaved] = useState(session.length === 0);
  const [pending] = useState(session.length > 0);
  const [saving, setSaving] = useState(false);

  const finalize = async () => {
    setSaving(true);
    const savedReport = await saveSessionDomains(getSessionResults());
    clearSession();
    setReport(savedReport);
    setSaved(true);
    setSaving(false);
  };

  if (!report) {
    return (
      <MotionPage>
        <PageHeading title="Screening report" subtitle="Your explainable multimodal results" />
        <Card className="py-12 text-center">
          <FileText size={32} className="mx-auto text-white/25" />
          <p className="mt-3 text-sm text-white/50">{t("noData")}</p>
          <Link
            to="/screen"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow"
          >
            {t("startScreening")}
          </Link>
        </Card>
      </MotionPage>
    );
  }

  const worst = [...report.domains].sort((a, b) => a.score - b.score)[0];

  return (
    <MotionPage>
      <PageHeading
        title="Screening report"
        subtitle={`${new Date(report.dateISO).toLocaleString()} · ${report.domains.length} biomarker domains fused`}
        action={
          <div className="no-print flex flex-wrap gap-2">
            {pending && !saved && (
              <button
                onClick={finalize}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-glow hover:from-brand-400 hover:to-brand-500 disabled:opacity-50"
              >
                <Save size={15} /> {saving ? "Saving…" : "Save to history"}
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
            >
              <Printer size={15} /> {t("exportPdf")}
            </button>
          </div>
        }
      />

      {pending && !saved && (
        <div className="no-print mb-5 flex items-start gap-2.5 rounded-xl border border-brand-400/25 bg-brand-500/10 px-4 py-3 text-xs text-brand-200">
          <Info size={14} className="mt-0.5 shrink-0" />
          This report previews your current screening session. Save it to history to add it to your longitudinal
          record, or keep screening more domains first.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* overall */}
        <Card className="print-white">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-white">{t("overallRisk")}</h3>
            <RiskBadge risk={report.risk} />
          </div>
          <div className="mt-4 flex flex-col items-center">
            <ProgressRing value={report.overall} size={150} stroke={12} color={riskColor(report.risk)}>
              <span className="font-display text-4xl font-bold text-white">{report.overall}</span>
              <span className="text-[10px] uppercase tracking-wider text-white/40">/ 100</span>
            </ProgressRing>
            <p className="mt-3 text-center text-xs text-white/50">
              Higher is healthier. This is a fused estimate across
              {report.domains.map((d) => ` ${d.label.toLowerCase()}`).join(",")}.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-4 text-xs text-white/50">
            <span>{t("confidence")}</span>
            <span className="font-semibold" style={{ color: report.confidence >= 70 ? "#2dd4bf" : "#fbbf24" }}>
              {report.confidence}%
            </span>
          </div>
          {report.confidence < 70 && (
            <p className="mt-2 rounded-lg bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
              Confidence is reduced — fewer domains were measured this session or recording quality was
              limited. Consider repeating with more tests.
            </p>
          )}
        </Card>

        {/* radar + explanations */}
        <div className="space-y-4 lg:col-span-2">
          <Card title="Biomarker profile" subtitle="Per-domain scores — higher is healthier" className="print-white">
            <DomainRadar scores={report.domainScores} height={230} />
          </Card>

          <Card title="What the AI sees" subtitle="Plain-language explanations of every flagged feature" className="print-white">
            <div className="space-y-2.5">
              {report.explanations.map((e, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-white/8 bg-ink-900/50 px-4 py-3 text-sm text-white/75">
                  <Sparkles size={15} className="mt-0.5 shrink-0 text-teal-300" />
                  <span>{e}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* domain cards */}
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {report.domains.map((d) => (
          <Card
            key={d.id}
            className="print-white"
            title={
              <span className="flex items-center gap-2">
                {d.label}
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{ background: `${riskColor(d.score >= 65 ? "Low" : d.score >= 45 ? "Moderate" : "High")}22`, color: riskColor(d.score >= 65 ? "Low" : d.score >= 45 ? "Moderate" : "High") }}
                >
                  {d.score}
                </span>
              </span>
            }
            action={<Badge tone="slate">{d.confidence}% conf.</Badge>}
          >
            <div className="space-y-2">
              {Object.entries(d.features).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-white/5 pb-1.5 text-xs last:border-0">
                  <span className="text-white/45">{k}</span>
                  <span className="font-semibold text-white/85">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              {d.notes.map((n, i) => (
                <p key={i} className={cn("flex items-start gap-1.5 text-[11px] leading-relaxed", d.flags.length > 0 && d.score < 65 ? "text-amber-200/80" : "text-white/45")}>
                  <AlertCircle size={11} className={cn("mt-0.5 shrink-0", d.score < 65 ? "text-amber-300" : "text-white/25")} />
                  {n}
                </p>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* recommendations */}
      <Card className="mt-4 print-white" title="Recommendations" subtitle="Based on this screening and your history">
        <div className="space-y-2.5">
          {report.recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-white/8 bg-ink-900/50 px-4 py-3 text-sm text-white/75">
              <Lightbulb size={15} className="mt-0.5 shrink-0 text-amber-300" />
              <span>{r}</span>
            </div>
          ))}
        </div>
        {worst && worst.score < 65 && (
          <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/8 px-4 py-3 text-xs text-amber-200">
            Strongest signal this session: <strong>{worst.label}</strong> ({worst.score}/100). Compare this
            domain against your baseline in History to see whether the change is a trend or a one-off.
          </p>
        )}
      </Card>

      {/* export bar */}
      <Card className="mt-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-white/60">
            <Download size={16} className="text-brand-300" />
            <div>
              <p className="font-medium text-white/85">Share with your neurologist</p>
              <p className="text-xs text-white/40">
                Use “Export report” (print to PDF), or the doctor portal CSV export for trend data.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-glow hover:from-brand-400 hover:to-brand-500"
            >
              <Printer size={15} className="mr-1.5 inline" />
              {t("exportPdf")}
            </button>
            <Link to="/history" className="rounded-xl border border-white/12 px-4 py-2 text-sm text-white/70 hover:bg-white/5">
              View history
            </Link>
          </div>
        </div>
      </Card>

      <div className="mt-6">
        <DisclaimerBanner />
      </div>
    </MotionPage>
  );
}
