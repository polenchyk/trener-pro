"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Mic, Square } from "lucide-react";
import {
  appendTranscript,
  getSpeechRecognition,
  isRecoverableSpeechError,
  type SpeechRecognitionLike,
} from "@/lib/speech-recognition";

export interface VoiceInputHandle {
  /** Зупинити диктування (викликати перед відправкою форми) */
  stopListening: () => void;
  isListening: () => boolean;
}

interface VoiceInputButtonProps {
  onTranscript: (value: string) => void;
  value?: string;
  disabled?: boolean;
}

const VoiceInputButton = forwardRef<VoiceInputHandle, VoiceInputButtonProps>(
  function VoiceInputButton({ onTranscript, value = "", disabled = false }, ref) {
    const [voiceSupported, setVoiceSupported] = useState(false);
    const [listening, setListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const shouldContinueRef = useRef(false);
    const sessionBaseRef = useRef("");
    const sessionFinalRef = useRef("");
    const valueRef = useRef(value);

    useEffect(() => {
      valueRef.current = value;
    }, [value]);

    useEffect(() => {
      setVoiceSupported(getSpeechRecognition() !== null);
    }, []);

    const emitTranscript = useCallback(
      (interim = "") => {
        const base = sessionBaseRef.current + sessionFinalRef.current;
        const combined = interim ? appendTranscript(base, interim) : base;
        onTranscript(combined);
      },
      [onTranscript]
    );

    const stopListening = useCallback(() => {
      shouldContinueRef.current = false;
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.stop();
        } catch {
          /* already stopped */
        }
      }
      recognitionRef.current = null;
      setListening(false);
      emitTranscript();
    }, [emitTranscript]);

    useImperativeHandle(
      ref,
      () => ({
        stopListening,
        isListening: () => listening,
      }),
      [stopListening, listening]
    );

    const startListening = useCallback(() => {
      const SpeechRecognition = getSpeechRecognition();
      if (!SpeechRecognition || disabled) return;

      sessionBaseRef.current = valueRef.current.trim()
        ? `${valueRef.current.trim()} `
        : "";
      sessionFinalRef.current = "";
      shouldContinueRef.current = true;

      const recognition = new SpeechRecognition();
      recognition.lang = "uk-UA";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) {
            sessionFinalRef.current += text;
          } else {
            interim += text;
          }
        }
        emitTranscript(interim);
      };

      recognition.onerror = (event) => {
        if (isRecoverableSpeechError(event.error) && shouldContinueRef.current) {
          return;
        }
        shouldContinueRef.current = false;
        setListening(false);
      };

      recognition.onend = () => {
        if (!shouldContinueRef.current) {
          setListening(false);
          emitTranscript();
          return;
        }
        // Браузер обриває сесію на паузі — перезапускаємо, поки користувач не натисне «Стоп»
        try {
          recognition.start();
        } catch {
          window.setTimeout(() => {
            if (shouldContinueRef.current && recognitionRef.current) {
              try {
                recognition.start();
              } catch {
                shouldContinueRef.current = false;
                setListening(false);
              }
            }
          }, 200);
        }
      };

      recognitionRef.current = recognition;
      setListening(true);
      try {
        recognition.start();
      } catch {
        shouldContinueRef.current = false;
        setListening(false);
      }
    }, [disabled, emitTranscript]);

    const toggleVoice = () => {
      if (listening) {
        stopListening();
      } else {
        startListening();
      }
    };

    useEffect(() => {
      return () => {
        shouldContinueRef.current = false;
        recognitionRef.current?.stop();
      };
    }, []);

    if (!voiceSupported) return null;

    return (
      <button
        type="button"
        onClick={toggleVoice}
        disabled={disabled}
        className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition-all disabled:opacity-40 ${
          listening
            ? "bg-red-500 text-white"
            : "border border-teal-200 text-teal-700 hover:bg-teal-50"
        }`}
        aria-label={listening ? "Стоп запис" : "Диктувати"}
        title={listening ? "Стоп запис" : "Диктувати (паузи не зупиняють запис)"}
      >
        {listening ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}
      </button>
    );
  }
);

export default VoiceInputButton;
