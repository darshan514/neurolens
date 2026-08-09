import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ScanFace, VideoOff } from "lucide-react";
import { TestScaffold } from "./TestScaffold";
import type { FacialFeatures } from "../../lib/types";
import { scoreFacial } from "../../lib/scoring";
import { saveSessionResult } from "../../lib/session";
import { Button, Card } from "../../components/ui";

const DURATION = 15000;
const SAMPLE_MS = 120;
const W = 160;
const H = 120;

// region boxes (normalized within face crop: center 70% width, upper 75% height)
const REGIONS = {
  eyes: { x: 0.15, y: 0.05, w: 0.7, h: 0.28 }, // upper third — blinks
  mouth: { x: 0.2, y: 0.6, w: 0.6, h: 0.3 }, // lower region — smile
};

export default function FacialTest() {
  const nav = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<number[]>([]);
  const eyeEventsRef = useRef<number[]>([]); // frame indices of eye-region motion spikes
  const mouthActivityRef = useRef<number[]>([]); // per-frame mouth motion
  const [phase, setPhase] = useState<"intro" | "running" | "done">("intro");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [camOn, setCamOn] = useState(false);
  const [result, setResult] = useState<FacialFeatures | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const grayRegion = (ctx: CanvasRenderingContext2D, r: typeof REGIONS.eyes): number => {
    const x0 = Math.floor(r.x * W);
    const y0 = Math.floor(r.y * H);
    const w = Math.floor(r.w * W);
    const h = Math.floor(r.h * H);
    const img = ctx.getImageData(x0, y0, w, h).data;
    let sum = 0;
    for (let i = 0; i < img.length; i += 4) sum += 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
    return sum / (img.length / 4);
  };

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
      setPhase("running");
      runCapture();
    } catch {
      setError("Camera access failed or is unavailable in this browser.");
    }
  };

  const runCapture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !videoRef.current) return;

    const started = performance.now();
    let lastSample = 0;
    let prevEyes: number | null = null;
    let prevMouth: number | null = null;
    let frameIdx = 0;
    let luminance = 0;
    let lumCount = 0;

    const loop = (now: number) => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;
      const elapsed = now - started;
      if (now - lastSample >= SAMPLE_MS) {
        lastSample = now;
        ctx.drawImage(video, 0, 0, W, H);
        const eyes = grayRegion(ctx, REGIONS.eyes);
        const mouth = grayRegion(ctx, REGIONS.mouth);
        luminance += eyes;
        lumCount++;
        if (prevEyes != null) {
          const eyeDiff = Math.abs(eyes - prevEyes);
          const mouthDiff = Math.abs(mouth - (prevMouth ?? mouth));
          framesRef.current.push(eyeDiff);
          mouthActivityRef.current.push(mouthDiff);
          // blink: eye-region spike ~100–450ms (1–3 samples)
          const lastEvent = eyeEventsRef.current[eyeEventsRef.current.length - 1] ?? -10;
          if (eyeDiff > 9 && (frameIdx === 0 || frameIdx - lastEvent > 3)) {
            eyeEventsRef.current.push(frameIdx);
          }
          frameIdx++;
        }
        prevEyes = eyes;
        prevMouth = mouth;
        setProgress(Math.min(1, elapsed / DURATION));
      }
      if (elapsed < DURATION) {
        requestAnimationFrame(loop);
      } else {
        finish(luminance / Math.max(1, lumCount));
      }
    };
    requestAnimationFrame(loop);
  };

  const finish = (avgLum: number) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCamOn(false);
    const total = framesRef.current.length;
    const meanMotion = framesRef.current.reduce((s, v) => s + v, 0) / Math.max(1, total);
    // expressiveness: map mean frame-diff into 0..1 (typical expressive face ≈ 4–9)
    const expressiveness = Math.max(0, Math.min(1, meanMotion / 9));
    const rigidity = Math.max(0, Math.min(1, 1 - expressiveness));
    // blink rate: events with 1–3 sample spacing = real blinks
    const blinks = eyeEventsRef.current.length;
    const blinkRate = Math.round((blinks / DURATION) * 60000);
    // smile amplitude: mouth-region activity in second third (smile window) vs overall
    const third = Math.floor(mouthActivityRef.current.length / 3);
    const smileWindow = mouthActivityRef.current.slice(third, third * 2);
    const smileMean = smileWindow.reduce((s, v) => s + v, 0) / Math.max(1, smileWindow.length);
    const overallMouth = mouthActivityRef.current.reduce((s, v) => s + v, 0) / Math.max(1, mouthActivityRef.current.length);
    const smileAmplitude = Math.max(0, Math.min(1, smileMean / Math.max(1, overallMouth * 2.2)));
    // lighting quality
    const quality = Math.max(0, Math.min(100, Math.round(100 - Math.abs(avgLum - 120) * 0.7)));

    setResult({
      blinkRate,
      smileAmplitude: Math.round(smileAmplitude * 100) / 100,
      rigidity: Math.round(rigidity * 100) / 100,
      expressiveness: Math.round(expressiveness * 100) / 100,
      quality,
    });
    setPhase("done");
  };

  const save = () => {
    if (result) saveSessionResult(scoreFacial(result));
    nav("/screen");
  };

  return (
    <TestScaffold
      title="Facial Mobility"
      subtitle="Front camera motion analysis — blink rate, smile amplitude and expressiveness. (Beta: motion-based proxy without face landmarks.)"
      icon={<ScanFace size={20} />}
      footer={
        result ? (
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setPhase("intro"); setResult(null); framesRef.current = []; eyeEventsRef.current = []; mouthActivityRef.current = []; }}>
              Retake
            </Button>
            <Button onClick={save}>Save result</Button>
          </div>
        ) : undefined
      }
    >
      {phase === "intro" && (
        <Card>
          <ol className="mb-4 list-inside list-decimal space-y-1.5 text-sm text-white/60">
            <li>Look directly at the camera, face filling the frame.</li>
            <li>Blink naturally for the first 5 seconds.</li>
            <li>Smile as big as you can for the middle 5 seconds.</li>
            <li>Relax with a neutral face for the last 5 seconds.</li>
          </ol>
          <Button onClick={start} className="w-full">
            Enable camera & start
          </Button>
        </Card>
      )}

      {phase === "running" && (
        <Card padded={false}>
          <div className="relative overflow-hidden rounded-t-2xl bg-ink-900">
            <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
            <div className="absolute inset-x-0 top-0 h-1 bg-white/10">
              <div className="h-full bg-gradient-to-r from-brand-400 to-teal-400" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-xl border border-dashed border-teal-300/50 px-8 py-12 text-center text-xs text-teal-200/80">
                {Math.round(progress * 100)}% — keep your face in the frame
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 px-5 py-3 text-xs text-white/50">
            <Loader2 size={13} className="animate-spin" /> Analyzing facial motion…
          </div>
        </Card>
      )}

      {phase === "done" && result && (
        <Card title="Facial analysis">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ["Blink rate", `${result.blinkRate}/min`],
              ["Smile amplitude", `${Math.round(result.smileAmplitude * 100)}%`],
              ["Rigidity", `${Math.round(result.rigidity * 100)}%`],
              ["Expressiveness", `${Math.round(result.expressiveness * 100)}%`],
              ["Lighting quality", `${result.quality}%`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/8 bg-ink-900/60 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-white/35">{k}</p>
                <p className="mt-0.5 font-semibold text-white">{v}</p>
              </div>
            ))}
          </div>
          {!camOn && (
            <p className="mt-3 flex items-center gap-2 text-xs text-white/40">
              <VideoOff size={13} /> Camera stopped — your video is never recorded or uploaded.
            </p>
          )}
        </Card>
      )}

      {error && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
    </TestScaffold>
  );
}
