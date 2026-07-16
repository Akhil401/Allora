"use client";

import { useEffect, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { usePreferences, type Theme } from "@/presentation/stores/preferences";
import { rankItalianVoices, speakItalian } from "@/presentation/lib/tts";

interface SettingsData {
  theme: Theme;
  voiceOutputEnabled: boolean;
  tutorDifficulty: "gentle" | "normal" | "strict";
  dailyGoalMinutes: number;
  cefrLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
}

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const DIFFICULTIES = ["gentle", "normal", "strict"] as const;
const THEMES: Theme[] = ["light", "dark", "system"];

/** Settings screen. Persists to the server and mirrors theme/voice locally. */
export default function SettingsPage() {
  const { theme, setTheme, setVoiceEnabled, voiceURI, setVoiceURI, speechRate, setSpeechRate } =
    usePreferences();
  const [data, setData] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  // Load the device's Italian voices (best first). getVoices() is often empty
  // until the async `voiceschanged` event fires, so we listen for it.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoices(rankItalianVoices(window.speechSynthesis.getVoices()));
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const patch = async (partial: Partial<SettingsData>) => {
    if (!data) return;
    const next = { ...data, ...partial };
    setData(next);
    if (partial.theme) setTheme(partial.theme);
    if (partial.voiceOutputEnabled !== undefined) setVoiceEnabled(partial.voiceOutputEnabled);
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        {saving ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
          </span>
        ) : null}
      </div>

      <Field label="Theme">
        <Segmented options={THEMES} value={theme} onChange={(v) => patch({ theme: v })} />
      </Field>

      <Field label="Tutor voice (text-to-speech)">
        <Segmented
          options={["on", "off"]}
          value={data.voiceOutputEnabled ? "on" : "off"}
          onChange={(v) => patch({ voiceOutputEnabled: v === "on" })}
        />
      </Field>

      {data.voiceOutputEnabled ? (
        <>
          <Field label="Voice">
            <div className="flex items-center gap-2">
              <select
                value={voiceURI ?? ""}
                onChange={(e) => setVoiceURI(e.target.value || null)}
                className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Auto — best available</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name}
                    {v.localService ? "" : " ·  online"}
                  </option>
                ))}
              </select>
              <button
                onClick={() =>
                  speakItalian("Ciao! Sono il tuo maestro d'italiano. Cominciamo?", {
                    voiceURI,
                    rate: speechRate,
                  })
                }
                className="press flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <Volume2 className="h-4 w-4" /> Preview
              </button>
            </div>
            {voices.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No Italian voices found on this device. Chrome (desktop/Android) usually has a
                high-quality “Google italiano” voice; otherwise add an Italian voice in your
                operating system’s settings.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                “Online”/Google/Natural voices sound the most human. Tap Preview to compare.
              </p>
            )}
          </Field>

          <Field label={`Speaking speed: ${speechRate.toFixed(2)}×`}>
            <input
              type="range"
              min={0.5}
              max={1.3}
              step={0.05}
              value={speechRate}
              onChange={(e) => setSpeechRate(Number(e.target.value))}
              className="w-full"
            />
          </Field>
        </>
      ) : null}

      <Field label="Your level (CEFR)">
        <Segmented
          options={LEVELS}
          value={data.cefrLevel}
          onChange={(v) => patch({ cefrLevel: v })}
        />
      </Field>

      <Field label="Tutor difficulty">
        <Segmented
          options={DIFFICULTIES}
          value={data.tutorDifficulty}
          onChange={(v) => patch({ tutorDifficulty: v })}
        />
      </Field>

      <Field label={`Daily goal: ${data.dailyGoalMinutes} min`}>
        <input
          type="range"
          min={5}
          max={60}
          step={5}
          value={data.dailyGoalMinutes}
          onChange={(e) => patch({ dailyGoalMinutes: Number(e.target.value) })}
          className="w-full"
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="shadow-soft space-y-2 rounded-2xl border bg-card p-4">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border bg-muted p-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={
            "press rounded-lg px-3.5 py-1.5 text-sm capitalize transition-colors " +
            (value === opt
              ? "shadow-soft bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
