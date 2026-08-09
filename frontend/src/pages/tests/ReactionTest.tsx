import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Timer, Zap } from "lucide-react";
import { TestScaffold } from "./TestScaffold";
import type { ReactionFeatures } from "../../lib/types";
import { scoreReaction } from "../../lib/scoring";
import { saveSessionResult } from "../../lib/session";
import { Button, Card } from "../../components/ui";

const TRIALS = 5;

type Phase = "idle" | "waiting" | "go" | "tooSoon" | "done";

export default function ReactionTest() {
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>("idle");
  const [trial, setTrial] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [premature, setPremature] = useState(0);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [result, setResult] = useState<ReactionFeatures | null>(null);

  const goAt = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTrial = () => {
    setPhase("waiting");
    setLastMs(null);
    const delay = 1500 + Math.random() * 2500;
    timeoutRef.current = setTimeout(() => {
      goAt.current = performance.now();
      setPhase("go");
    }, delay);
  };

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const respond = () => {
    if (phase === "waiting") {
      setPremature((p) => p + 1);
      setPhase("tooSoon");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }
    if (phase !== "go") return;
    const ms = performance.now() - goAt.current;
    const next = [...times, ms];
    setTimes(next);
    setLastMs(Math.round(ms));
    if (next.length >= TRIALS) {
      const mean = next.reduce((s, v) => s + v, 0) / next.length;
      const std = Math.sqrt(next.reduce((s, v) => s + (v - mean) ** 2, 0) / next.length);
      setResult({
        meanMs: Math.round(mean),
        variability: Math.round(std),
        premature,
        trials: TRIALS,
      });
      setPhase("done");
    } else {
      setTrial((t) => t + 1);
      startTrial();
    }
  };

  const save = () => {
    if (result) saveSessionResult(scoreReaction(result));
    nav("/screen");
  };

  const stageColor =
    phase === "go"
      ? "border-teal-400/50 bg-teal-500/20"
      : phase === "waiting"
      ? "border-white/10 bg-ink-800"
      : phase === "tooSoon"
      ? "border-rose-400/40 bg-rose-500/15"
      : "border-white/10 bg-ink-800";

  const stageText =
    phase === "idle"
      ? "Tap to begin"
      : phase === "waiting"
      ? "Wait for green…"
      : phase === "go"
      ? "TAP NOW!"
      : phase === "tooSoon"
      ? "Too soon! Wait for green."
      : "Complete";

  return (
    <TestScaffold
      title="Reaction Time"
      subtitle={`5 trials — tap the instant the screen turns green. ${TRIALS - trial} trial${TRIALS - trial === 1 ? "" : "s"} remaining.`}
      icon={<Timer size={20} />}
      footer={
        result ? (
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setPhase("idle"); setTimes([]); setTrial(0); setPremature(0); setResult(null); }}>
              Retake
            </Button>
            <Button onClick={save}>Save result</Button>
          </div>
        ) : undefined
      }
    >
      <Card padded={false}>
        <button
          onPointerDown={respond}
          disabled={phase === "done"}
          className={`flex h-64 w-full select-none flex-col items-center justify-center rounded-2xl border-2 transition-colors ${stageColor} ${
            phase === "go" ? "animate-pulseSoft" : ""
          }`}
        >
          {phase === "done" ? (
            <Zap size={40} className="text-teal-300" />
          ) : (
            <Zap size={36} className={phase === "go" ? "text-teal-300" : "text-white/25"} />
          )}
          <span
            className={`mt-3 font-display text-2xl font-bold ${
              phase === "go" ? "text-teal-200" : phase === "tooSoon" ? "text-rose-300" : "text-white/60"
            }`}
          >
            {stageText}
          </span>
        </button>
        <div className="flex items-center justify-between border-t border-white/8 px-5 py-3 text-xs text-white/45">
          <span>Completed: {times.length}/{TRIALS}</span>
          {lastMs != null && <span className="font-semibold text-white/80">{lastMs} ms</span>}
          {premature > 0 && <span className="text-rose-300">premature: {premature}</span>}
        </div>
      </Card>

      {phase === "idle" && (
        <Button onClick={startTrial} className="mt-4 w-full">
          Start trials
        </Button>
      )}
      {phase === "tooSoon" && (
        <Button onClick={startTrial} className="mt-4 w-full">
          Try again
        </Button>
      )}

      {result && (
        <Card className="mt-4" title="Reaction analysis">
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Mean", `${result.meanMs} ms`],
              ["Variability", `±${result.variability} ms`],
              ["Premature", result.premature],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-xl border border-white/8 bg-ink-900/60 px-3 py-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wider text-white/35">{k}</p>
                <p className="mt-0.5 font-semibold text-white">{v}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </TestScaffold>
  );
}
