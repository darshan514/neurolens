import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, CheckCircle2, XCircle } from "lucide-react";
import { TestScaffold, StepBadge } from "./TestScaffold";
import type { CognitiveFeatures } from "../../lib/types";
import { scoreCognitive } from "../../lib/scoring";
import { saveSessionResult } from "../../lib/session";
import { Button, Card } from "../../components/ui";

const WORDS = ["apple", "river", "table", "garden", "window", "candle"];
const DISTRACTORS = ["forest", "mirror", "bottle", "pencil", "mountain", "pillow"];
const DIGITS = [4, 7, 2, 9, 3, 6, 8];
const STROOP = [
  { word: "RED", color: "#2dd4bf" },
  { word: "BLUE", color: "#fb7185" },
  { word: "GREEN", color: "#fbbf24" },
  { word: "YELLOW", color: "#4a6ef0" },
  { word: "RED", color: "#fbbf24" },
  { word: "BLUE", color: "#4a6ef0" },
  { word: "GREEN", color: "#fb7185" },
  { word: "YELLOW", color: "#2dd4bf" },
];
const COLOR_NAMES = ["Red", "Blue", "Green", "Yellow"];

type Task = "recall" | "digits" | "stroop" | "done";

export default function CognitiveTest() {
  const nav = useNavigate();
  const [task, setTask] = useState<Task>("recall");
  const [stage, setStage] = useState<"study" | "answer">("study");
  const [countdown, setCountdown] = useState(8);
  const [picked, setPicked] = useState<string[]>([]);
  const [digitInput, setDigitInput] = useState("");
  const [stroopIdx, setStroopIdx] = useState(0);
  const [stroopHits, setStroopHits] = useState(0);
  const [stroopTimes, setStroopTimes] = useState<number[]>([]);
  const [strokeHint, setStrokeHint] = useState(false);
  const [recallHits, setRecallHits] = useState<number | null>(null);
  const [digitHits, setDigitHits] = useState<number | null>(null);
  const stroopStart = useRef(0);
  const [result, setResult] = useState<CognitiveFeatures | null>(null);

  // study countdown
  useEffect(() => {
    if (task !== "recall" || stage !== "study") return;
    if (countdown <= 0) {
      setStage("answer");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, stage, task]);

  // digit span study
  useEffect(() => {
    if (task !== "digits" || stage !== "study") return;
    if (countdown <= 0) {
      setStage("answer");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, stage, task]);

  const submitRecall = () => {
    const hits = picked.filter((w) => WORDS.includes(w)).length;
    setRecallHits(hits);
    setTask("digits");
    setStage("study");
    setCountdown(6);
  };

  const submitDigits = () => {
    const correct = digitInput.trim().split(/\s*/).map(Number);
    const hits = DIGITS.filter((d, i) => correct[i] === d).length;
    setDigitHits(hits);
    setTask("stroop");
    setStroopIdx(0);
  };

  const stroopAnswer = (color: string) => {
    const ms = performance.now() - stroopStart.current;
    setStroopTimes((prev) => [...prev, ms]);
    const trial = STROOP[stroopIdx];
    if (color === trial.color) setStroopHits((h) => h + 1);
    if (stroopIdx + 1 >= STROOP.length) {
      finish();
    } else {
      setStroopIdx((i) => i + 1);
      setStrokeHint(false);
    }
  };

  const beginStroopTrial = () => {
    setStrokeHint(true);
    stroopStart.current = performance.now();
  };

  const finish = () => {
    const memoryScore = recallHits != null ? Math.round((recallHits / WORDS.length) * 100) : 0;
    const attentionScore = digitHits != null ? Math.round((digitHits / DIGITS.length) * 100) : 0;
    const executiveScore = Math.round((stroopHits / STROOP.length) * 100);
    const responseMs = stroopTimes.length
      ? Math.round(stroopTimes.reduce((s, v) => s + v, 0) / stroopTimes.length)
      : 0;
    setResult({ memoryScore, attentionScore, executiveScore, responseMs });
    setTask("done");
  };

  const save = () => {
    if (result) saveSessionResult(scoreCognitive(result));
    nav("/screen");
  };

  const stepIdx = task === "recall" ? 1 : task === "digits" ? 2 : task === "stroop" ? 3 : 3;

  return (
    <TestScaffold
      title="Cognitive Mini-Tests"
      subtitle="Word recall, digit span and a Stroop-style attention task — roughly 2 minutes."
      icon={<Brain size={20} />}
      footer={
        result ? (
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setTask("recall"); setStage("study"); setCountdown(8); setPicked([]); setDigitInput(""); setRecallHits(null); setDigitHits(null); setStroopIdx(0); setStroopHits(0); setStroopTimes([]); setResult(null); }}>
              Retake
            </Button>
            <Button onClick={save}>Save result</Button>
          </div>
        ) : undefined
      }
    >
      <StepBadge current={stepIdx} total={3} />

      {/* ---------------- word recall ---------------- */}
      {task === "recall" && stage === "study" && (
        <Card className="mt-4 text-center">
          <p className="text-sm text-white/55">Memorize these {WORDS.length} words — they disappear in {countdown}s:</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {WORDS.map((w) => (
              <span key={w} className="rounded-xl border border-brand-400/25 bg-brand-500/10 px-3 py-3 font-display text-sm font-semibold text-white">
                {w}
              </span>
            ))}
          </div>
        </Card>
      )}
      {task === "recall" && stage === "answer" && (
        <Card className="mt-4">
          <p className="mb-3 text-sm text-white/70">Select the {WORDS.length} words you saw:</p>
          <div className="grid grid-cols-3 gap-2">
            {[...WORDS, ...DISTRACTORS].sort(() => Math.random() - 0.5).map((w) => {
              const on = picked.includes(w);
              return (
                <button
                  key={w}
                  onClick={() => setPicked((p) => (on ? p.filter((x) => x !== w) : [...p, w]))}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                    on ? "border-teal-400/50 bg-teal-500/15 text-teal-200" : "border-white/10 text-white/60 hover:border-white/25"
                  }`}
                >
                  {w}
                </button>
              );
            })}
          </div>
          <Button onClick={submitRecall} disabled={picked.length !== WORDS.length} className="mt-4 w-full">
            Submit recall ({picked.length}/{WORDS.length})
          </Button>
        </Card>
      )}

      {/* ---------------- digit span ---------------- */}
      {task === "digits" && stage === "study" && (
        <Card className="mt-4 text-center">
          <p className="text-sm text-white/55">Remember this digit sequence — it disappears in {countdown}s:</p>
          <p className="mt-4 font-display text-4xl font-bold tracking-[0.3em] text-brand-200">{DIGITS.join(" ")}</p>
        </Card>
      )}
      {task === "digits" && stage === "answer" && (
        <Card className="mt-4">
          <p className="mb-3 text-sm text-white/70">Enter the digits in order:</p>
          <input
            value={digitInput}
            onChange={(e) => setDigitInput(e.target.value.replace(/[^0-9 ]/g, ""))}
            autoFocus
            className="w-full rounded-xl border border-white/10 bg-ink-900/80 px-3.5 py-3 text-center font-mono text-xl tracking-[0.2em] text-white outline-none focus:border-brand-400/60"
            placeholder="4 7 2 …"
          />
          <Button onClick={submitDigits} disabled={digitInput.trim().length === 0} className="mt-4 w-full">
            Submit digits
          </Button>
        </Card>
      )}

      {/* ---------------- stroop ---------------- */}
      {task === "stroop" && (
        <Card className="mt-4">
          {!strokeHint ? (
            <div className="text-center">
              <p className="mb-4 text-sm text-white/55">
                Click the button matching the <strong>ink color</strong> of the word, not the word itself.
              </p>
              <Button onClick={beginStroopTrial} className="w-full">
                Start trial {stroopIdx + 1}/{STROOP.length}
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <p className="mb-5 font-display text-5xl font-extrabold uppercase" style={{ color: STROOP[stroopIdx].color }}>
                {STROOP[stroopIdx].word}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {COLOR_NAMES.map((c) => {
                  const COLOR_HEX: Record<string, string> = { Red: "#fb7185", Blue: "#4a6ef0", Green: "#2dd4bf", Yellow: "#fbbf24" };
                  const colorHex = COLOR_HEX[c];
                  return (
                    <button
                      key={c}
                      onClick={() => stroopAnswer(colorHex)}
                      className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-white/30"
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ---------------- results ---------------- */}
      {task === "done" && result && (
        <Card className="mt-4" title="Cognitive results">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Word recall", `${result.memoryScore}%`],
              ["Digit span", `${result.attentionScore}%`],
              ["Executive", `${result.executiveScore}%`],
              ["Response", `${result.responseMs} ms`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/8 bg-ink-900/60 px-3 py-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wider text-white/35">{k}</p>
                <p className="mt-0.5 font-semibold text-white">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {recallHits === WORDS.length && (
              <span className="flex items-center gap-1 text-teal-300"><CheckCircle2 size={13} /> Perfect recall</span>
            )}
            {digitHits === DIGITS.length && (
              <span className="flex items-center gap-1 text-teal-300"><CheckCircle2 size={13} /> Perfect digit span</span>
            )}
            {stroopHits < STROOP.length - 1 && (
              <span className="flex items-center gap-1 text-rose-300"><XCircle size={13} /> {STROOP.length - stroopHits} Stroop errors</span>
            )}
          </div>
        </Card>
      )}
    </TestScaffold>
  );
}
