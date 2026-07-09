"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Loader2,
  CalendarDays,
  ChevronDown,
  Send,
  CheckCircle2,
  Wand2,
  CalendarCheck,
} from "lucide-react";
import { useCoachStore } from "@/lib/store";
import {
  Client,
  DayMenu,
  GOAL_LABELS,
  WEEK_DAYS,
  WEEK_DAY_SHORT,
  WeekDay,
  WeeklyMenu,
} from "@/lib/types";
import { formatDayForMessenger, formatWeekForMessenger } from "@/lib/format-menu";
import {
  computeDayTotals,
  formatDishMacros,
  getMealsFromDay,
  hasValidMenuDays,
  normalizeWeeklyMenu,
} from "@/lib/menu-utils";
import { copyText, shareToMessenger, type ShareTarget } from "@/lib/share-menu";
import {
  readAutoSpeakPreference,
  useSpeech,
  writeAutoSpeakPreference,
} from "@/lib/useSpeech";
import AutoSpeakToggle from "./AutoSpeakToggle";
import { TelegramIcon, ViberIcon } from "./MessengerIcons";
import SpeechButton from "./SpeechButton";
import VoiceInputButton from "./VoiceInputButton";
import WorkoutPlanner from "./WorkoutPlanner";

const MAX_CHAT_MESSAGES = 6;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  updatedDays?: WeekDay[];
}

interface MenuGeneratorProps {
  client: Client;
}

export default function MenuGenerator({ client }: MenuGeneratorProps) {
  const menu = useCoachStore((s) => s.menus[client.id]);
  const expanded = useCoachStore((s) => s.isMenuExpanded[client.id] ?? false);
  const setMenu = useCoachStore((s) => s.setMenu);
  const updateMenuDays = useCoachStore((s) => s.updateMenuDays);
  const approveMenu = useCoachStore((s) => s.approveMenu);
  const setMenuExpanded = useCoachStore((s) => s.setMenuExpanded);

  const [activeDay, setActiveDay] = useState<WeekDay>("Понеділок");
  const [planMode, setPlanMode] = useState<"menu" | "workout">(menu ? "menu" : "workout");
  const [loading, setLoading] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustInput, setAdjustInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [copied, setCopied] = useState<"week" | "day" | null>(null);
  const [shared, setShared] = useState<ShareTarget | null>(null);
  const [justApproved, setJustApproved] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(null);

  const { speak, stop: stopSpeech, isSpeaking, isSupported: speechSupported } = useSpeech();

  useEffect(() => {
    setAutoSpeak(readAutoSpeakPreference("menu"));
  }, []);

  useEffect(() => {
    if (planMode === "workout") {
      stopSpeech();
      setSpeakingMessageId(null);
    }
  }, [planMode, stopSpeech]);

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
    writeAutoSpeakPreference("menu", enabled);
  };

  const clientPayload = {
    name: client.name,
    goal: GOAL_LABELS[client.goal],
    calories: client.calories,
    protein: client.macros.protein,
    fat: client.macros.fat,
    carbs: client.macros.carbs,
    notes: client.notes,
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    setChatMessages([]);
    setJustApproved(false);
    stopSpeech();
    setSpeakingMessageId(null);
    try {
      const res = await fetch("/api/generate-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientPayload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не вдалося згенерувати меню.");
      }
      setMenu(client.id, normalizeWeeklyMenu(data.menu as WeeklyMenu));
      setActiveDay("Понеділок");
      setPlanMode("menu");
      setMenuExpanded(client.id, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сталася помилка. Спробуйте ще раз.");
    } finally {
      setLoading(false);
    }
  };

  const sendChat = async () => {
    const instruction = adjustInput.trim();
    if (!instruction || !menu || adjusting) return;

    if (!hasValidMenuDays(menu.days)) {
      setError("Меню порожнє або некоректне. Згенеруйте тижневе меню заново.");
      return;
    }

    const userMessage: ChatMessage = { role: "user", content: instruction };
    const historyForApi = [...chatMessages, userMessage].slice(-MAX_CHAT_MESSAGES);

    setAdjusting(true);
    setError(null);
    setAdjustInput("");
    setChatMessages(historyForApi);

    try {
      const res = await fetch("/api/adjust-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: clientPayload,
          weeklyMenu: menu,
          menuDays: menu.days,
          days: menu.days,
          activeDay,
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
        (data.updatedDays ? "Меню оновлено." : "Готово.");

      let changedDays: WeekDay[] = [];
      if (data.updatedDays && typeof data.updatedDays === "object") {
        const updatedDays = data.updatedDays as Partial<Record<WeekDay, DayMenu>>;
        changedDays = WEEK_DAYS.filter((d) => updatedDays[d]);
        if (changedDays.length > 0) {
          updateMenuDays(client.id, updatedDays);
          setActiveDay(changedDays[0]);
        }
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: explanation,
        updatedDays: changedDays.length > 0 ? changedDays : undefined,
      };

      setChatMessages((prev) => {
        const next = [...prev, assistantMessage].slice(-MAX_CHAT_MESSAGES);
        if (autoSpeak && explanation.trim()) {
          const messageId = next.length - 1;
          window.setTimeout(() => {
            setSpeakingMessageId(messageId);
            speak(explanation, () => setSpeakingMessageId(null));
          }, 0);
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сталася помилка. Спробуйте ще раз.");
      setAdjustInput(instruction);
      setChatMessages((prev) => prev.slice(0, -1));
    } finally {
      setAdjusting(false);
    }
  };

  const getMenuText = (mode: "week" | "day") => {
    if (!menu) return "";
    return mode === "week"
      ? formatWeekForMessenger(client, menu)
      : formatDayForMessenger(client, menu, activeDay);
  };

  const copy = async (mode: "week" | "day") => {
    if (!menu) return;
    await copyText(getMenuText(mode));
    setCopied(mode);
    setTimeout(() => setCopied(null), 2500);
  };

  const share = async (mode: "week" | "day", target: ShareTarget) => {
    if (!menu) return;
    await shareToMessenger(getMenuText(mode), target);
    setShared(target);
    setTimeout(() => setShared(null), 2500);
  };

  const approve = () => {
    approveMenu(client.id);
    setJustApproved(true);
    setTimeout(() => setJustApproved(false), 3000);
  };

  const isMenuDirty = Boolean(menu && !menu.approved);
  const day = menu?.days[activeDay];
  const dayTotals = day ? computeDayTotals(day) : null;
  const dayMeals = day ? getMealsFromDay(day) : [];

  return (
    <div className="space-y-3">
      {!menu && !loading && (
        <button
          onClick={generate}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-teal-600 text-white font-semibold py-4 text-base active:scale-[0.98] transition-all hover:bg-teal-700"
        >
          <Sparkles size={20} />
          Згенерувати меню на тиждень
        </button>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-8 text-teal-600">
          <Loader2 size={36} className="animate-spin" />
          <p className="text-sm text-gray-500 text-center">
            AI складає меню на 7 днів для {client.name}...
            <br />
            Це займе 30–60 секунд
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-2xl bg-red-50 border border-red-100 px-4 py-3.5">
          <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {!loading && (
        <>
          {/* Плашка після затвердження */}
          {menu?.approved && !expanded && (
            <div
              className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium ${
                justApproved
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-emerald-50 text-emerald-800 border-emerald-100"
              }`}
            >
              <CheckCircle2 size={18} className="shrink-0" />
              Меню на тиждень сформовано
            </div>
          )}

          {/* Кнопка-акордеон */}
          <button
            onClick={() => setMenuExpanded(client.id, !expanded)}
            className="w-full flex items-center justify-between gap-2 rounded-2xl border border-teal-200 bg-teal-50/60 px-4 py-4 text-teal-800 font-semibold text-sm active:scale-[0.98] transition-all hover:bg-teal-50"
          >
            <span className="flex items-center gap-2">
              <CalendarDays size={18} />
              {expanded
                ? "Приховати план тижня"
                : "План на тиждень (Харчування / Тренування) 📅"}
            </span>
            <ChevronDown
              size={18}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>

          {expanded && (
            <div className="space-y-3">
              {/* Перемикач режиму */}
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-100 p-1">
                {(
                  [
                    { key: "menu", label: "🍽 Харчування" },
                    { key: "workout", label: "🏋️ Тренування" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setPlanMode(m.key)}
                    className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                      planMode === m.key
                        ? "bg-white text-teal-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Вкладки днів */}
              <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
                {WEEK_DAYS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setActiveDay(d)}
                    className={`shrink-0 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                      activeDay === d
                        ? "bg-teal-600 text-white"
                        : "bg-gray-50 text-gray-600 hover:bg-teal-50"
                    }`}
                  >
                    {WEEK_DAY_SHORT[d]}
                  </button>
                ))}
              </div>

              {/* Режим тренувань */}
              {planMode === "workout" && (
                <WorkoutPlanner key={activeDay} client={client} day={activeDay} />
              )}

              {/* Режим харчування без меню */}
              {planMode === "menu" && !menu && (
                <p className="text-sm text-gray-400 text-center py-4">
                  Меню ще не згенеровано — натисніть кнопку вище 👆
                </p>
              )}

              {/* Меню обраного дня */}
              {planMode === "menu" && day && dayTotals && (
                <>
                  <div className="rounded-2xl bg-teal-50 border border-teal-100 px-4 py-3">
                    <p className="font-semibold text-teal-900">{activeDay}</p>
                    <p className="text-sm text-teal-700 mt-0.5">
                      🔥 {dayTotals.totalCalories} ккал · 🥩 {dayTotals.macros.protein} г · 🥑{" "}
                      {dayTotals.macros.fat} г · 🍞 {dayTotals.macros.carbs} г
                    </p>
                  </div>

                  {dayMeals.map((meal) => (
                    <div
                      key={meal.key}
                      className="rounded-2xl border border-gray-100 px-4 py-3.5"
                    >
                      <p className="font-semibold text-gray-900 mb-2">
                        {meal.label.emoji} {meal.label.name}
                      </p>
                      <ul className="space-y-2.5">
                        {meal.dishes.map((dish, i) => (
                          <li key={i} className="text-sm text-gray-600">
                            <div className="flex justify-between gap-3">
                              <span className="min-w-0">
                                {dish.title} — {dish.portion}
                              </span>
                              <span className="text-gray-500 whitespace-nowrap shrink-0 font-medium">
                                {dish.calories} ккал
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                              {formatDishMacros(dish)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              )}

              {/* AI-чат та дії з меню — чат завжди доступний */}
              {planMode === "menu" && menu && (
                <>
              <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-3.5 py-3.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2">
                  <Wand2 size={14} />
                  Запитати AI / змінити меню
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
                            Меню оновлено: {m.updatedDays.join(", ")}
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
                    placeholder="Порада, заміна страви або команда змінити меню..."
                    disabled={adjusting}
                    className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60"
                  />
                  <VoiceInputButton
                    value={adjustInput}
                    disabled={adjusting}
                    onTranscript={setAdjustInput}
                  />
                  <button
                    type="submit"
                    disabled={adjusting || !adjustInput.trim()}
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
                  disabled={adjusting}
                />
              </div>

              {justApproved ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-white font-semibold py-3 text-sm">
                  <CheckCircle2 size={16} />
                  ✓ Зміни збережено
                </div>
              ) : isMenuDirty ? (
                <button
                  onClick={approve}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-white font-semibold py-3.5 text-sm active:scale-[0.98] transition-all hover:bg-emerald-700"
                >
                  <CheckCircle2 size={18} />
                  Затвердити та зберегти меню
                </button>
              ) : null}

              <div className="flex gap-2 items-stretch">
                <button
                  onClick={() => copy("week")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-2xl font-semibold py-3 text-sm active:scale-[0.98] transition-all min-w-0 ${
                    copied === "week"
                      ? "bg-emerald-600 text-white"
                      : "bg-teal-600 text-white hover:bg-teal-700"
                  }`}
                >
                  {copied === "week" ? <Check size={15} /> : <Copy size={15} />}
                  <span className="truncate">{copied === "week" ? "Скопійовано!" : "Весь тиждень"}</span>
                </button>
                <button
                  onClick={() => copy("day")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-2xl font-semibold py-3 text-sm border active:scale-[0.98] transition-all min-w-0 ${
                    copied === "day"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-teal-200 text-teal-700 hover:bg-teal-50"
                  }`}
                >
                  {copied === "day" ? <Check size={15} /> : <Copy size={15} />}
                  <span className="truncate">{copied === "day" ? "Скопійовано!" : WEEK_DAY_SHORT[activeDay]}</span>
                </button>
                <button
                  onClick={() => share("week", "telegram")}
                  className={`shrink-0 w-12 rounded-2xl border flex items-center justify-center active:scale-95 transition-all ${
                    shared === "telegram"
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                  aria-label="Поділитися в Telegram"
                  title="Telegram — весь тиждень"
                >
                  <TelegramIcon size={22} />
                </button>
                <button
                  onClick={() => share("week", "viber")}
                  className={`shrink-0 w-12 rounded-2xl border flex items-center justify-center active:scale-95 transition-all ${
                    shared === "viber"
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                  aria-label="Поділитися у Viber"
                  title="Viber — весь тиждень"
                >
                  <ViberIcon size={22} />
                </button>
              </div>

              <button
                onClick={generate}
                className="w-full flex items-center justify-center gap-2 rounded-2xl text-gray-400 font-medium py-2 text-xs transition-colors hover:text-teal-700"
              >
                <RefreshCw size={14} />
                Згенерувати тиждень заново
              </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
