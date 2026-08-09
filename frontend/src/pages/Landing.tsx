import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  AudioLines,
  Brain,
  ChevronDown,
  Fingerprint,
  Footprints,
  Gauge,
  Hand,
  HeartPulse,
  Languages,
  LineChart,
  MapPin,
  Mic,
  PenLine,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Timer,
  Vibrate,
  WifiOff,
} from "lucide-react";
import { Logo } from "../components/Layout";
import { DisclaimerBanner } from "../components/ui";

const FEATURES = [
  { icon: Mic, title: "Voice & Speech", desc: "Jitter, shimmer, pitch, pauses and speech rate extracted from 90 seconds of natural speech." },
  { icon: Hand, title: "Finger Tapping", desc: "Speed, fatigue and rhythm variability from rapid tapping on your phone screen." },
  { icon: PenLine, title: "Spiral Drawing", desc: "The classic spiral test, digitized: tremor frequency, smoothness and deviation." },
  { icon: Vibrate, title: "Sensor Tremor", desc: "Accelerometer + gyroscope measure tremor frequency and amplitude at rest." },
  { icon: Footprints, title: "Walking & Gait", desc: "Cadence, step variability and stride estimates while walking with your phone." },
  { icon: ScanFace, title: "Facial Mobility", desc: "Blink rate, smile amplitude and expression variability from the front camera." },
  { icon: Gauge, title: "Balance", desc: "Postural sway measured while standing still for 30 seconds." },
  { icon: Timer, title: "Reaction Time", desc: "A 5-trial reaction game quantifying motor latency and consistency." },
  { icon: Brain, title: "Cognitive Mini-Tests", desc: "Word recall, digit span and attention exercises for cognitive screening." },
];

const WORKFLOW = [
  { step: "01", title: "Create your baseline", desc: "A 5-minute guided screening establishes your personal digital neurological baseline." },
  { step: "02", title: "Screen weekly", desc: "Repeat individual tests at home — every result is compared to your own history, not population averages." },
  { step: "03", title: "Understand the AI", desc: "Every score is explained in plain language with the raw biomarkers, confidence and uncertainty behind it." },
  { step: "04", title: "Share with your doctor", desc: "Export professional PDF reports, track medication response, and monitor progression over months." },
];

const STATS = [
  { value: "9", label: "biomarker domains" },
  { value: "<5", label: "min per screening" },
  { value: "100%", label: "on-device & private" },
  { value: "6+", label: "languages" },
];

const FAQS = [
  {
    q: "Does NeuroLens diagnose Parkinson's disease?",
    a: "No. NeuroLens is a screening and monitoring aid. It estimates neurological risk from digital biomarkers and always directs you to a qualified neurologist for any clinical decision. It can never replace a medical diagnosis.",
  },
  {
    q: "What happens to my data?",
    a: "Voice and motion data is analyzed on your device where possible. When you consent, anonymized data may contribute to an opt-in research dataset. You can delete your data at any time from Settings.",
  },
  {
    q: "How accurate is the risk score?",
    a: "The score fuses multiple biomarkers and always reports a confidence level and the reasoning behind the result. Digital biomarkers are supportive signals, not definitive tests — borderline results are flagged for discussion with a clinician.",
  },
  {
    q: "Do I need special equipment?",
    a: "No. Any modern smartphone with a microphone and motion sensors works. The examination runs offline with local analysis when connectivity is limited.",
  },
  {
    q: "Who can use NeuroLens?",
    a: "Patients monitoring symptoms, caregivers tracking progression, neurologists reviewing objective measurements, and rural health workers running low-cost community screening.",
  },
];

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-ink-950 text-white/90">
      {/* nav */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-ink-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-white/60 md:flex">
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#features" className="hover:text-white">Biomarkers</a>
            <a href="#science" className="hover:text-white">Science</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-white/70 hover:text-white">Sign in</Link>
            <Link
              to="/dashboard"
              className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-glow hover:from-brand-400 hover:to-brand-500"
            >
              Open app
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_0%,rgba(74,110,240,0.25),transparent)]" />
        <div className="pointer-events-none absolute -left-32 top-40 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-20 h-96 w-96 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 md:grid-cols-2 md:py-28">
          <div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/25 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-300">
                <Sparkles size={13} />
                AI-assisted screening — not a diagnostic tool
              </span>
              <h1 className="mt-5 font-display text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
                A full digital{" "}
                <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-teal-300 bg-clip-text text-transparent">
                  neurological examination
                </span>{" "}
                in your pocket.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/60 md:text-lg">
                NeuroLens combines voice, speech, motor, tremor, gait, facial and cognitive
                biomarkers into one explainable AI screening engine — built for early detection,
                weekly monitoring and longitudinal tracking of movement disorders.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3 font-semibold text-white shadow-glow hover:from-brand-400 hover:to-brand-500"
                >
                  Start your screening <ArrowRight size={17} />
                </Link>
                <a
                  href="#how"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3 font-medium text-white/80 hover:bg-white/5"
                >
                  How it works
                </a>
              </div>
              <div className="mt-10 grid max-w-md grid-cols-3 gap-4">
                {STATS.map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/8 bg-ink-800/50 p-3 text-center">
                    <p className="font-display text-xl font-bold text-teal-300">{s.value}</p>
                    <p className="mt-0.5 text-[11px] leading-tight text-white/45">{s.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* hero visual: biomarker radar card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative mx-auto w-full max-w-md"
          >
            <div className="animate-floaty rounded-3xl border border-white/10 bg-ink-800/70 p-6 shadow-card backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/40">Overall screening score</p>
                  <p className="font-display text-3xl font-bold text-white">76<span className="text-base text-white/40">/100</span></p>
                </div>
                <span className="rounded-full border border-teal-400/25 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-300">Low risk</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  ["Speech", 68, "#fbbf24"],
                  ["Finger dexterity", 72, "#4a6ef0"],
                  ["Tremor", 81, "#2dd4bf"],
                  ["Gait", 74, "#4a6ef0"],
                  ["Balance", 85, "#2dd4bf"],
                  ["Cognition", 79, "#fbbf24"],
                ].map(([label, v, c]) => (
                  <div key={label as string} className="rounded-xl border border-white/8 bg-ink-900/60 p-3">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/55">{label}</span>
                      <span className="font-semibold" style={{ color: c as string }}>{v}</span>
                    </div>
                    <div className="mt-2 h-1 rounded-full bg-white/8">
                      <div className="h-full rounded-full" style={{ width: `${v}%`, background: c as string }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/8 bg-ink-900/60 px-3 py-2 text-[11px] text-white/50">
                <ShieldCheck size={14} className="text-teal-300" />
                Explainable AI: every score shows its raw biomarkers, confidence and reasoning
              </div>
            </div>
            <div className="animate-pulseSoft absolute -right-3 -top-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-teal-500 shadow-glow">
              <Activity size={20} className="text-white" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="border-t border-white/8 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">Screening, the way a neurologist would</h2>
            <p className="mt-3 text-white/55">
              Instead of a single black-box model, NeuroLens runs a structured examination and fuses
              every digital biomarker into one explainable risk estimate.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {WORKFLOW.map((w, i) => (
              <motion.div
                key={w.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-white/8 bg-ink-800/50 p-5"
              >
                <span className="font-display text-2xl font-bold text-brand-400/60">{w.step}</span>
                <h3 className="mt-3 font-semibold text-white">{w.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{w.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* features */}
      <section id="features" className="border-t border-white/8 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-bold md:text-4xl">Nine biomarker domains, one score</h2>
              <p className="mt-3 max-w-xl text-white/55">
                Each domain maps to classic bedside tests, digitized for the phone you already carry.
              </p>
            </div>
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-300 hover:text-brand-200">
              Try the examination <ArrowRight size={15} />
            </Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 3) * 0.06 }}
                className="group rounded-2xl border border-white/8 bg-ink-800/50 p-5 transition-colors hover:border-brand-400/30 hover:bg-ink-800/80"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300 transition-transform group-hover:scale-110">
                  <f.icon size={19} />
                </span>
                <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/50">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* science / explainability */}
      <section id="science" className="border-t border-white/8 py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/25 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-200">
              <LineChart size={13} /> Explainable AI
            </span>
            <h2 className="mt-5 font-display text-3xl font-bold md:text-4xl">
              No black boxes. See the reasoning behind every score.
            </h2>
            <p className="mt-4 leading-relaxed text-white/55">
              NeuroLens never just says “high risk”. Every result surfaces the raw measurements,
              flags the features outside typical ranges, and explains what changed compared to your
              own baseline — with a confidence score that accounts for recording quality, background
              noise, lighting and camera position.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-white/70">
              {[
                ["Speech stability", "jitter, shimmer, HNR, pitch variation"],
                ["Motor control", "tap speed, fatigue index, drawing deviation"],
                ["Tremor analysis", "frequency, amplitude, RMS, FFT power"],
                ["Gait symmetry", "cadence, step variability, stride"],
              ].map(([k, v]) => (
                <li key={k} className="flex items-start gap-3">
                  <Sparkles size={15} className="mt-0.5 shrink-0 text-teal-300" />
                  <span><strong className="text-white">{k}</strong> <span className="text-white/40">—</span> {v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-ink-800/60 p-6 shadow-card">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">AI Health Coach — sample output</p>
            <div className="mt-4 space-y-3 text-sm leading-relaxed">
              <div className="rounded-2xl rounded-tl-sm border border-white/8 bg-ink-900/70 p-4 text-white/80">
                “Your <strong className="text-teal-300">speech became slower</strong> compared to last month
                — speech rate dropped from 4.8 to 3.9 syllables per second, and pitch variation
                decreased 12%. Your <strong className="text-amber-300">finger dexterity</strong> has declined
                slightly (tap rate −8%).”
              </div>
              <div className="rounded-2xl rounded-tl-sm border border-white/8 bg-ink-900/70 p-4 text-white/80">
                “These changes are worth discussing with your neurologist at your next visit. Consider
                repeating this screening next week to confirm the trend.”
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Confidence 82%", "Recording quality: good", "Reason: lower SNR than usual"].map((b) => (
                <span key={b} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* demo */}
      <section className="border-t border-white/8 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">See a screening session</h2>
          <p className="mt-3 text-white/55">A guided walkthrough of the voice and spiral tests.</p>
          <div className="relative mt-8 overflow-hidden rounded-3xl border border-white/10 bg-ink-900">
            <div className="flex aspect-video items-center justify-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">
                <AudioLines size={32} />
              </span>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink-950/70 backdrop-blur-[2px]">
              <p className="text-sm text-white/70">Demo video placeholder</p>
              <p className="mt-1 text-xs text-white/40">Replace with a product walkthrough recording</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-white/8 py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center font-display text-3xl font-bold md:text-4xl">Frequently asked questions</h2>
          <div className="mt-10 space-y-3">
            {FAQS.map((f, i) => (
              <div key={f.q} className="overflow-hidden rounded-2xl border border-white/8 bg-ink-800/50">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-medium text-white">{f.q}</span>
                  <ChevronDown size={17} className={`shrink-0 text-white/40 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <p className="px-5 pb-4 text-sm leading-relaxed text-white/55">{f.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* contact / CTA */}
      <section className="border-t border-white/8 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="rounded-3xl border border-brand-400/20 bg-gradient-to-br from-brand-500/15 via-ink-800/60 to-teal-500/10 p-10 text-center">
            <h2 className="font-display text-3xl font-bold">Start your digital neurological baseline today</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/60">
              Five minutes. No equipment. Every result explained, private, and shareable with your doctor.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link to="/dashboard" className="rounded-xl bg-white px-6 py-3 font-semibold text-ink-950 hover:bg-white/90">
                Create free baseline
              </Link>
              <a href="mailto:hello@neurolens.ai" className="rounded-xl border border-white/15 px-6 py-3 font-medium text-white/80 hover:bg-white/5">
                Contact the team
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/40">
              <span className="flex items-center gap-1.5"><MapPin size={13} /> Nearest neurologist finder</span>
              <span className="flex items-center gap-1.5"><Languages size={13} /> English · தமிழ் · తెలుగు · हिन्दी · മലയാളം</span>
              <span className="flex items-center gap-1.5"><WifiOff size={13} /> Offline mode</span>
              <span className="flex items-center gap-1.5"><Stethoscope size={13} /> Doctor portal</span>
              <span className="flex items-center gap-1.5"><HeartPulse size={13} /> Medication tracking</span>
              <span className="flex items-center gap-1.5"><Fingerprint size={13} /> On-device privacy</span>
            </div>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-white/8">
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Logo />
            <p className="text-xs text-white/40">© 2026 NeuroLens AI. Screening aid — not a medical device.</p>
          </div>
          <DisclaimerBanner />
        </div>
      </footer>
    </div>
  );
}
