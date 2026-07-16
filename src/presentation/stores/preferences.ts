"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface PreferencesState {
  theme: Theme;
  voiceEnabled: boolean;
  /** Chosen TTS voice (voiceURI). null = auto-pick the best Italian voice. */
  voiceURI: string | null;
  /** Speech rate for the tutor voice (0.5–1.5; slower is clearer for learners). */
  speechRate: number;
  setTheme: (theme: Theme) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setVoiceURI: (uri: string | null) => void;
  setSpeechRate: (rate: number) => void;
}

/**
 * Client-side UI preferences (theme, voice output + chosen voice/speed),
 * persisted to localStorage. The authoritative copy for logged-in users lives in
 * the `settings` table; the settings page syncs theme/voice. This store gives
 * instant, offline-friendly UI response without a round-trip.
 */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: "system",
      voiceEnabled: true,
      voiceURI: null,
      speechRate: 0.95,
      setTheme: (theme) => set({ theme }),
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      setVoiceURI: (voiceURI) => set({ voiceURI }),
      setSpeechRate: (speechRate) => set({ speechRate }),
    }),
    { name: "pingo-prefs" },
  ),
);
