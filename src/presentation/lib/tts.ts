/**
 * Text-to-speech helpers. Browser TTS quality varies wildly by device; the
 * default Italian voice is often the robotic local one. We rank the available
 * voices so the best-sounding Italian voice is chosen automatically (with a
 * user override), and centralize the `speak()` call so chat + Talk mode behave
 * identically.
 */

/** Higher score = better-sounding. Heuristic based on common voice names. */
function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = `${v.name} ${v.voiceURI}`.toLowerCase();
  let score = 0;
  // Network / neural voices are much better than the local robotic ones.
  if (!v.localService) score += 6;
  if (name.includes("google")) score += 5;
  if (name.includes("natural")) score += 5; // Microsoft "…Online (Natural)"
  if (name.includes("neural")) score += 5;
  if (name.includes("premium") || name.includes("enhanced")) score += 4;
  if (name.includes("siri")) score += 3; // Apple's better voices
  if (name.includes("luca") || name.includes("alice") || name.includes("federica")) score += 2;
  // Prefer full it-IT over generic "it".
  if (v.lang.toLowerCase() === "it-it") score += 1;
  return score;
}

/** All Italian voices, best first. */
export function rankItalianVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices
    .filter((v) => v.lang.toLowerCase().startsWith("it"))
    .sort((a, b) => scoreVoice(b) - scoreVoice(a));
}

/** The best Italian voice's URI (or null if none). */
export function bestItalianVoiceURI(voices: SpeechSynthesisVoice[]): string | null {
  return rankItalianVoices(voices)[0]?.voiceURI ?? null;
}

/** Resolve the preferred voice if still present, else the best Italian one. */
function resolveVoice(
  voices: SpeechSynthesisVoice[],
  preferredURI: string | null,
): SpeechSynthesisVoice | undefined {
  if (preferredURI) {
    const match = voices.find((v) => v.voiceURI === preferredURI);
    if (match) return match;
  }
  return rankItalianVoices(voices)[0];
}

export interface SpeakOptions {
  voiceURI?: string | null;
  rate?: number;
  onEnd?: () => void;
}

/**
 * Speak Italian text with the chosen (or best) voice. Cancels anything already
 * speaking. Safe to call when TTS is unsupported (invokes onEnd immediately).
 */
export function speakItalian(text: string, opts: SpeakOptions = {}): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    opts.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = "it-IT";
  u.rate = opts.rate ?? 0.95;
  const voice = resolveVoice(synth.getVoices(), opts.voiceURI ?? null);
  if (voice) u.voice = voice;
  if (opts.onEnd) {
    u.onend = () => opts.onEnd?.();
    u.onerror = () => opts.onEnd?.();
  }
  synth.speak(u);
}
