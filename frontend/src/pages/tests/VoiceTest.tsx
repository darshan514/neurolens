import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, CheckCircle2, Loader2 } from "lucide-react";
import { TestScaffold, StepBadge } from "./TestScaffold";
import { recordAudio, analyzeVoice, requestMic, round2 } from "../../lib/audio";
import type { VoiceFeatures } from "../../lib/types";
import { scoreVoice } from "../../lib/scoring";
import { saveSessionResult } from "../../lib/session";
import { Button, Card } from "../../components/ui";

const STEPS = [
  {
    title: "Sustain “aaaaaa”",
    prompt: "Take a breath and hold the sound “aaaaaa” for the full 6 seconds at a comfortable pitch.",
    duration: 6500,
  },
  {
    title: "Repeat “pa-ta-ka”",
    prompt: "Repeat “pa-ta-ka, pa-ta-ka, pa-ta-ka…” as quickly and clearly as you can for 6 seconds.",
    duration: 6500,
  },
  {
    title: "Describe your day",
    prompt: "Speak freely for 20 seconds about what you did today. Keep talking until it stops.",
    duration: 20000,
  },
];

export default function VoiceTest() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState<"rec" | "analyze" | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [features, setFeatures] = useState<VoiceFeatures[]>([]);
  const [latest, setLatest] = useState<VoiceFeatures | null>(null);

  const start = async () => {
    setError("");
    setBusy("rec");
    try {
      const stream = await requestMic(); // permission first so the prompt timing is clean
      setRecording(true);
      setCountdown(STEPS[step].duration / 1000);
      const timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
      const rec = await recordAudio(STEPS[step].duration, stream);
      clearInterval(timer);
      setRecording(false);
      setBusy("analyze");
      await new Promise((r) => setTimeout(r, 900)); // let the spinner read
      const feats = analyzeVoice(rec.samples, rec.sampleRate);
      setLatest(feats);
      setFeatures((prev) => [...prev, feats]);
      setBusy(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access failed.");
      setRecording(false);
      setBusy(null);
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      setLatest(null);
    } else {
      finish();
    }
  };

  const finish = () => {
    const n = features.length;
    if (n === 0) return;
    const avg = (fn: (f: VoiceFeatures) => number) =>
      features.reduce((s, f) => s + fn(f), 0) / n;
    const merged: VoiceFeatures = {
      f0Hz: Math.round(avg((f) => f.f0Hz)),
      jitter: round2(avg((f) => f.jitter)),
      shimmer: round2(avg((f) => f.shimmer)),
      hnrDb: round2(avg((f) => f.hnrDb)),
      energy: round2(avg((f) => f.energy)),
      pausesPerMin: round2(avg((f) => f.pausesPerMin)),
      speechRate: round2(avg((f) => f.speechRate)),
      pitchVariation: Math.round(avg((f) => f.pitchVariation)),
      voicedRatio: round2(avg((f) => f.voicedRatio)),
      quality: Math.round(avg((f) => f.quality)),
    };
    saveSessionResult(scoreVoice(merged));
    nav("/screen");
  };

  const stepInfo = STEPS[step];
  const featureChips: Array<[string, string]> = latest
    ? [
        ["Pitch", `${latest.f0Hz} Hz`],
        ["Jitter", `${latest.jitter}%`],
        ["Shimmer", `${latest.shimmer}%`],
        ["HNR", `${latest.hnrDb} dB`],
        ["Rate", `${latest.speechRate} syl/s`],
        ["Pauses/min", `${latest.pausesPerMin}`],
        ["Quality", `${latest.quality}%`],
      ]
    : [];

  return (
    <TestScaffold
      title="Voice & Speech"
      subtitle="Sustain, diadochokinesis and free speech — analyzed for jitter, shimmer, pitch, pauses and rate."
      icon={<Mic size={20} />}
      footer={
        features.length > 0 ? (
          <Button variant="outline" onClick={finish} disabled={features.length < STEPS.length}>
            {features.length < STEPS.length ? `${features.length}/${STEPS.length} tasks done` : "Complete & save result"}
          </Button>
        ) : undefined
      }
    >
      <StepBadge current={step + 1} total={STEPS.length} />

      <Card className="mt-4">
        <h3 className="font-display text-base font-semibold text-white">{stepInfo.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/55">{stepInfo.prompt}</p>

        {recording && (
          <div className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/20">
              <span className="animate-pulseSoft">
                <Mic size={26} className="text-rose-300" />
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-rose-200">Recording… {countdown}s</p>
            <p className="mt-1 text-xs text-rose-200/60">Keep going until it stops</p>
          </div>
        )}

        {busy === "analyze" && (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-brand-400/25 bg-brand-500/10 p-4 text-sm text-brand-200">
            <Loader2 size={16} className="animate-spin" /> Extracting acoustic features…
          </div>
        )}

        {error && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

        {!recording && busy !== "analyze" && (
          <Button onClick={start} className="mt-5 w-full" variant={latest ? "outline" : "primary"}>
            <MicOff size={16} /> {latest ? "Redo this task" : "Start recording"}
          </Button>
        )}
      </Card>

      {latest && (
        <Card className="mt-4" title="Extracted features" subtitle="Raw acoustic biomarkers from this task">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {featureChips.map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/8 bg-ink-900/60 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-white/35">{k}</p>
                <p className="mt-0.5 font-semibold text-white">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-teal-300">
            <CheckCircle2 size={14} /> Saved to this session
          </div>
          <Button onClick={next} className="mt-4 w-full">
            {step < STEPS.length - 1 ? "Continue to next task" : "Finish voice test"}
          </Button>
        </Card>
      )}
    </TestScaffold>
  );
}
