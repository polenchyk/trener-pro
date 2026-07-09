"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import {
  appendTranscript,
  getSpeechRecognition,
  type SpeechRecognitionLike,
} from "@/lib/speech-recognition";

interface VoiceInputButtonProps {
  /** Отримує оновлений текст після розпізнавання */
  onTranscript: (value: string) => void;
  /** Поточне значення інпуту (для дописування тексту) */
  value?: string;
  disabled?: boolean;
}

export default function VoiceInputButton({
  onTranscript,
  value = "",
  disabled = false,
}: VoiceInputButtonProps) {
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    setVoiceSupported(getSpeechRecognition() !== null);
  }, []);

  const toggleVoice = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition || disabled) return;

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "uk-UA";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        onTranscript(appendTranscript(valueRef.current, transcript));
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  if (!voiceSupported) return null;

  return (
    <button
      type="button"
      onClick={toggleVoice}
      disabled={disabled}
      className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition-all disabled:opacity-40 ${
        listening
          ? "bg-red-500 text-white animate-pulse"
          : "border border-teal-200 text-teal-700 hover:bg-teal-50"
      }`}
      aria-label={listening ? "Зупинити запис" : "Голосовий ввід"}
    >
      {listening ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
}
