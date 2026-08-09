import { useState } from "react";
import { Check, Database, Globe, ShieldCheck, Trash2, User } from "lucide-react";
import { useI18n, LANGS } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { getProfile, saveProfile } from "../lib/mockApi";
import { Button, Card, DisclaimerBanner, PageHeading, cn } from "../components/ui";
import { MotionPage } from "../components/Layout";

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(() => getProfile());
  const [saved, setSaved] = useState(false);
  const [consent, setConsent] = useState(false);
  const [cleared, setCleared] = useState(false);

  const save = () => {
    saveProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const clearData = () => {
    localStorage.removeItem("nl_results");
    localStorage.removeItem("nl_meds");
    sessionStorage.removeItem("nl_session_domains");
    setCleared(true);
    setTimeout(() => setCleared(false), 1500);
  };

  return (
    <MotionPage>
      <PageHeading title={t("navSettings")} subtitle="Profile, language, privacy and data management." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("profile")} subtitle={user?.email}>
          <div className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">{t("name")}</label>
              <input
                defaultValue={user?.name}
                className="w-full rounded-xl border border-white/10 bg-ink-900/80 px-3.5 py-2.5 text-sm text-white outline-none focus:border-brand-400/60"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">{t("heightCm")}</label>
              <input
                type="number"
                value={profile.heightCm}
                onChange={(e) => setProfile({ ...profile, heightCm: Number(e.target.value) || 170 })}
                className="w-full rounded-xl border border-white/10 bg-ink-900/80 px-3.5 py-2.5 text-sm text-white outline-none focus:border-brand-400/60"
              />
              <p className="mt-1 text-[11px] text-white/35">Used to estimate stride length during gait analysis.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Dominant hand</label>
              <div className="grid grid-cols-2 gap-2">
                {(["R", "L"] as const).map((h) => (
                  <button
                    key={h}
                    onClick={() => setProfile({ ...profile, dominantHand: h })}
                    className={cn(
                      "rounded-xl border px-4 py-2 text-sm font-medium",
                      profile.dominantHand === h
                        ? "border-brand-400/50 bg-brand-500/15 text-brand-200"
                        : "border-white/10 text-white/50 hover:border-white/25"
                    )}
                  >
                    {h === "R" ? "Right" : "Left"}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={save} className="w-full">
              {saved ? <Check size={15} /> : <User size={15} />}
              {saved ? t("saved") : t("save")}
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title={t("language")} subtitle="Interface language — biomarkers and reports included">
            <div className="grid grid-cols-2 gap-2">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-colors",
                    lang === l.code
                      ? "border-teal-400/50 bg-teal-500/15 text-teal-200"
                      : "border-white/10 text-white/60 hover:border-white/25"
                  )}
                >
                  <span className="flex items-center gap-2"><Globe size={14} /> {l.name}</span>
                  {lang === l.code && <Check size={14} />}
                </button>
              ))}
            </div>
          </Card>

          <Card title="Research & privacy">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-ink-900/50 px-4 py-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 accent-teal-400"
              />
              <span className="text-xs leading-relaxed text-white/60">
                <ShieldCheck size={13} className="mr-1 inline text-teal-300" />
                <strong className="text-white/85">Opt in to anonymized research.</strong> Voice, tremor and motor
                features (never identity) may contribute to a research dataset for improving screening accuracy.
                You can withdraw consent at any time.
              </span>
            </label>
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-white/8 bg-ink-900/50 px-4 py-3 text-xs text-white/50">
              <Database size={14} className="mt-0.5 shrink-0 text-brand-300" />
              <span>
                <strong className="text-white/80">Offline mode:</strong> screening runs with on-device analysis and
                syncs when connectivity returns. No audio or video is ever uploaded in this demo build.
              </span>
            </div>
          </Card>

          <Card title="Data management">
            <p className="mb-3 text-xs text-white/45">
              Remove all locally stored reports, medication logs and session data from this device.
            </p>
            <Button variant="danger" onClick={clearData} className="w-full">
              <Trash2 size={15} /> {cleared ? "Data cleared" : "Delete all local data"}
            </Button>
            <button
              onClick={() => {
                logout();
                window.location.href = "/";
              }}
              className="mt-2 w-full rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 hover:bg-white/5"
            >
              Sign out
            </button>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <DisclaimerBanner />
      </div>
    </MotionPage>
  );
}
