"use client";

import { X } from "lucide-react";
import { useState } from "react";
import type { MenuDish } from "@/lib/types";
import { formatDishMacros } from "@/lib/menu-utils";
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
