"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { speakItalian } from "@/presentation/lib/tts";
import { usePreferences } from "@/presentation/stores/preferences";

/**
 * Web Speech API wrapper: Italian speech-to-text (mic) and text-to-speech.
 *
 * STT is well supported on Chrome/Android (our target). TTS works broadly.
 * Both require a secure context (HTTPS or localhost). `sttSupported` lets the UI
 * hide the mic when unavailable (e.g. iOS Safari). `confidence` (0–1) from the
 * final recognition result feeds the lightweight pronunciation score.
 */
export function useSpeech() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [sttSupported, setSttSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setSttSupported(Boolean(Ctor));
    setTtsSupported("speechSynthesis" in window);
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = "it-IT";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        text += result[0].transcript;
        if (result.isFinal) setConfidence(result[0].confidence || null);
      }
      setTranscript(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    setTranscript("");
    setConfidence(null);
    setListening(true);
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const speak = useCallback((text: string) => {
    const { voiceURI, speechRate } = usePreferences.getState();
    speakItalian(text, { voiceURI, rate: speechRate });
  }, []);

  return {
    listening,
    transcript,
    confidence,
    sttSupported,
    ttsSupported,
    startListening,
    stopListening,
    speak,
  };
}
