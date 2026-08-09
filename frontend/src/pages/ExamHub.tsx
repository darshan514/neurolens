import { Link, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Brain,
  Footprints,
  Gauge,
  Hand,
  Mic,
  PenLine,
  ScanFace,
  Timer,
  Vibrate,
  CheckCircle2,
  FileText,
  Sparkles as SparklesIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "../lib/i18n";
import { getSessionResults, clearSession } from "../lib/session";
import { adaptiveFollowUps } from "../lib/scoring";
import { TEST_META, type TestId } from "../lib/types";
import { Card, DisclaimerBanner, PageHeading, ProgressRing } from "../components/ui";
import { MotionPage } from "../components/Layout";

const ICONS: Record<TestId, ReactNode> = {
  voice: <Mic size={20} />,
  tap: <Hand size={20} />,
  spiral: <PenLine size={20} />,
  tremor: <Vibrate size={20} />,
  walking: <Footprints size={20} />,
  facial: <ScanFace size={20} />,
  balance: <Gauge size={20} />,
  reaction: <Timer size={20} />,
  cognitive: <Brain size={20} />,
};

const ROUTES: Record<TestId, string> = {
  voice: "/screen/voice",
  tap: "/screen/tap",
  spiral: "/screen/spiral",
  tremor: "/screen/tremor",
  walking: "/screen/walking",
  facial: "/screen/facial",
  balance: "/screen/balance",
  reaction: "/screen/reaction",
  cognitive: "/screen/cognitive",
};

export default function ExamHub() {
  const { t } = useI18n();
  const nav = useNavigate();
  const session = getSessionResults();
  const doneIds = new Set(session.map((d) => d.id));
  const followUps = adaptiveFollowUps(session);
  const sessionScore = Math.round(
    session.reduce((s, d) => s + d.score, 0) / Math.max(1, session.length)
  );

  return (
    <MotionPage>
      <PageHeading
        title={t("navScreen")}
        subtitle="Complete any combination of tests — the AI fuses them into one explainable report. ~5 minutes for the full set."
        action={
          session.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 sm:flex">
                <ProgressRing value={sessionScore} size={44} stroke={5}>
                  <span className="text-xs font-bold text-white">{sessionScore}</span>
                </ProgressRing>
                <div className="text-xs text-white/50">
                  <p className="font-semibold text-white/80">{session.length}/9 done</p>
                  <p>this session</p>
                </div>
              </div>
              <button
                onClick={() => {
                  clearSession();
                }}
                className="rounded-xl border border-white/12 px-3 py-2 text-xs text-white/55 hover:bg-white/5"
              >
                Clear
              </button>
            </div>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(TEST_META) as TestId[]).map((id, i) => {
          const meta = TEST_META[id];
          const done = doneIds.has(id);
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link to={ROUTES[id]} className="block h-full">
                <Card
                  className={done ? "border-teal-400/25" : "h-full transition-colors hover:border-brand-400/30"}
                  padded={false}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <span
                        className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                          done ? "bg-teal-500/15 text-teal-300" : "bg-brand-500/15 text-brand-300"
                        }`}
                      >
                        {ICONS[id]}
                      </span>
                      {done && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-teal-300">
                          <CheckCircle2 size={13} /> done
                        </span>
                      )}
                    </div>
                    <h3 className="mt-4 font-display text-[15px] font-semibold text-white">{meta.label}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-white/45">{meta.description}</p>
                    <div className="mt-4 flex items-center justify-between text-[11px] text-white/40">
                      <span>~{meta.durationSec}s</span>
                      <span className="flex items-center gap-1 font-medium text-brand-300">
                        {done ? "Retake" : "Start"} <ArrowRight size={13} />
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* adaptive AI follow-ups */}
      {followUps.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <div className="rounded-2xl border border-amber-300/25 bg-gradient-to-r from-amber-400/10 to-rose-500/10 p-5">
            <div className="mb-3 flex items-center gap-2">
              <SparklesIcon size={16} className="text-amber-300" />
              <h3 className="font-display text-sm font-semibold text-white">Adaptive examination — the AI recommends more tests</h3>
            </div>
            <div className="space-y-2">
              {followUps.map((f) => (
                <div key={`${f.id}-${f.reason}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-ink-900/50 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs text-white/70">
                    <span
                      className={f.priority === "high" ? "rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300" : "rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-white/50"}
                    >
                      {f.priority === "high" ? "RECOMMENDED" : "optional"}
                    </span>
                    <span>{f.reason}</span>
                  </div>
                  <Link to={ROUTES[f.id]} className="rounded-lg bg-brand-500/15 px-3 py-1.5 text-xs font-medium text-brand-200 hover:bg-brand-500/25">
                    {doneIds.has(f.id) ? "Retake" : "Run"} {TEST_META[f.id].short}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* report CTA */}
      {session.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-400/25 bg-gradient-to-r from-brand-500/12 to-teal-500/10 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20 text-brand-200">
                <FileText size={18} />
              </span>
              <div>
                <p className="font-semibold text-white">{session.length} test{session.length > 1 ? "s" : ""} complete</p>
                <p className="text-xs text-white/50">Fuse these biomarkers into your explainable screening report.</p>
              </div>
            </div>
            <button
              onClick={() => nav("/results")}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:from-brand-400 hover:to-brand-500"
            >
              {t("viewReport")} <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      )}

      <div className="mt-6">
        <DisclaimerBanner />
      </div>
    </MotionPage>
  );
}
