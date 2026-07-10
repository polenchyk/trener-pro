"use client";

import { useEffect, useRef, useState } from "react";
import { X, UserPlus, Check, Camera, Calculator } from "lucide-react";
import { useCoachStore } from "@/lib/store";
import {
  ACTIVITY_LEVELS,
  Client,
  DEFAULT_MACRO_NORMS_PER_KG,
  DEFAULT_TARGET_FIBER,
  Goal,
  GOAL_LABELS,
  latestWeight,
  PRESET_AVATARS,
  Sex,
  SEX_LABELS,
} from "@/lib/types";
import { calcMacrosFromWeight } from "@/lib/macro-utils";
import { suggestNutritionNorms } from "@/lib/macro-norms";
import { calcDailyCalories } from "@/lib/calories";
import { fileToResizedDataUrl } from "@/lib/image";

interface ClientFormProps {
  /** Якщо переданий клієнт — форма працює в режимі редагування */
  client?: Client;
  onClose: () => void;
}

export default function ClientForm({ client, onClose }: ClientFormProps) {
  const addClient = useCoachStore((s) => s.addClient);
  const updateClient = useCoachStore((s) => s.updateClient);
  const addWeightEntry = useCoachStore((s) => s.addWeightEntry);
  const isEdit = Boolean(client);

  const lastEntry = client?.weightHistory[client.weightHistory.length - 1];

  const [name, setName] = useState(client?.name ?? "");
  const [goal, setGoal] = useState<Goal>(client?.goal ?? "weight_loss");
  const [sex, setSex] = useState<Sex>(client?.sex ?? "female");
  /** Початкова вага (лише при створенні) */
  const [weight, setWeight] = useState(isEdit ? "" : lastEntry ? String(lastEntry.value) : "");
  /** Нове зважування (лише при редагуванні) */
  const [newWeighIn, setNewWeighIn] = useState("");
  const [height, setHeight] = useState(client?.height ? String(client.height) : "");
  const [age, setAge] = useState(client?.age ? String(client.age) : "");
  const [activityLevel, setActivityLevel] = useState(client?.activityLevel ?? 1.375);
  const [calories, setCalories] = useState(client?.calories ? String(client.calories) : "");
  const [proteinPerKg, setProteinPerKg] = useState(
    String(client?.macroNormsPerKg?.protein ?? DEFAULT_MACRO_NORMS_PER_KG.protein)
  );
  const [fatPerKg, setFatPerKg] = useState(
    String(client?.macroNormsPerKg?.fat ?? DEFAULT_MACRO_NORMS_PER_KG.fat)
  );
  const [carbsPerKg, setCarbsPerKg] = useState(
    String(client?.macroNormsPerKg?.carbs ?? DEFAULT_MACRO_NORMS_PER_KG.carbs)
  );
  const [fiberGrams, setFiberGrams] = useState(
    String(client?.targetFiber ?? DEFAULT_TARGET_FIBER)
  );
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [avatar, setAvatar] = useState<string | undefined>(client?.avatar);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skipAutoNormsOnce = useRef(isEdit);

  const isPhotoAvatar = avatar?.startsWith("data:image/");

  const weightForCalc = isEdit
    ? Number(newWeighIn) || latestWeight(client!) || 0
    : Number(weight) || 0;

  const canAutoCalc = weightForCalc > 0 && Number(height) > 0 && Number(age) > 0;
  const autoCalories = canAutoCalc
    ? calcDailyCalories({
        sex,
        weight: weightForCalc,
        height: Number(height),
        age: Number(age),
        activityLevel,
        goal,
      })
    : 0;

  const isValid = name.trim().length > 0 && (Number(calories) > 0 || canAutoCalc);

  useEffect(() => {
    if (skipAutoNormsOnce.current) {
      skipAutoNormsOnce.current = false;
      return;
    }
    const { macroNormsPerKg, targetFiber } = suggestNutritionNorms(goal, activityLevel);
    setProteinPerKg(String(macroNormsPerKg.protein));
    setFatPerKg(String(macroNormsPerKg.fat));
    setCarbsPerKg(String(macroNormsPerKg.carbs));
    setFiberGrams(String(targetFiber));
  }, [goal, activityLevel, sex]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file, 128, { square: true });
      setAvatar(dataUrl);
    } catch {
      // Якщо фото не читається — просто нічого не змінюємо
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const macroNormsPerKg = {
      protein: Number(proteinPerKg) > 0 ? Number(proteinPerKg) : DEFAULT_MACRO_NORMS_PER_KG.protein,
      fat: Number(fatPerKg) > 0 ? Number(fatPerKg) : DEFAULT_MACRO_NORMS_PER_KG.fat,
      carbs: Number(carbsPerKg) > 0 ? Number(carbsPerKg) : DEFAULT_MACRO_NORMS_PER_KG.carbs,
    };
    const targetFiber =
      Number(fiberGrams) > 0 ? Math.round(Number(fiberGrams)) : DEFAULT_TARGET_FIBER;
    const weightForMacros = isEdit
      ? (latestWeight(client!) ?? (Number(newWeighIn) || 0))
      : Number(weight) || 0;
    const macrosFromNorms =
      weightForMacros > 0
        ? calcMacrosFromWeight(weightForMacros, macroNormsPerKg)
        : client?.macros ?? { protein: 0, fat: 0, carbs: 0 };

    const baseData = {
      name: name.trim(),
      goal,
      sex,
      height: Number(height) || 0,
      age: Number(age) || 0,
      activityLevel,
      calories: Number(calories) > 0 ? Number(calories) : autoCalories,
      macroNormsPerKg,
      targetFiber,
      macros: macrosFromNorms,
      avatar,
      notes: notes.trim() || undefined,
    };

    if (isEdit && client) {
      updateClient(client.id, baseData);
      const nw = Number(newWeighIn);
      if (nw > 0) {
        addWeightEntry(client.id, nw);
      }
    } else {
      const w = Number(weight) || 0;
      const today = new Date().toISOString().slice(0, 10);
      addClient({
        ...baseData,
        weightHistory: w > 0 ? [{ date: today, value: w }] : [],
        weeklyWorkouts: {},
      });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 z-10">
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? "Редагувати клієнта" : "Новий клієнт"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Закрити"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Аватарка</label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatar(emoji)}
                  className={`w-12 h-12 rounded-2xl text-2xl flex items-center justify-center border transition-colors ${
                    avatar === emoji
                      ? "bg-teal-50 border-teal-500 ring-2 ring-teal-500"
                      : "bg-white border-gray-200 hover:border-teal-300"
                  }`}
                >
                  {emoji}
                </button>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center border overflow-hidden transition-colors ${
                  isPhotoAvatar
                    ? "border-teal-500 ring-2 ring-teal-500"
                    : "bg-gray-50 border-gray-200 text-gray-400 hover:border-teal-300"
                }`}
                aria-label="Завантажити фото"
              >
                {isPhotoAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="Фото клієнта" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={20} />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Ім&apos;я клієнта
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Напр. Олена"
              autoFocus={!isEdit}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Стать</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(SEX_LABELS) as Sex[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSex(s)}
                    className={`rounded-2xl px-2 py-3 text-sm font-medium border transition-colors ${
                      sex === s
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-teal-300"
                    }`}
                  >
                    {SEX_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Вік</label>
              <input
                type="number"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Напр. 32"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {isEdit ? (
              <div className="col-span-2 space-y-2">
                {lastEntry && (
                  <p className="text-sm text-gray-500 px-1">
                    Поточна вага:{" "}
                    <span className="font-semibold text-gray-800">{lastEntry.value} кг</span>
                    {" · "}
                    {lastEntry.date.split("-").reverse().join(".")}
                  </p>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Додати нове зважування, кг
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={newWeighIn}
                    onChange={(e) => setNewWeighIn(e.target.value)}
                    placeholder="Напр. 63.5"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-400 mt-1 px-0.5">
                    Запишеться в історію ваги з сьогоднішньою датою
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Вага, кг</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Напр. 65"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            )}
            <div className={isEdit ? "col-span-2" : ""}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Зріст, см
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="Напр. 168"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Рівень активності
            </label>
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(Number(e.target.value))}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              {ACTIVITY_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Ціль</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGoal(g)}
                  className={`rounded-2xl px-3 py-3 text-sm font-medium border transition-colors ${
                    goal === g
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-teal-300"
                  }`}
                >
                  {GOAL_LABELS[g]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Калорії на день{" "}
              <span className="text-gray-400 font-normal">(необов&apos;язково)</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder={
                canAutoCalc ? `Авто: ${autoCalories} ккал` : "Порожньо = авторозрахунок"
              }
              className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            {!calories && canAutoCalc && (
              <p className="flex items-center gap-1.5 text-xs text-teal-700 mt-1.5 px-0.5">
                <Calculator size={13} />
                Розрахуємо автоматично: {autoCalories} ккал (Міффлін-Сан Жеор ×{" "}
                {activityLevel})
              </p>
            )}
            {!calories && !canAutoCalc && (
              <p className="text-xs text-gray-400 mt-1.5 px-0.5">
                Для авторозрахунку заповніть вагу, зріст і вік
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Норми БЖВ (г/кг ваги) та клітковина
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Білок</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={proteinPerKg}
                  onChange={(e) => setProteinPerKg(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Жири</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={fatPerKg}
                  onChange={(e) => setFatPerKg(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Вуглеводи</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={carbsPerKg}
                  onChange={(e) => setCarbsPerKg(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Клітковина (г)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="0"
                  value={fiberGrams}
                  onChange={(e) => setFiberGrams(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5 px-0.5">
              Авторозрахунок за ціллю та активністю. Можна змінити вручну.
            </p>
            {weightForCalc > 0 && (
              <p className="text-xs text-teal-700 mt-1 px-0.5">
                При вазі {weightForCalc} кг: Б{" "}
                {calcMacrosFromWeight(weightForCalc, {
                  protein: Number(proteinPerKg) || DEFAULT_MACRO_NORMS_PER_KG.protein,
                  fat: Number(fatPerKg) || DEFAULT_MACRO_NORMS_PER_KG.fat,
                  carbs: Number(carbsPerKg) || DEFAULT_MACRO_NORMS_PER_KG.carbs,
                }).protein}{" "}
                г · Ж{" "}
                {calcMacrosFromWeight(weightForCalc, {
                  protein: Number(proteinPerKg) || DEFAULT_MACRO_NORMS_PER_KG.protein,
                  fat: Number(fatPerKg) || DEFAULT_MACRO_NORMS_PER_KG.fat,
                  carbs: Number(carbsPerKg) || DEFAULT_MACRO_NORMS_PER_KG.carbs,
                }).fat}{" "}
                г · В{" "}
                {calcMacrosFromWeight(weightForCalc, {
                  protein: Number(proteinPerKg) || DEFAULT_MACRO_NORMS_PER_KG.protein,
                  fat: Number(fatPerKg) || DEFAULT_MACRO_NORMS_PER_KG.fat,
                  carbs: Number(carbsPerKg) || DEFAULT_MACRO_NORMS_PER_KG.carbs,
                }).carbs}{" "}
                г · Кл {Number(fiberGrams) || DEFAULT_TARGET_FIBER} г
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Побажання <span className="text-gray-400 font-normal">(необов&apos;язково)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Напр. без лактози, не любить рибу..."
              rows={2}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!isValid}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-teal-600 text-white font-semibold py-4 text-base active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-teal-700"
          >
            {isEdit ? <Check size={20} /> : <UserPlus size={20} />}
            {isEdit ? "Зберегти зміни" : "Додати клієнта"}
          </button>
        </form>
      </div>
    </div>
  );
}
