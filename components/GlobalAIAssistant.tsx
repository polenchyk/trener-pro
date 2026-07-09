"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { useCoachStore } from "@/lib/store";
import type { GlobalAiAction } from "@/lib/global-ai";
import type { Client } from "@/lib/types";
import {
  readAutoSpeakPreference,
  useSpeech,
  writeAutoSpeakPreference,
} from "@/lib/useSpeech";
import AutoSpeakToggle from "./AutoSpeakToggle";
import SpeechButton from "./SpeechButton";
import VoiceInputButton from "./VoiceInputButton";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  applied?: boolean;
}

const MAX_MESSAGES = 6;

interface GlobalAIAssistantProps {
  clients: Client[];
}

export default function GlobalAIAssistant({ clients }: GlobalAIAssistantProps) {
  const addWeightEntry = useCoachStore((s) => s.addWeightEntry);
  const moveWorkout = useCoachStore((s) => s.moveWorkout);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(null);

  const { speak, stop: stopSpeech, isSpeaking, isSupported: speechSupported } = useSpeech();

  useEffect(() => {
    setAutoSpeak(readAutoSpeakPreference("global"));
  }, []);

  const handleSpeakMessage = (messageId: number, text: string) => {
    if (speakingMessageId === messageId && isSpeaking) {
      stopSpeech();
      setSpeakingMessageId(null);
      return;
    }
    setSpeakingMessageId(messageId);
    speak(text, () => setSpeakingMessageId(null));
  };

  const handleAutoSpeakChange = (enabled: boolean) => {
    setAutoSpeak(enabled);
    writeAutoSpeakPreference("global", enabled);
  };

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
    stopSpeech();
    setSpeakingMessageId(null);
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

      setMessages((prev) => {
        const next = [...prev, assistantMsg].slice(-MAX_MESSAGES);
        if (autoSpeak && answer.trim()) {
          const messageId = next.length - 1;
          window.setTimeout(() => {
            setSpeakingMessageId(messageId);
            speak(answer, () => setSpeakingMessageId(null));
          }, 0);
        }
        return next;
      });
    } catch (err) {
      setInput(question);
      const errText = err instanceof Error ? err.message : "Сталася помилка.";
      const errorContent = `⚠️ ${errText}`;
      setMessages((prev) => {
        const trimmed =
          prev.length > 0 && prev[prev.length - 1].role === "user"
            ? prev.slice(0, -1)
            : prev;
        const errorMsg: ChatMessage = {
          role: "assistant",
          content: errorContent,
        };
        const next = [...trimmed, errorMsg].slice(-MAX_MESSAGES);
        if (autoSpeak) {
          const messageId = next.length - 1;
          window.setTimeout(() => {
            setSpeakingMessageId(messageId);
            speak(errorContent, () => setSpeakingMessageId(null));
          }, 0);
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
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
            <div key={i}>
              {m.role === "user" ? (
                <div className="rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed bg-teal-600 text-white ml-8">
                  {m.content}
                </div>
              ) : (
                <div className="flex items-start gap-1 mr-4">
                  <div className="flex-1 min-w-0 rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed bg-white border border-teal-100 text-gray-800">
                    <span className="inline-flex items-center gap-1 text-teal-600 mr-1.5">
                      <Bot size={13} />
                    </span>
                    {m.content}
                    {m.applied && (
                      <p className="text-xs text-emerald-700 font-medium mt-1.5">
                        ✓ Зміни застосовано
                      </p>
                    )}
                  </div>
                  <SpeechButton
                    isActive={speakingMessageId === i && isSpeaking}
                    isSupported={speechSupported}
                    onToggle={() => handleSpeakMessage(i, m.content)}
                  />
                </div>
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
        <VoiceInputButton
          value={input}
          disabled={loading}
          onTranscript={setInput}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="shrink-0 w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center active:scale-95 transition-all hover:bg-teal-700 disabled:opacity-40"
          aria-label="Надіслати"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
      <AutoSpeakToggle
        checked={autoSpeak}
        onChange={handleAutoSpeakChange}
        disabled={loading}
      />
    </div>
  );
}
