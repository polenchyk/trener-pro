"use client";

import { useState } from "react";
import { BedDouble, Check, Dumbbell, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { useCoachStore } from "@/lib/store";
import { Client, GOAL_LABELS, latestWeight, SEX_LABELS, WeekDay } from "@/lib/types";

interface WorkoutPlannerProps {
  client: Client;
  day: WeekDay;
}

export default function WorkoutPlanner({ client, day }: WorkoutPlannerProps) {
  const setWorkout = useCoachStore((s) => s.setWorkout);
  const updateClient = useCoachStore((s) => s.updateClient);

  const saved = client.weeklyWorkouts[day] ?? "";
  const [text, setText] = useState(saved);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const isRestDay = !saved;
  const isDirty = text.trim() !== saved;

  const save = () => {
    if (!isDirty) return;
    setWorkout(client.id, day, text);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const generateWeek = async () => {
    setGenerating(true);
    setError(null);
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
      setText(workouts[day] ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сталася помилка. Спробуйте ще раз.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      {isRestDay && !text.trim() ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-sky-50 border border-sky-100 px-4 py-6 text-center">
          <span className="text-3xl">🛌</span>
          <p className="font-semibold text-sky-900">День відновлення / Відпочинок</p>
          <p className="text-xs text-sky-700">
            Можете додати тренування в полі нижче
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-teal-50 border border-teal-100 px-4 py-4">
          <p className="flex items-center gap-2 font-semibold text-teal-900 mb-1">
            <Dumbbell size={16} />
            Тренування · {day}
          </p>
          <p className="text-sm text-teal-800 whitespace-pre-wrap">{saved || text}</p>
        </div>
      )}

      {/* Швидке редагування тренування на день */}
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          placeholder='Напр. "Ноги + прес" або "Кардіо 40 хв"'
          className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        <button
          onClick={save}
          disabled={!isDirty}
          className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition-all ${
            savedFlash
              ? "bg-emerald-600 text-white"
              : "bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40"
          }`}
          aria-label="Зберегти тренування"
        >
          <Check size={18} />
        </button>
      </div>
      <p className="text-xs text-gray-400 px-1 -mt-1">
        Порожнє поле = день відпочинку
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={generateWeek}
        disabled={generating}
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
