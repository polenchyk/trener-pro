"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const UK_LANG = "uk-UA";

function getUkrainianVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === UK_LANG) ??
    voices.find((v) => v.lang.startsWith("uk")) ??
    null
  );
}

export function cancelAllSpeech(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const onEndRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setIsSupported(isSpeechSynthesisSupported());

    const loadVoices = () => {
      window.speechSynthesis?.getVoices();
    };
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
      cancelAllSpeech();
      utteranceRef.current = null;
      onEndRef.current = null;
      setIsSpeaking(false);
    };
  }, []);

  const stop = useCallback(() => {
    cancelAllSpeech();
    utteranceRef.current = null;
    onEndRef.current = null;
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string, onComplete?: () => void) => {
      if (!isSpeechSynthesisSupported() || !text.trim()) return;

      cancelAllSpeech();
      utteranceRef.current = null;
      onEndRef.current = onComplete ?? null;
      setIsSpeaking(false);

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = UK_LANG;
      const voice = getUkrainianVoice();
      if (voice) utterance.voice = voice;
      utterance.rate = 1;
      utterance.pitch = 1;

      const finish = () => {
        setIsSpeaking(false);
        utteranceRef.current = null;
        const cb = onEndRef.current;
        onEndRef.current = null;
        cb?.();
      };

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = finish;
      utterance.onerror = finish;

      utteranceRef.current = utterance;

      // Safari iOS: resume після user gesture інколи потрібен
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    },
    []
  );

  /** Якщо вже говорить цей текст — зупинити, інакше озвучити */
  const toggle = useCallback(
    (text: string, onComplete?: () => void) => {
      if (isSpeaking && utteranceRef.current) {
        stop();
        onComplete?.();
        return;
      }
      speak(text, onComplete);
    },
    [isSpeaking, speak, stop]
  );

  return { speak, stop, toggle, isSpeaking, isSupported };
}

const AUTO_SPEAK_MENU_KEY = "trener-pro-auto-speak-menu";
const AUTO_SPEAK_WORKOUT_KEY = "trener-pro-auto-speak-workout";
const AUTO_SPEAK_GLOBAL_KEY = "trener-pro-auto-speak-global";

export function readAutoSpeakPreference(scope: "menu" | "workout" | "global"): boolean {
  if (typeof window === "undefined") return false;
  const key =
    scope === "menu"
      ? AUTO_SPEAK_MENU_KEY
      : scope === "workout"
        ? AUTO_SPEAK_WORKOUT_KEY
        : AUTO_SPEAK_GLOBAL_KEY;
  return localStorage.getItem(key) === "1";
}

export function writeAutoSpeakPreference(
  scope: "menu" | "workout" | "global",
  enabled: boolean
): void {
  if (typeof window === "undefined") return;
  const key =
    scope === "menu"
      ? AUTO_SPEAK_MENU_KEY
      : scope === "workout"
        ? AUTO_SPEAK_WORKOUT_KEY
        : AUTO_SPEAK_GLOBAL_KEY;
  localStorage.setItem(key, enabled ? "1" : "0");
}
