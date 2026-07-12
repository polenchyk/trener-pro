"use client";

import { X } from "lucide-react";
import { useState } from "react";
import type { MenuDish } from "@/lib/types";
import { formatDishMacros } from "@/lib/menu-utils";
import { getNutrition } from "@/lib/food-calc";
import { useSpeech } from "@/lib/useSpeech";
import SpeechButton from "./SpeechButton";

interface RecipeModalProps {
  dish: MenuDish | null;
  onClose: () => void;
}

export default function RecipeModal({ dish, onClose }: RecipeModalProps) {
  const [speaking, setSpeaking] = useState(false);
  const { speak, stop, isSpeaking, isSupported } = useSpeech();

  if (!dish) return null;

  const recipeText =
    dish.recipe?.trim() ||
    "Рецепт для цієї страви уточнюється у тренера...";

  const speakText = `${dish.title}. ${dish.portion}. ${formatDishMacros(dish)}. Інгредієнти та приготування: ${recipeText}`;

  const handleSpeak = () => {
    if (speaking && isSpeaking) {
      stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(speakText, () => setSpeaking(false));
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
        <div className="sticky top-0 bg-white flex items-start justify-between gap-3 px-6 pt-6 pb-4 border-b border-gray-100 z-10">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-teal-600 mb-1">🍳 Рецепт</p>
            <h2 className="text-xl font-bold text-gray-900 leading-snug">{dish.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{dish.portion}</p>
            <p className="text-sm text-teal-700 mt-1 tabular-nums">
              🔥 {dish.calories} ккал · {formatDishMacros(dish)}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <SpeechButton
              isActive={speaking && isSpeaking}
              isSupported={isSupported}
              onToggle={handleSpeak}
            />
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
              aria-label="Закрити"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {dish.ingredients && dish.ingredients.length > 0 && (
          <IngredientsList dish={dish} />
        )}

        {dish.micros && <NutritionFacts dish={dish} />}

        <div className="px-6 py-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Інгредієнти та приготування
          </h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {recipeText}
          </p>
        </div>
      </div>
    </div>
  );
}

function IngredientsList({ dish }: { dish: MenuDish }) {
  return (
    <div className="px-6 py-4">
      <div className="rounded-2xl border border-teal-100 bg-teal-50/50 px-4 py-3">
        <h3 className="text-sm font-bold text-gray-900 mb-2">Склад (розраховано з бази)</h3>
        <ul className="space-y-1">
          {dish.ingredients!.map((ing, i) => {
            const n = getNutrition(ing.name, ing.grams);
            return (
              <li
                key={i}
                className="flex items-center justify-between gap-2 text-sm py-0.5"
              >
                <span className="text-gray-700 min-w-0 truncate">
                  {ing.isVegetable && "🥦 "}
                  {ing.name}{" "}
                  <span className="text-gray-400">· {ing.grams} г</span>
                </span>
                <span className="shrink-0 tabular-nums text-gray-500 text-xs">
                  {ing.isVegetable ? (
                    <span className="text-emerald-600">не в калораж</span>
                  ) : (
                    `${n.kcal} ккал · Б${n.protein} Ж${n.fat} В${n.carbs}`
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-[10px] text-gray-400 mt-2 leading-snug">
          Овочі/зелень (🥦) показані для об&apos;єму та клітковини, але не додаються до
          калоражу дня.
        </p>
      </div>
    </div>
  );
}

function fmt(value: number | undefined, unit: string): string {
  if (value == null) return "—";
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} ${unit}`;
}

function NutritionFacts({ dish }: { dish: MenuDish }) {
  const m = dish.micros!;

  const mainRow = (
    label: string,
    value: string,
    opts?: { bold?: boolean; sub?: boolean }
  ) => (
    <div
      className={`flex items-center justify-between py-1.5 border-b border-amber-100 ${
        opts?.sub ? "pl-4 text-gray-500" : ""
      } ${opts?.bold ? "font-semibold text-gray-900" : "text-gray-700"}`}
    >
      <span className="text-sm">{label}</span>
      <span className="text-sm tabular-nums">{value}</span>
    </div>
  );

  return (
    <div className="px-6 py-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-900">Харчова цінність</h3>
          <span className="text-[11px] text-gray-500">на {m.basedOnGrams} г</span>
        </div>

        {mainRow("Енергетична цінність", `${m.calories} ккал / ${m.energyKj} кДж`, {
          bold: true,
        })}
        {mainRow("Білки", fmt(m.protein, "г"), { bold: true })}
        {mainRow("Вуглеводи", fmt(m.carbs, "г"), { bold: true })}
        {m.sugar != null && mainRow("зокрема цукор", fmt(m.sugar, "г"), { sub: true })}
        {mainRow("Жири", fmt(m.fat, "г"), { bold: true })}
        {m.saturatedFat != null &&
          mainRow("насичені", fmt(m.saturatedFat, "г"), { sub: true })}
        {m.transFat != null &&
          mainRow("трансжири", fmt(m.transFat, "г"), { sub: true })}
        {m.monoFat != null &&
          mainRow("мононенасичені", fmt(m.monoFat, "г"), { sub: true })}
        {m.polyFat != null &&
          mainRow("поліненасичені", fmt(m.polyFat, "г"), { sub: true })}
        {m.fiber != null && m.fiber > 0 && mainRow("Клітковина", fmt(m.fiber, "г"))}
        {m.cholesterol != null && mainRow("Холестерин", fmt(m.cholesterol, "мг"))}
        {m.salt != null && mainRow("Сіль", fmt(m.salt, "г"))}
        {m.calcium != null && mainRow("Кальцій", fmt(m.calcium, "мг"))}

        <p className="text-[10px] text-gray-400 mt-2 leading-snug">
          Джерело: {m.source}. Значення розраховані автоматично за вагою порції.
        </p>
      </div>
    </div>
  );
}
