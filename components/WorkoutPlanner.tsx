"use client";

import { useEffect, useState } from "react";
import {
  BedDouble,
  Dumbbell,
  Loader2,
  Send,
  Sparkles,
  AlertCircle,
  Wand2,
  CalendarCheck,
} from "lucide-react";
import { useCoachStore } from "@/lib/store";
import { Client, GOAL_LABELS, latestWeight, SEX_LABELS, WEEK_DAYS, WeekDay } from "@/lib/types";
import {
  readAutoSpeakPreference,
  useSpeech,
  writeAutoSpeakPreference,
} from "@/lib/useSpeech";
import AutoSpeakToggle from "./AutoSpeakToggle";
import SpeechButton from "./SpeechButton";
import VoiceInputButton from "./VoiceInputButton";

const MAX_CHAT_MESSAGES = 6;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  updatedDays?: WeekDay[];
}

interface WorkoutPlannerProps {
  client: Client;
  day: WeekDay;
}

function buildWorkoutAiSummary(
  workouts: Partial<Record<WeekDay, string>>,
  activeDay: WeekDay
): string {
  const trainingDays = WEEK_DAYS.filter((d) => workouts[d]?.trim());
  const restCount = 7 - trainingDays.length;
  const today = workouts[activeDay]?.trim();

  const lines = [
    `План тренувань на тиждень оновлено.`,
    `Тренувань: ${trainingDays.length}, днів відпочинку: ${restCount}.`,
  ];

  if (today) {
    lines.push(`${activeDay}: ${today}.`);
  } else {
    lines.push(`${activeDay}: день відпочинку.`);
  }

  if (trainingDays.length > 0) {
    lines.push(
      "Розклад: " +
        trainingDays.map((d) => `${d} — ${workouts[d]}`).join("; ") +
        "."
    );
  }

  return lines.join(" ");
}

export default function WorkoutPlanner({ client, day }: WorkoutPlannerProps) {
  const updateWorkouts = useCoachStore((s) => s.updateWorkouts);
  const updateClient = useCoachStore((s) => s.updateClient);

  const saved = client.weeklyWorkouts[day]?.trim() ?? "";
  const [generating, setGenerating] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustInput, setAdjustInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(null);

  const { speak, stop: stopSpeech, isSpeaking, isSupported: speechSupported } = useSpeech();

  useEffect(() => {
    setAutoSpeak(readAutoSpeakPreference("workout"));
  }, []);

  useEffect(() => {
    stopSpeech();
    setSpeakingMessageId(null);
  }, [day, stopSpeech]);

  const isRestDay = !saved;

  const handleAutoSpeakChange = (enabled: boolean) => {
    setAutoSpeak(enabled);
    writeAutoSpeakPreference("workout", enabled);
  };

  const handleSpeakMessage = (messageId: number, text: string) => {
    if (speakingMessageId === messageId && isSpeaking) {
      stopSpeech();
      setSpeakingMessageId(null);
      return;
    }
    setSpeakingMessageId(messageId);
    speak(text, () => setSpeakingMessageId(null));
  };

  const appendAssistantMessage = (content: string, updatedDays?: WeekDay[]) => {
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content,
      updatedDays,
    };
    setChatMessages((prev) => {
      const next = [...prev, assistantMessage].slice(-MAX_CHAT_MESSAGES);
      if (autoSpeak && content.trim()) {
        const messageId = next.length - 1;
        window.setTimeout(() => {
          setSpeakingMessageId(messageId);
          speak(content, () => setSpeakingMessageId(null));
        }, 0);
      }
      return next;
    });
  };

  const sendChat = async () => {
    const instruction = adjustInput.trim();
    if (!instruction || adjusting) return;

    const userMessage: ChatMessage = { role: "user", content: instruction };
    const historyForApi = [...chatMessages, userMessage].slice(-MAX_CHAT_MESSAGES);

    setAdjusting(true);
    setError(null);
    setAdjustInput("");
    setChatMessages(historyForApi);

    try {
      const res = await fetch("/api/adjust-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: {
            name: client.name,
            goal: GOAL_LABELS[client.goal],
            notes: client.notes,
            sex: SEX_LABELS[client.sex],
            activityLevel: client.activityLevel,
          },
          weeklyWorkouts: client.weeklyWorkouts,
          activeDay: day,
          instruction,
          messages: historyForApi,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не вдалося отримати відповідь.");
      }

      const explanation =
        data.explanation?.trim() ||
        (data.updatedWorkouts ? "Тренування оновлено." : "Готово.");

      let changedDays: WeekDay[] = [];
      if (data.updatedWorkouts && typeof data.updatedWorkouts === "object") {
        const updatedWorkouts = data.updatedWorkouts as Partial<Record<WeekDay, string>>;
        changedDays = WEEK_DAYS.filter((d) => d in updatedWorkouts);
        if (changedDays.length > 0) {
          updateWorkouts(client.id, updatedWorkouts);
        }
      }

      appendAssistantMessage(
        explanation,
        changedDays.length > 0 ? changedDays : undefined
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сталася помилка. Спробуйте ще раз.");
      setAdjustInput(instruction);
      setChatMessages((prev) => prev.slice(0, -1));
    } finally {
      setAdjusting(false);
    }
  };

  const generateWeek = async () => {
    setGenerating(true);
    setError(null);
    stopSpeech();
    setSpeakingMessageId(null);
    try {
      const res = await fetch("/api/generate-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: client.name,
          goal: GOAL_LABELS[client.goal],
          sex: SEX_LABELS[client.sex],
          activityLevel: client.activityLevel,
          weight: latestWeight(client),
          age: client.age || undefined,
          notes: client.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не вдалося згенерувати план.");
      }
      const workouts = data.workouts as Partial<Record<WeekDay, string>>;
      updateClient(client.id, { weeklyWorkouts: workouts });

      const summary = buildWorkoutAiSummary(workouts, day);
      appendAssistantMessage(summary, WEEK_DAYS.filter((d) => workouts[d]?.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сталася помилка. Спробуйте ще раз.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      {isRestDay ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-sky-50 border border-sky-100 px-4 py-6 text-center">
          <span className="text-3xl">🛌</span>
          <p className="font-semibold text-sky-900">День відновлення / Відпочинок</p>
          <p className="text-xs text-sky-700">
            Напишіть ШІ, щоб додати або змінити тренування
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-teal-50 border border-teal-100 px-4 py-4">
          <p className="flex items-center gap-2 font-semibold text-teal-900 mb-1">
            <Dumbbell size={16} />
            Тренування · {day}
          </p>
          <p className="text-sm text-teal-800 whitespace-pre-wrap">{saved}</p>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-3.5 py-3.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2">
          <Wand2 size={14} />
          Запитати AI / змінити тренування
        </p>
        {chatMessages.length > 0 && (
          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
            {chatMessages.map((m, i) => (
              <div key={i}>
                {m.role === "user" ? (
                  <div className="rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed bg-teal-600 text-white ml-6">
                    {m.content}
                  </div>
                ) : (
                  <div className="flex items-start gap-1 mr-2">
                    <div className="flex-1 min-w-0 rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed bg-white border border-teal-100 text-teal-900">
                      {m.content}
                    </div>
                    <SpeechButton
                      isActive={speakingMessageId === i && isSpeaking}
                      isSupported={speechSupported}
                      onToggle={() => handleSpeakMessage(i, m.content)}
                    />
                  </div>
                )}
                {m.updatedDays && (
                  <p className="flex items-center gap-1 text-xs text-emerald-700 font-medium mt-1 px-1">
                    <CalendarCheck size={13} />
                    Тренування оновлено: {m.updatedDays.join(", ")}
                  </p>
                )}
              </div>
            ))}
            {adjusting && (
              <div className="flex items-center gap-2 text-teal-600 text-xs px-1 py-1">
                <Loader2 size={14} className="animate-spin" />
                AI думає...
              </div>
            )}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendChat();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={adjustInput}
            onChange={(e) => setAdjustInput(e.target.value)}
            placeholder="Напишіть ШІ для зміни тренування або запитання..."
            disabled={adjusting || generating}
            className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60"
          />
          <VoiceInputButton
            value={adjustInput}
            disabled={adjusting || generating}
            onTranscript={setAdjustInput}
          />
          <button
            type="submit"
            disabled={adjusting || generating || !adjustInput.trim()}
            className="shrink-0 w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center active:scale-95 transition-all hover:bg-teal-700 disabled:opacity-40"
            aria-label="Надіслати"
          >
            {adjusting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>
        <AutoSpeakToggle
          checked={autoSpeak}
          onChange={handleAutoSpeakChange}
          disabled={adjusting || generating}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={generateWeek}
        disabled={generating || adjusting}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-teal-600 text-white font-semibold py-4 text-sm active:scale-[0.98] transition-all hover:bg-teal-700 disabled:opacity-60"
      >
        {generating ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            AI складає план на тиждень...
          </>
        ) : (
          <>
            <Sparkles size={18} />
            Згенерувати ШІ-план тренувань
          </>
        )}
      </button>

      {generating ? (
        <div className="flex items-center gap-2 justify-center text-xs text-gray-400">
          <BedDouble size={13} />
          Дні відпочинку розставляться автоматично
        </div>
      ) : null}
    </div>
  );
}
