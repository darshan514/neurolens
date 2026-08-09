import { useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Footprints, Gauge, Vibrate, Loader2, RotateCcw } from "lucide-react";
import { TestScaffold } from "./TestScaffold";
import {
  collectMotion,
  requestMotionPermission,
  analyzeTremor,
  analyzeBalance,
  analyzeGait,
  isMotionSupported,
  type MotionSample,
} from "../../lib/sensors";
import { scoreTremor, scoreGait, scoreBalance } from "../../lib/scoring";
import type { BalanceFeatures, GaitFeatures, TremorFeatures } from "../../lib/types";
import { getProfile } from "../../lib/mockApi";
import { saveSessionResult } from "../../lib/session";
import { Button, Card, cn } from "../../components/ui";

type Kind = "tremor" | "walking" | "balance";

const CONFIG: Record<Kind, { title: string; icon: ReactNode; duration: number; prompt: string }> = {
  tremor: {
    title: "Tremor (Sensors)",
    icon: <Vibrate size={20} />,
    duration: 20000,
    prompt:
      "Sit comfortably, rest your forearm on a table and hold the phone in your hand without touching the screen. Let your hand relax completely for 20 seconds.",
  },
  walking: {
    title: "Walking & Gait",
    icon: <Footprints size={20} />,
    duration: 30000,
    prompt:
      "Hold the phone in your hand and walk at your normal pace in a straight line, then turn around and walk back. Keep walking until the timer ends.",
  },
  balance: {
    title: "Balance",
    icon: <Gauge size={20} />,
    duration: 20000,
    prompt:
      "Stand on a flat surface with feet together. Hold the phone against your chest and stand as still as you can for 20 seconds.",
  },
};

export default function SensorTests({ kind }: { kind: Kind }) {
  const nav = useNavigate();
  const cfg = CONFIG[kind];
  const [phase, setPhase] = useState<"intro" | "running" | "done">("intro");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [samples, setSamples] = useState<MotionSample[]>([]);
  const [symmetry, setSymmetry] = useState(0.85);
  const [result, setResult] = useState<TremorFeatures | GaitFeatures | BalanceFeatures | null>(null);
  const runningRef = useRef(false);

  const start = async () => {
    setError("");
    if (!isMotionSupported()) {
      setError("Motion sensors are not available on this device/browser.");
      return;
    }
    const ok = await requestMotionPermission();
    if (!ok) {
      setError("Motion permission denied. Enable it in your browser settings to continue.");
      return;
    }
    runningRef.current = true;
    setPhase("running");
    setProgress(0);
    const data = await collectMotion(cfg.duration, (_s, p) => setProgress(p));
    if (!runningRef.current) return;
    setSamples(data);
    const profile = getProfile();
    if (kind === "tremor") setResult(analyzeTremor(data));
    else if (kind === "balance") setResult(analyzeBalance(data));
    else {
      const g = analyzeGait(data, profile.heightCm);
      g.swingSymmetry = symmetry;
      setResult(g);
    }
    setPhase("done");
  };

  const save = () => {
    if (!result) return;
    if (kind === "tremor") saveSessionResult(scoreTremor(result as TremorFeatures));
    else if (kind === "walking") saveSessionResult(scoreGait(result as GaitFeatures));
    else saveSessionResult(scoreBalance(result as BalanceFeatures));
    nav("/screen");
  };

  const rows = (): Array<[string, string]> => {
    if (!result) return [];
    if (kind === "tremor") {
      const r = result as TremorFeatures;
      return [
        ["Tremor freq", r.tremorFreqHz != null ? `${r.tremorFreqHz} Hz` : "none detected"],
        ["Tremor amplitude", r.tremorAmplitude != null ? `${r.tremorAmplitude} m/s²` : "—"],
        ["Total RMS", `${r.rms} m/s²`],
        ["Sensor stability", `${r.stability}%`],
      ];
    }
    if (kind === "balance") {
      const r = result as BalanceFeatures;
      return [
        ["Sway", `${r.sway} m/s²`],
        ["Path length", `${r.pathLength} m`],
        ["Sensor stability", `${r.stability}%`],
      ];
    }
    const r = result as GaitFeatures;
    return [
      ["Cadence", `${r.cadence} steps/min`],
      ["Step variability", `${Math.round(r.stepVariability * 100)}%`],
      ["Stride estimate", `${r.strideEstimate} m`],
      ["Swing symmetry", `${Math.round(r.swingSymmetry * 100)}%`],
    ];
  };

  return (
    <TestScaffold title={cfg.title} subtitle={cfg.prompt} icon={cfg.icon}>
      {phase === "intro" && (
        <Card>
          <p className="mb-4 text-sm leading-relaxed text-white/55">{cfg.prompt}</p>
          <p className="mb-5 rounded-xl border border-white/8 bg-ink-900/60 px-4 py-3 text-xs text-white/45">
            {kind === "tremor" &&
              "The phone's accelerometer and gyroscope will measure tremor frequency (classically 4–6 Hz in Parkinson's rest tremor) and amplitude."}
            {kind === "walking" &&
              "Step detection extracts cadence and step-timing variability. Arm-swing symmetry is self-reported since a single phone cannot measure both arms."}
            {kind === "balance" &&
              "Postural sway is derived from horizontal accelerations while standing still."}
          </p>
          <Button onClick={start} className="w-full">
            Start {Math.round(cfg.duration / 1000)}s measurement
          </Button>
        </Card>
      )}

      {phase === "running" && (
        <Card className="text-center">
          <div className="relative mx-auto flex h-40 w-40 items-center justify-center rounded-full border-4 border-white/10">
            <span className="animate-pulseSoft font-display text-3xl font-bold text-white">
              {Math.round(progress * 100)}%
            </span>
            <span
              className="absolute inset-0 -m-4 rounded-full border-4 border-transparent border-t-brand-400"
              style={{ transform: `rotate(${progress * 360}deg)` }}
            />
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-white/60">
            <Loader2 size={15} className="animate-spin" /> Measuring — hold steady…
          </p>
        </Card>
      )}

      {phase === "done" && result && (
        <>
          <Card title="Measurement result">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {rows().map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/8 bg-ink-900/60 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-white/35">{k}</p>
                  <p className="mt-0.5 font-semibold text-white">{v}</p>
                </div>
              ))}
            </div>
          </Card>

          {kind === "walking" && (
            <Card className="mt-4" title="Arm-swing symmetry (self-report)">
              <p className="mb-3 text-xs text-white/50">
                How symmetrical is your arm swing while walking? (1 = both arms swing equally)
              </p>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={symmetry}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setSymmetry(v);
                  if (result) setResult({ ...(result as GaitFeatures), swingSymmetry: v });
                }}
                className="w-full accent-teal-400"
              />
              <p className="mt-1 text-right text-sm font-semibold text-white">{Math.round(symmetry * 100)}%</p>
            </Card>
          )}

          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => { setPhase("intro"); setResult(null); }}>
              <RotateCcw size={15} /> Retake
            </Button>
            <Button onClick={save}>Save result</Button>
          </div>
        </>
      )}

      {error && (
        <p className={cn("mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300")}>{error}</p>
      )}
    </TestScaffold>
  );
}
