import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hand, Loader2, RotateCcw } from "lucide-react";
import { TestScaffold } from "./TestScaffold";
import type { TapFeatures } from "../../lib/types";
import { scoreTap } from "../../lib/scoring";
import { saveSessionResult } from "../../lib/session";
import { Button, Card } from "../../components/ui";

const DURATION = 15000;

export default function FingerTapTest() {
  const nav = useNavigate();
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [hand, setHand] = useState<"dominant" | "non-dominant">("dominant");
  const [result, setResult] = useState<TapFeatures | null>(null);

  const times = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    times.current = [];
    setLeft(0);
    setRight(0);
    setPhase("running");
    setCountdown(DURATION / 1000);
    const started = performance.now();
    timerRef.current = setInterval(() => {
      const elapsed = performance.now() - started;
      setCountdown(Math.max(0, Math.round((DURATION - elapsed) / 1000)));
      if (elapsed >= DURATION) {
        if (timerRef.current) clearInterval(timerRef.current);
        finish();
      }
    }, 100);
  };

  const tap = (side: "L" | "R") => {
    if (phase !== "running") return;
    if (side === "L") setLeft((v) => v + 1);
    else setRight((v) => v + 1);
    times.current.push(performance.now());
  };

  const finish = () => {
    const t = times.current;
    const total = t.length;
    const duration = DURATION / 1000;
    const tapRate = total / duration;
    let variability = 0;
    if (t.length > 3) {
      const intervals = t.slice(1).map((v, i) => v - t[i]);
      const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      const std = Math.sqrt(intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length);
      variability = mean > 0 ? std / mean : 0;
    }
    // fatigue: rate in first third vs last third (5s windows)
    const third = Math.floor(total / 3);
    const windowSec = DURATION / 3000; // 5s
    const firstRate = third > 1 ? third / windowSec : 0;
    const lastTaps = total - 2 * third;
    const lastRate = lastTaps > 1 ? lastTaps / windowSec : firstRate;
    const fatigueIndex = firstRate > 0 ? lastRate / firstRate : 1;
    const consistency = Math.max(0, 1 - variability);
    setResult({
      tapRate: Math.round(tapRate * 10) / 10,
      variability: Math.round(variability * 100) / 100,
      fatigueIndex: Math.round(fatigueIndex * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      hand,
    });
    setPhase("done");
  };

  const save = () => {
    if (result) saveSessionResult(scoreTap(result));
    nav("/screen");
  };

  return (
    <TestScaffold
      title="Finger Tapping"
      subtitle="Alternate between the two buttons as fast as possible for 15 seconds with one index finger."
      icon={<Hand size={20} />}
      footer={
        phase === "done" && result ? (
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setPhase("idle")}>
              <RotateCcw size={15} /> Retake
            </Button>
            <Button onClick={save}>Save result</Button>
          </div>
        ) : undefined
      }
    >
      {phase === "idle" && (
        <Card>
          <div className="mb-4">
            <p className="mb-1.5 text-sm text-white/70">Which hand are you testing?</p>
            <div className="grid grid-cols-2 gap-2">
              {(["dominant", "non-dominant"] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => setHand(h)}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                    hand === h
                      ? "border-brand-400/50 bg-brand-500/15 text-brand-200"
                      : "border-white/10 text-white/50 hover:border-white/25"
                  }`}
                >
                  {h === "dominant" ? "Dominant hand" : "Non-dominant"}
                </button>
              ))}
            </div>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-white/55">
            Rest the phone on a table. Tap the left and right buttons alternately with your index
            finger as quickly as you can for 15 seconds. The AI measures speed, rhythm variability,
            and fatigue.
          </p>
          <Button onClick={start} className="w-full">
            Start 15s trial
          </Button>
        </Card>
      )}

      {phase === "running" && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onPointerDown={() => tap("L")}
            className="flex h-52 select-none flex-col items-center justify-center rounded-2xl border border-brand-400/30 bg-brand-500/15 text-5xl font-bold text-brand-200 active:bg-brand-500/30"
          >
            L
          </button>
          <button
            onPointerDown={() => tap("R")}
            className="flex h-52 select-none flex-col items-center justify-center rounded-2xl border border-teal-400/30 bg-teal-500/15 text-5xl font-bold text-teal-200 active:bg-teal-500/30"
          >
            R
          </button>
          <div className="col-span-2 flex items-center justify-between rounded-xl border border-white/10 bg-ink-900/60 px-4 py-3 text-sm">
            <span className="text-white/60">Taps: {left + right}</span>
            <span className="font-display text-xl font-bold text-white">{countdown}s</span>
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <>
          <Card className="text-center" title="Tap analysis">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ["Tap rate", `${result.tapRate}/s`],
                ["Variability", `${Math.round(result.variability * 100)}%`],
                ["Fatigue index", `${result.fatigueIndex}`],
                ["Consistency", `${Math.round(result.consistency * 100)}%`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/8 bg-ink-900/60 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-white/35">{k}</p>
                  <p className="mt-0.5 font-semibold text-white">{v}</p>
                </div>
              ))}
            </div>
          </Card>
          {result.tapRate < 3.5 && (
            <p className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-2.5 text-xs text-amber-200">
              <Loader2 size={13} /> Low tap rate detected — this can be caused by hand fatigue, tremor, or motor slowing.
            </p>
          )}
        </>
      )}
    </TestScaffold>
  );
}
