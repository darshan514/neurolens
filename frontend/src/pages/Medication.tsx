import { useState } from "react";
import { FileText, Pill, Plus, Printer, Trash2 } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { getMedLogs, saveMedLog, getLatestReport, getCurrentState } from "../lib/mockApi";
import { DOMAIN_WEIGHTS } from "../lib/scoring";
import type { MedicationLog, TestId } from "../lib/types";
import { Badge, Button, Card, DisclaimerBanner, PageHeading, ScoreBar, cn } from "../components/ui";
import { CompareBars } from "../components/charts";
import { MotionPage } from "../components/Layout";

const KEY_DOMAINS: TestId[] = ["voice", "tap", "spiral", "tremor", "walking"];

export default function Medication() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<MedicationLog[]>(() => getMedLogs());
  const [taken, setTaken] = useState(true);
  const [note, setNote] = useState("");
  const [showReport, setShowReport] = useState(false);
  const current = getLatestReport() ?? null;
  const demo = getCurrentState();

  const useCurrent = async () => {
    const scores = current ? current.domainScores : demo.domainScores;
    const log: MedicationLog = {
      id: `m_${Date.now()}`,
      dateISO: new Date().toISOString(),
      taken,
      domainScores: { ...scores },
      note: note || undefined,
    };
    setLogs(await saveMedLog(log));
    setNote("");
  };

  const overallOf = (l: MedicationLog) => {
    let w = 0;
    let s = 0;
    for (const id of Object.keys(DOMAIN_WEIGHTS) as TestId[]) {
      const v = l.domainScores[id];
      if (v != null) {
        s += v * DOMAIN_WEIGHTS[id];
        w += DOMAIN_WEIGHTS[id];
      }
    }
    return Math.round(w ? s / w : 0);
  };

  const remove = (id: string) => {
    const next = logs.filter((l) => l.id !== id);
    setLogs(next);
    localStorage.setItem("nl_meds", JSON.stringify(next));
  };

  // pair up latest before/after for comparison
  const sorted = [...logs].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  const lastBefore = [...sorted].reverse().find((l) => !l.taken);
  const lastAfter = [...sorted].reverse().find((l) => l.taken);
  const compareData =
    lastBefore && lastAfter
      ? KEY_DOMAINS.map((id) => ({
          name: id,
          Before: Math.round(lastBefore.domainScores[id] ?? 0),
          After: Math.round(lastAfter.domainScores[id] ?? 0),
        }))
      : null;

  return (
    <MotionPage>
      <PageHeading
        title={t("navMedication")}
        subtitle="Record symptoms before and after your dose to quantify medication response."
        action={
          <div className="flex items-center gap-2">
            {lastBefore && lastAfter && (
              <button
                onClick={() => setShowReport((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
              >
                <FileText size={15} /> {showReport ? "Hide" : "Generate"} medication report
              </button>
            )}
            <Badge tone="teal">
              <Pill size={12} /> {logs.length} logs
            </Badge>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Log dose response" subtitle="Scores come from your latest screening session — or the demo profile">
          <div className="mb-4 grid grid-cols-2 gap-2">
            {([true, false] as const).map((tk) => (
              <button
                key={String(tk)}
                onClick={() => setTaken(tk)}
                className={cn(
                  "rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                  taken === tk
                    ? tk
                      ? "border-teal-400/50 bg-teal-500/15 text-teal-200"
                      : "border-amber-300/50 bg-amber-400/15 text-amber-200"
                    : "border-white/10 text-white/50 hover:border-white/25"
                )}
              >
                {tk ? t("after") : t("before")}
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (e.g. dose taken 30 min ago, symptom notes…)"
            className="mb-4 w-full rounded-xl border border-white/10 bg-ink-900/80 px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-brand-400/60"
          />
          <div className="space-y-3">
            <ScoreBar label={current ? "From your latest screening" : "Demo profile (no screening yet)"} value={(current ?? demo).overall} />
            {KEY_DOMAINS.slice(0, 3).map((id) => (
              <ScoreBar key={id} label={id} value={Math.round((current ?? demo).domainScores[id] ?? 0)} />
            ))}
          </div>
          <Button onClick={useCurrent} className="mt-4 w-full">
            <Plus size={15} /> {t("logDose")}
          </Button>
        </Card>

        <Card
          title="Medication response"
          subtitle="Latest before vs after comparison"
          className="h-fit"
        >
          {compareData ? (
            <CompareBars data={compareData} colors={["#fbbf24", "#2dd4bf"]} />
          ) : (
            <p className="py-10 text-center text-sm text-white/40">
              Log at least one <em>before</em> and one <em>after</em> entry to see the comparison chart.
            </p>
          )}
        </Card>
      </div>

      {showReport && lastBefore && lastAfter && (
        <Card className="mt-4 print-white" title="Medication effectiveness report" subtitle={`Generated ${new Date().toLocaleString()} — screening aid, not a diagnosis`}>
          <div className="space-y-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/40">
                  <th className="pb-2 font-medium">Domain</th>
                  <th className="pb-2 text-right font-medium">Before dose</th>
                  <th className="pb-2 text-right font-medium">After dose</th>
                  <th className="pb-2 text-right font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                {KEY_DOMAINS.map((id) => {
                  const b = lastBefore.domainScores[id] ?? 0;
                  const a = lastAfter.domainScores[id] ?? 0;
                  const d = Math.round(a - b);
                  return (
                    <tr key={id} className="border-b border-white/5">
                      <td className="py-2 text-white/70">{id}</td>
                      <td className="py-2 text-right text-white/60">{Math.round(b)}</td>
                      <td className="py-2 text-right text-white/85">{Math.round(a)}</td>
                      <td className={cn("py-2 text-right font-semibold", d > 0 ? "text-teal-300" : d < 0 ? "text-rose-400" : "text-white/40")}>
                        {d > 0 ? "+" : ""}{d}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="rounded-xl border border-white/8 bg-ink-900/50 px-4 py-3 text-sm leading-relaxed text-white/70">
              {(() => {
                const deltas = KEY_DOMAINS.map((id) => (lastAfter.domainScores[id] ?? 0) - (lastBefore.domainScores[id] ?? 0));
                const improved = deltas.filter((d) => d > 0).length;
                const declined = deltas.filter((d) => d < 0).length;
                if (improved > declined) {
                  return (
                    <>
                      <strong className="text-teal-300">Positive response:</strong> {improved} of {deltas.length} domains
                      improved after your dose. This is the pattern you want to discuss with your neurologist to confirm
                      timing and dosing.
                    </>
                  );
                }
                if (declined > improved) {
                  return (
                    <>
                      <strong className="text-rose-300">Limited response:</strong> {declined} of {deltas.length} domains
                      scored lower after your dose. Log a few more before/after pairs before drawing conclusions —
                      single-day variation is common.
                    </>
                  );
                }
                return (
                  <>
                    <strong className="text-white/85">No clear change:</strong> scores were roughly stable across your
                    dose. More before/after logs will sharpen this estimate.
                  </>
                );
              })()}
            </div>
            <button
              onClick={() => window.print()}
              className="no-print rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-glow hover:from-brand-400 hover:to-brand-500"
            >
              <Printer size={15} className="mr-1.5 inline" /> Export report (PDF)
            </button>
          </div>
        </Card>
      )}

      <Card className="mt-4" title="Dose history">
        {logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/40">No medication logs yet.</p>
        ) : (
          <div className="space-y-2">
            {[...logs].reverse().map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-ink-900/50 px-4 py-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-white/85">
                    <Badge tone={l.taken ? "teal" : "amber"}>{l.taken ? "After dose" : "Before dose"}</Badge>
                    {new Date(l.dateISO).toLocaleString()}
                  </p>
                  {l.note && <p className="mt-1 text-xs text-white/45">{l.note}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg font-bold text-white">{overallOf(l)}</span>
                  <button onClick={() => remove(l.id)} className="text-white/30 hover:text-rose-300">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-6">
        <DisclaimerBanner />
      </div>
    </MotionPage>
  );
}
