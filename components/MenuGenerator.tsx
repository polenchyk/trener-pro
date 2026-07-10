"use client";

import { useEffect, useState } from "react";
import {
  Copy,
  Check,
  AlertCircle,
  Loader2,
  CalendarDays,
  ChevronDown,
  Send,
  CheckCircle2,
  Wand2,
  CalendarCheck,
  MessageCircle,
  BookOpen,
} from "lucide-react";
import { useCoachStore } from "@/lib/store";
import {
  Client,
  DayMenu,
  GOAL_LABELS,
  MenuDish,
  SEX_LABELS,
  WEEK_DAYS,
  WEEK_DAY_SHORT,
  WeekDay,
} from "@/lib/types";
import { formatDayMenuForMessenger } from "@/lib/format-menu";
import {
  computeDayTotals,
  createEmptyWeeklyMenu,
  formatDishMacros,
  getMealsFromDay,
  hasDayMenuContent,
  normalizeDayMenu,
} from "@/lib/menu-utils";
import { isAdjustMenuCommand, isFormMenuCommand } from "@/lib/consult-menu";
import {
  formatTargetMacrosBlock,
  getClientMacroNorms,
  getClientTargetFiber,
  getClientTargetMacros,
} from "@/lib/macro-utils";
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
import RecipeModal from "./RecipeModal";
import TrainerHandbook from "./TrainerHandbook";

const MAX_CHAT_MESSAGES = 6;

const EMPTY_CONSULTING_DAYS: Partial<Record<WeekDay, boolean>> = {};
const EMPTY_PENDING_MENUS: Partial<Record<WeekDay, DayMenu>> = {};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  consultReady?: boolean;
}

interface MenuGeneratorProps {
  client: Client;
}

export default function MenuGenerator({ client }: MenuGeneratorProps) {
  const menu = useCoachStore((s) => s.menus[client.id]);
  const expanded = useCoachStore((s) => s.isMenuExpanded[client.id] ?? false);
  const setMenuExpanded = useCoachStore((s) => s.setMenuExpanded);
  const isConsultingMap =
    useCoachStore((s) => s.isConsulting[client.id]) ?? EMPTY_CONSULTING_DAYS;
  const pendingConsultMap =
    useCoachStore((s) => s.pendingConsultMenus[client.id]) ?? EMPTY_PENDING_MENUS;
  const setConsulting = useCoachStore((s) => s.setConsulting);
  const setPendingConsultMenu = useCoachStore((s) => s.setPendingConsultMenu);
  const clearConsultation = useCoachStore((s) => s.clearConsultation);
  const saveDayMenu = useCoachStore((s) => s.saveDayMenu);
  const updateClient = useCoachStore((s) => s.updateClient);

  const [activeDay, setActiveDay] = useState<WeekDay>("Понеділок");
  const [planMode, setPlanMode] = useState<"menu" | "workout">("menu");
  const [adjusting, setAdjusting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustInput, setAdjustInput] = useState("");
  const [consultChats, setConsultChats] = useState<Partial<Record<WeekDay, ChatMessage[]>>>({});
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState<ShareTarget | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(null);
  const [recipeDish, setRecipeDish] = useState<MenuDish | null>(null);
  const [savedConsultFlash, setSavedConsultFlash] = useState(false);
  const [handbookOpen, setHandbookOpen] = useState(false);

  const isConsultingActive = Boolean(isConsultingMap[activeDay]);
  const pendingDayMenu = pendingConsultMap[activeDay];
  const chatMessages = consultChats[activeDay] ?? [];

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

  const targetMacros = getClientTargetMacros(client);
  const macroNorms = getClientMacroNorms(client);
  const targetFiber = getClientTargetFiber(client);

  const clientPayload = {
    name: client.name,
    goal: GOAL_LABELS[client.goal],
    sex: SEX_LABELS[client.sex],
    calories: client.calories,
    protein: targetMacros.protein,
    fat: targetMacros.fat,
    carbs: targetMacros.carbs,
    macroNormsPerKg: macroNorms,
    targetMacros,
    targetFiber,
    weight: client.weightHistory[client.weightHistory.length - 1]?.value,
    notes: client.notes,
  };

  const savedDayMenu = menu?.days[activeDay];
  const hasDayMenu = hasDayMenuContent(savedDayMenu);

  const displayDay: DayMenu | undefined =
    pendingDayMenu ?? (savedDayMenu as DayMenu | undefined);
  const normalizedDisplayDay = displayDay ? normalizeDayMenu(displayDay) : null;
  const dayTotals = normalizedDisplayDay ? computeDayTotals(normalizedDisplayDay) : null;
  const dayMeals = normalizedDisplayDay ? getMealsFromDay(normalizedDisplayDay) : [];
  const dayJustification = normalizedDisplayDay?.menu_justification;

  const applyDayMenuUpdate = (dayMenu: DayMenu, explanation: string) => {
    const normalized = normalizeDayMenu(dayMenu);
    setPendingConsultMenu(client.id, activeDay, normalized);
    setConsulting(client.id, activeDay, true);

    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: explanation,
      consultReady: true,
    };

    setConsultChats((prev) => {
      const history = prev[activeDay] ?? [];
      const next = [...history, assistantMessage].slice(-MAX_CHAT_MESSAGES);
      if (autoSpeak && explanation.trim()) {
        const messageId = next.length - 1;
        window.setTimeout(() => {
          setSpeakingMessageId(messageId);
          speak(explanation, () => setSpeakingMessageId(null));
        }, 0);
      }
      return { ...prev, [activeDay]: next };
    });
  };

  const sendAdjust = async (instruction: string, historyForApi: ChatMessage[]) => {
    const currentMenu = pendingDayMenu ?? savedDayMenu;
    if (!currentMenu) return;

    const baseMenu = menu ?? createEmptyWeeklyMenu();
    const daysForApi = {
      ...baseMenu.days,
      [activeDay]: normalizeDayMenu(currentMenu),
    };

    const res = await fetch("/api/adjust-menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: clientPayload,
        weeklyMenu: { ...baseMenu, days: daysForApi },
        activeDay,
        instruction,
        messages: historyForApi.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Не вдалося оновити меню.");
    }

    const updatedDay = data.updatedDays?.[activeDay] as DayMenu | undefined;
    if (!updatedDay) {
      const explanation =
        data.explanation?.trim() ||
        "Не вдалося оновити меню. Спробуйте конкретніше.";
      setConsultChats((prev) => ({
        ...prev,
        [activeDay]: [
          ...historyForApi,
          { role: "assistant", content: explanation },
        ].slice(-MAX_CHAT_MESSAGES),
      }));
      return;
    }

    applyDayMenuUpdate(updatedDay, data.explanation?.trim() || "Меню оновлено.");
  };

  const sendConsult = async (instruction: string, historyForApi: ChatMessage[]) => {
    const currentMenu = pendingDayMenu ?? savedDayMenu;

    const res = await fetch("/api/consult-menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: clientPayload,
        activeDay,
        workoutForDay: client.weeklyWorkouts[activeDay] ?? "",
        instruction,
        messages: historyForApi,
        forceForm: isFormMenuCommand(instruction),
        currentDayMenu: currentMenu ? normalizeDayMenu(currentMenu) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Не вдалося отримати відповідь.");
    }

    const explanation = data.explanation?.trim() || "Готово.";
    const isReady = data.phase === "ready" && data.dayMenu;

    if (isReady) {
      setPendingConsultMenu(client.id, activeDay, data.dayMenu as DayMenu);
    }

    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: explanation,
      consultReady: Boolean(isReady),
    };

    setConsultChats((prev) => {
      const next = [...historyForApi, assistantMessage].slice(-MAX_CHAT_MESSAGES);
      if (autoSpeak && explanation.trim()) {
        const messageId = next.length - 1;
        window.setTimeout(() => {
          setSpeakingMessageId(messageId);
          speak(explanation, () => setSpeakingMessageId(null));
        }, 0);
      }
      return { ...prev, [activeDay]: next };
    });
  };

  const sendChat = async () => {
    const instruction = adjustInput.trim();
    if (!instruction || adjusting) return;

    const userMessage: ChatMessage = { role: "user", content: instruction };
    const historyForApi = [...chatMessages, userMessage].slice(-MAX_CHAT_MESSAGES);

    setConsulting(client.id, activeDay, true);
    setAdjusting(true);
    setError(null);
    setAdjustInput("");
    setConsultChats((prev) => ({ ...prev, [activeDay]: historyForApi }));

    try {
      const currentMenu = pendingDayMenu ?? savedDayMenu;
      const shouldAdjust =
        hasDayMenuContent(currentMenu) && isAdjustMenuCommand(instruction);

      if (shouldAdjust) {
        await sendAdjust(instruction, historyForApi);
      } else {
        await sendConsult(instruction, historyForApi);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сталася помилка. Спробуйте ще раз.");
      setAdjustInput(instruction);
      setConsultChats((prev) => ({
        ...prev,
        [activeDay]: (prev[activeDay] ?? []).slice(0, -1),
      }));
    } finally {
      setAdjusting(false);
    }
  };

  const saveConsultToSchedule = () => {
    if (!pendingDayMenu) return;
    saveDayMenu(client.id, activeDay, pendingDayMenu);
    clearConsultation(client.id, activeDay);
    setMenuExpanded(client.id, true);
    setSavedConsultFlash(true);
    setTimeout(() => setSavedConsultFlash(false), 3000);
  };

  const exitConsultation = () => {
    clearConsultation(client.id, activeDay);
    setConsultChats((prev) => {
      const next = { ...prev };
      delete next[activeDay];
      return next;
    });
  };

  const getActiveDayText = () => {
    const dayMenu = pendingDayMenu ?? savedDayMenu;
    if (!dayMenu) return "";
    return formatDayMenuForMessenger(client, activeDay, dayMenu);
  };

  const copyDay = async () => {
    const text = getActiveDayText();
    if (!text) return;
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareDay = async (target: ShareTarget) => {
    const text = getActiveDayText();
    if (!text) return;
    await shareToMessenger(text, target);
    setShared(target);
    setTimeout(() => setShared(null), 2500);
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

  const handleMacroNormChange = (field: "protein" | "fat" | "carbs", value: string) => {
    const num = parseFloat(value.replace(",", "."));
    if (Number.isNaN(num) || num <= 0) return;
    const nextNorms = { ...macroNorms, [field]: num };
    const weight = client.weightHistory[client.weightHistory.length - 1]?.value ?? 0;
    updateClient(client.id, {
      macroNormsPerKg: nextNorms,
      macros: weight > 0 ? getClientTargetMacros({ ...client, macroNormsPerKg: nextNorms }) : client.macros,
    });
  };

  const handleFiberChange = (value: string) => {
    const num = Math.round(Number(value));
    if (Number.isNaN(num) || num <= 0) return;
    updateClient(client.id, { targetFiber: num });
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-3 rounded-2xl bg-red-50 border border-red-100 px-4 py-3.5">
          <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      <button
        onClick={() => setMenuExpanded(client.id, !expanded)}
        className="w-full flex items-center justify-between gap-2 rounded-2xl border border-teal-200 bg-teal-50/60 px-4 py-4 text-teal-800 font-semibold text-sm active:scale-[0.98] transition-all hover:bg-teal-50"
      >
        <span className="flex items-center gap-2">
          <CalendarDays size={18} />
          {expanded ? "Приховати план тижня" : "План на тиждень (Харчування / Тренування) 📅"}
        </span>
        <ChevronDown
          size={18}
          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setHandbookOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-amber-950 font-semibold text-sm active:scale-[0.98] transition-all hover:bg-amber-50"
          >
            <BookOpen size={17} />
            Картотека тренера — звірка з лекціями
          </button>

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

          {planMode === "workout" && (
            <WorkoutPlanner key={activeDay} client={client} day={activeDay} />
          )}

          {planMode === "menu" && (
            <>
              {!hasDayMenu && !pendingDayMenu && !isConsultingActive && (
                <p className="text-sm text-gray-400 text-center py-2">
                  Напишіть список продуктів у чаті для {activeDay} 👇
                </p>
              )}

              <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">
                  Норми на день · {formatTargetMacrosBlock(client)}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { key: "protein" as const, label: "Білок г/кг" },
                      { key: "fat" as const, label: "Жири г/кг" },
                      { key: "carbs" as const, label: "Вугл. г/кг" },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-[10px] text-gray-400 mb-0.5">{label}</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={macroNorms[key]}
                        onChange={(e) => handleMacroNormChange(key, e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Клітковина г</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={targetFiber}
                      onChange={(e) => handleFiberChange(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {(pendingDayMenu || hasDayMenuContent(displayDay)) && displayDay && dayTotals && (
                <>
                  <div
                    className={`rounded-2xl border px-4 py-3 ${
                      pendingDayMenu
                        ? "bg-amber-50 border-amber-200 border-dashed"
                        : "bg-teal-50 border-teal-100"
                    }`}
                  >
                    <p className="font-semibold text-teal-900 flex items-center gap-2">
                      {activeDay}
                      {pendingDayMenu && (
                        <span className="text-[10px] font-medium bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                          Чернетка
                        </span>
                      )}
                      {isConsultingActive && !pendingDayMenu && (
                        <span className="text-[10px] font-medium bg-sky-200 text-sky-900 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                          <MessageCircle size={10} />
                          Консультація
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-teal-700 mt-0.5">
                      🔥 {dayTotals.totalCalories} ккал · 🥩 {dayTotals.macros.protein} г · 🥑{" "}
                      {dayTotals.macros.fat} г · 🍞 {dayTotals.macros.carbs} г · 🌾 {dayTotals.fiber}{" "}
                      г кл.
                    </p>
                  </div>

                  {dayMeals.map((meal) => (
                    <div
                      key={meal.id}
                      className="rounded-2xl border border-gray-100 px-4 py-3.5"
                    >
                      <p className="font-semibold text-gray-900 mb-2">
                        {meal.label.emoji} {meal.title}
                      </p>
                      <ul className="space-y-2.5">
                        {meal.dishes.map((dish, i) => (
                          <li key={i} className="text-sm text-gray-600">
                            <div className="flex justify-between gap-3">
                              <span className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => setRecipeDish(dish)}
                                  className="text-teal-700 hover:underline cursor-pointer text-left inline-flex items-center gap-1 font-medium"
                                >
                                  {dish.title}
                                  <span className="text-xs opacity-80" aria-hidden>
                                    🍳
                                  </span>
                                </button>
                                {" — "}
                                {dish.portion}
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

                  {dayJustification && (
                    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 to-violet-50/50 px-4 py-4">
                      <h3 className="text-sm font-semibold text-indigo-950 mb-2.5">
                        🔬 Нутриціологічний аналіз та обґрунтування дня
                      </h3>
                      <p className="text-sm text-indigo-900/85 whitespace-pre-wrap leading-relaxed">
                        {dayJustification}
                      </p>
                    </div>
                  )}
                </>
              )}

              <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-3.5 py-3.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2">
                  <Wand2 size={14} />
                  {isConsultingActive
                    ? `Консультація · меню на ${activeDay}`
                    : `Скласти меню на ${activeDay}`}
                </p>
                <p className="text-[11px] text-sky-700 mb-2 px-0.5">
                  Напишіть продукти або коригуйте меню («додай перекус», «кава з 20 мл молока»). Коли
                  готові — «Формуй меню».
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
                        {m.consultReady && (
                          <p className="flex items-center gap-1 text-xs text-amber-700 font-medium mt-1 px-1">
                            <CalendarCheck size={13} />
                            Меню сформовано — натисніть «Зберегти в розклад»
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
                    placeholder="Продукти або відповідь на питання ШІ..."
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
                  onChange={(enabled) => {
                    setAutoSpeak(enabled);
                    writeAutoSpeakPreference("menu", enabled);
                  }}
                  disabled={adjusting}
                />
                {isConsultingActive && (
                  <button
                    type="button"
                    onClick={exitConsultation}
                    className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    Скасувати консультацію
                  </button>
                )}
              </div>

              {pendingDayMenu && (
                <button
                  onClick={saveConsultToSchedule}
                  className={`w-full flex items-center justify-center gap-2 rounded-2xl font-semibold py-3.5 text-sm active:scale-[0.98] transition-all ${
                    savedConsultFlash
                      ? "bg-emerald-600 text-white"
                      : "bg-amber-500 text-white hover:bg-amber-600"
                  }`}
                >
                  <CheckCircle2 size={18} />
                  {savedConsultFlash ? "✓ Збережено в розклад" : "Зберегти в розклад"}
                </button>
              )}

              {(hasDayMenu || pendingDayMenu) && (
                <div className="flex gap-2 items-stretch">
                  <button
                    onClick={copyDay}
                    disabled={!getActiveDayText()}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-2xl font-semibold py-3 text-sm active:scale-[0.98] transition-all min-w-0 disabled:opacity-40 ${
                      copied
                        ? "bg-emerald-600 text-white"
                        : "bg-teal-600 text-white hover:bg-teal-700"
                    }`}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    <span className="truncate">
                      {copied ? "Скопійовано!" : `Копіювати ${WEEK_DAY_SHORT[activeDay]}`}
                    </span>
                  </button>
                  <button
                    onClick={() => shareDay("telegram")}
                    disabled={!getActiveDayText()}
                    className={`shrink-0 w-12 rounded-2xl border flex items-center justify-center active:scale-95 transition-all disabled:opacity-40 ${
                      shared === "telegram"
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                    aria-label="Поділитися в Telegram"
                    title={`Telegram — ${activeDay}`}
                  >
                    <TelegramIcon size={22} />
                  </button>
                  <button
                    onClick={() => shareDay("viber")}
                    disabled={!getActiveDayText()}
                    className={`shrink-0 w-12 rounded-2xl border flex items-center justify-center active:scale-95 transition-all disabled:opacity-40 ${
                      shared === "viber"
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                    aria-label="Поділитися у Viber"
                    title={`Viber — ${activeDay}`}
                  >
                    <ViberIcon size={22} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <RecipeModal dish={recipeDish} onClose={() => setRecipeDish(null)} />
      {handbookOpen && <TrainerHandbook onClose={() => setHandbookOpen(false)} />}
    </div>
  );
}
