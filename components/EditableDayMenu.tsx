"use client";

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import type { DayMenu, MenuDish } from "@/lib/types";
import { formatDishMacros } from "@/lib/menu-utils";
import { patchDishInDayMenu, sumMealMacros } from "@/lib/menu-edit";
import type { DayMealBlock } from "@/lib/menu-utils";

interface EditableDayMenuProps {
  dayMenu: DayMenu;
  meals: DayMealBlock[];
  onDayMenuChange: (menu: DayMenu) => void;
  onDishAiAdjust: (mealId: string, dishIndex: number, instruction: string) => Promise<void>;
  onOpenRecipe: (dish: MenuDish) => void;
  globalAdjusting?: boolean;
}

const QUICK_DISH_COMMANDS = [
  "Заміни на рибу зі збереженням білка",
  "Збільш білок на 10 г",
  "Зменш жири",
];

function parseNumInput(raw: string): number {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function EditableDayMenu({
  dayMenu,
  meals,
  onDayMenuChange,
  onDishAiAdjust,
  onOpenRecipe,
  globalAdjusting = false,
}: EditableDayMenuProps) {
  const [dishCommands, setDishCommands] = useState<Record<string, string>>({});
  const [dishAdjusting, setDishAdjusting] = useState<Record<string, boolean>>({});

  const dishKey = (mealId: string, dishIndex: number) => `${mealId}:${dishIndex}`;

  const patchDish = (
    mealId: string,
    dishIndex: number,
    patch: Partial<MenuDish>,
    recalcCaloriesFromMacros = false
  ) => {
    onDayMenuChange(
      patchDishInDayMenu(dayMenu, mealId, dishIndex, patch, {
        recalcCaloriesFromMacros,
      })
    );
  };

  const handleDishAi = async (mealId: string, dishIndex: number) => {
    const key = dishKey(mealId, dishIndex);
    const instruction = dishCommands[key]?.trim();
    if (!instruction || dishAdjusting[key] || globalAdjusting) return;

    setDishAdjusting((prev) => ({ ...prev, [key]: true }));
    try {
      await onDishAiAdjust(mealId, dishIndex, instruction);
      setDishCommands((prev) => ({ ...prev, [key]: "" }));
    } finally {
      setDishAdjusting((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="space-y-3">
      {meals.map((meal) => {
        const mealTotals = sumMealMacros(meal.dishes);
        return (
          <div
            key={meal.id}
            className="rounded-2xl border border-gray-100 px-4 py-3.5"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="font-semibold text-gray-900">
                {meal.label.emoji} {meal.title}
              </p>
              <p className="text-[11px] text-gray-400 tabular-nums shrink-0">
                {mealTotals.calories} ккал · Б{mealTotals.protein} Ж{mealTotals.fat} В
                {mealTotals.carbs}
              </p>
            </div>

            <ul className="space-y-4">
              {meal.dishes.map((dish, dishIndex) => {
                const key = dishKey(meal.id, dishIndex);
                const busy = Boolean(dishAdjusting[key]) || globalAdjusting;

                return (
                  <li
                    key={key}
                    className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-3 space-y-2"
                  >
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={dish.title}
                        onChange={(e) =>
                          patchDish(meal.id, dishIndex, { title: e.target.value })
                        }
                        className="flex-1 min-w-[120px] rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        aria-label="Назва продукту"
                      />
                      <button
                        type="button"
                        onClick={() => onOpenRecipe(dish)}
                        className="shrink-0 text-xs text-teal-600 hover:underline px-1"
                        title="Рецепт"
                      >
                        🍳
                      </button>
                      <input
                        type="text"
                        value={dish.portion}
                        onChange={(e) =>
                          patchDish(meal.id, dishIndex, { portion: e.target.value })
                        }
                        className="w-28 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        aria-label="Порція"
                        placeholder="150 г"
                      />
                    </div>

                    <div className="grid grid-cols-5 gap-1.5">
                      {(
                        [
                          { field: "protein" as const, label: "Б", recalc: true },
                          { field: "fat" as const, label: "Ж", recalc: true },
                          { field: "carbs" as const, label: "В", recalc: true },
                          { field: "fiber" as const, label: "Кл", recalc: false },
                          { field: "calories" as const, label: "🔥", recalc: false },
                        ] as const
                      ).map(({ field, label, recalc }) => (
                        <div key={field}>
                          <label className="block text-[9px] text-gray-400 text-center mb-0.5">
                            {label}
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            value={dish[field] || ""}
                            onChange={(e) => {
                              const num = parseNumInput(e.target.value);
                              patchDish(
                                meal.id,
                                dishIndex,
                                { [field]: num },
                                recalc
                              );
                            }}
                            className="w-full rounded-lg border border-gray-200 bg-white px-1.5 py-1 text-xs text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                      ))}
                    </div>

                    <p className="text-[10px] text-gray-400 tabular-nums px-0.5">
                      {formatDishMacros(dish)} · при зміні Б/Ж/В калорії
                      перераховуються автоматично
                    </p>

                    <div className="flex flex-wrap gap-1">
                      {QUICK_DISH_COMMANDS.map((cmd) => (
                        <button
                          key={cmd}
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setDishCommands((prev) => ({ ...prev, [key]: cmd }))
                          }
                          className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-800 border border-violet-100 hover:bg-violet-100 disabled:opacity-40"
                        >
                          {cmd}
                        </button>
                      ))}
                    </div>

                    <form
                      className="flex gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleDishAi(meal.id, dishIndex);
                      }}
                    >
                      <input
                        type="text"
                        value={dishCommands[key] ?? ""}
                        onChange={(e) =>
                          setDishCommands((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        disabled={busy}
                        placeholder="ШІ-команда для цієї страви..."
                        className="flex-1 min-w-0 rounded-lg border border-violet-200 bg-white px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-60"
                      />
                      <button
                        type="submit"
                        disabled={busy || !dishCommands[key]?.trim()}
                        className="shrink-0 w-9 h-9 rounded-lg bg-violet-600 text-white flex items-center justify-center active:scale-95 disabled:opacity-40"
                        aria-label="Застосувати ШІ-команду"
                        title="ШІ змінить лише цю страву"
                      >
                        {dishAdjusting[key] ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Wand2 size={14} />
                        )}
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
