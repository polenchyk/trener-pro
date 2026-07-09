"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, Mic, MicOff, Send, Sparkles } from "lucide-react";
import { useCoachStore } from "@/lib/store";
import type { GlobalAiAction } from "@/lib/global-ai";
import type { Client } from "@/lib/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  applied?: boolean;
}

const MAX_MESSAGES = 6;

interface SpeechRecognitionEventLike {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface GlobalAIAssistantProps {
  clients: Client[];
}

export default function GlobalAIAssistant({ clients }: GlobalAIAssistantProps) {
  const addWeightEntry = useCoachStore((s) => s.addWeightEntry);
  const moveWorkout = useCoachStore((s) => s.moveWorkout);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setVoiceSupported(getSpeechRecognition() !== null);
  }, []);

  const applyActions = useCallback(
    (actions: GlobalAiAction[]) => {
      let applied = 0;
      for (const action of actions) {
        if (action.type === "add_weight") {
          addWeightEntry(action.clientId, action.value, action.date);
          applied++;
        }
        if (action.type === "move_workout") {
          moveWorkout(action.clientId, action.fromDay, action.toDay);
          applied++;
        }
      }
      return applied;
    },
    [addWeightEntry, moveWorkout]
  );

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg: ChatMessage = { role: "user", content: question };
    const historyForApi = [...messages, userMsg].slice(-MAX_MESSAGES);

    setLoading(true);
    setInput("");
    setMessages(historyForApi);

    try {
      const res = await fetch("/api/global-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          clients,
          history: historyForApi,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не вдалося отримати відповідь.");
      }

      const appliedCount = applyActions(data.actions ?? []);
      let answer = data.answer?.trim() || "Готово.";
      if (appliedCount > 0 && !/готово|оновлен|перенес/i.test(answer)) {
        answer = `Готово! ${answer}`;
      }

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: answer,
        applied: appliedCount > 0,
      };

      setMessages((prev) => [...prev, assistantMsg].slice(-MAX_MESSAGES));
    } catch (err) {
      setInput(question);
      const errText = err instanceof Error ? err.message : "Сталася помилка.";
      setMessages((prev) => {
        const trimmed =
          prev.length > 0 && prev[prev.length - 1].role === "user"
            ? prev.slice(0, -1)
            : prev;
        const errorMsg: ChatMessage = {
          role: "assistant",
          content: `⚠️ ${errText}`,
        };
        return [...trimmed, errorMsg].slice(-MAX_MESSAGES);
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleVoice = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition || loading) return;

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
      if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50/90 to-white px-4 py-3.5 mb-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-semibold text-teal-900 mb-2.5">
        <Sparkles size={16} className="text-teal-600" />
        Глобальний AI-асистент
      </p>

      {messages.length > 0 && (
        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === "user"
                  ? "bg-teal-600 text-white ml-8"
                  : "bg-white border border-teal-100 text-gray-800 mr-4"
              }`}
            >
              {m.role === "assistant" && (
                <span className="inline-flex items-center gap-1 text-teal-600 mr-1.5">
                  <Bot size={13} />
                </span>
              )}
              {m.content}
              {m.applied && (
                <p className="text-xs text-emerald-700 font-medium mt-1.5">
                  ✓ Зміни застосовано
                </p>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-teal-600 text-xs px-1 py-1">
              <Loader2 size={14} className="animate-spin" />
              AI обробляє запит...
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Запитай AI (напр. «перенеси тренування Миколи на завтра» або «Олена важить 75»)"
          disabled={loading}
          className="flex-1 min-w-0 rounded-xl border border-teal-200 bg-white px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60"
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            disabled={loading}
            className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition-all disabled:opacity-40 ${
              listening
                ? "bg-red-500 text-white animate-pulse"
                : "border border-teal-200 text-teal-700 hover:bg-teal-50"
            }`}
            aria-label={listening ? "Зупинити запис" : "Голосовий ввід"}
          >
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="shrink-0 w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center active:scale-95 transition-all hover:bg-teal-700 disabled:opacity-40"
          aria-label="Надіслати"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
}
