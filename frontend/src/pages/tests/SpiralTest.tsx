import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PenLine, RotateCcw, Sparkles } from "lucide-react";
import { TestScaffold } from "./TestScaffold";
import { analyzeSpiral, type DrawPoint } from "../../lib/drawing";
import type { DrawingFeatures } from "../../lib/types";
import { scoreSpiral } from "../../lib/scoring";
import { saveSessionResult } from "../../lib/session";
import { Button, Card } from "../../components/ui";

const SIZE = 360;

export default function SpiralTest() {
  const nav = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<DrawPoint[]>([]);
  const drawingRef = useRef(false);
  const lastRef = useRef<DrawPoint | null>(null);
  const startTimeRef = useRef(0);
  const [strokeCount, setStrokeCount] = useState(0);
  const [result, setResult] = useState<DrawingFeatures | null>(null);

  const drawSpiralGuide = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, SIZE, SIZE);
    // faint guide spiral
    ctx.strokeStyle = "rgba(74,110,240,0.18)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const turns = 2.6;
    for (let a = 0; a <= turns * 2 * Math.PI; a += 0.05) {
      const r = 10 + (a / (turns * 2 * Math.PI)) * (SIZE / 2 - 30);
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawSpiralGuide(ctx);
  }, []);

  const toPoint = (e: PointerEvent): DrawPoint => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * SIZE,
      y: ((e.clientY - rect.top) / rect.height) * SIZE,
      t: performance.now() - startTimeRef.current,
    };
  };

  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = toPoint(e);
    setStrokeCount((s) => s + 1);
  };

  const onMove = (e: PointerEvent) => {
    if (!drawingRef.current || !lastRef.current) return;
    const p = toPoint(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    pointsRef.current.push(p);
    lastRef.current = p;
  };

  const onUp = () => {
    drawingRef.current = false;
    lastRef.current = null;
  };

  const clear = () => {
    pointsRef.current = [];
    setStrokeCount(0);
    setResult(null);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawSpiralGuide(ctx);
  };

  const analyze = () => {
    if (pointsRef.current.length < 20) return;
    const feats = analyzeSpiral(pointsRef.current, SIZE);
    setResult(feats);
  };

  const save = () => {
    if (result) saveSessionResult(scoreSpiral(result));
    nav("/screen");
  };

  return (
    <TestScaffold
      title="Spiral Drawing"
      subtitle="Draw over the spiral from the centre outwards, 3 times. Keep the pen on the line."
      icon={<PenLine size={20} />}
      footer={
        result ? (
          <div className="flex gap-3">
            <Button variant="outline" onClick={clear}>
              <RotateCcw size={15} /> Redraw
            </Button>
            <Button onClick={save}>Save result</Button>
          </div>
        ) : undefined
      }
    >
      <Card padded={false}>
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          className="w-full touch-none rounded-2xl bg-ink-900"
          style={{ aspectRatio: "1" }}
        />
        <div className="flex items-center justify-between border-t border-white/8 px-5 py-3 text-xs text-white/45">
          <span>Strokes: {strokeCount}</span>
          <div className="flex gap-3">
            <button onClick={clear} className="hover:text-white">Clear</button>
            <button
              onClick={analyze}
              disabled={pointsRef.current.length < 20}
              className="font-medium text-brand-300 hover:text-brand-200 disabled:opacity-40"
            >
              Analyze drawing
            </button>
          </div>
        </div>
      </Card>

      {result && (
        <Card className="mt-4" title="Drawing analysis">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ["Deviation", `${result.deviation} px`],
              ["Smoothness", result.smoothness],
              ["Speed", `${result.speed} px/s`],
              ["Tremor freq", result.tremorFreqHz != null ? `${result.tremorFreqHz} Hz` : "none"],
              ["Tremor amp", result.tremorAmplitude != null ? `${result.tremorAmplitude} px` : "—"],
              ["Stability", result.stability],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/8 bg-ink-900/60 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-white/35">{k}</p>
                <p className="mt-0.5 font-semibold text-white">{v}</p>
              </div>
            ))}
          </div>
          {result.tremorFreqHz != null && (
            <p className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-2.5 text-xs text-amber-200">
              <Sparkles size={13} /> Tremor-like oscillation detected at {result.tremorFreqHz} Hz during drawing.
            </p>
          )}
        </Card>
      )}
    </TestScaffold>
  );
}
