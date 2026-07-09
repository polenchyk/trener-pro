"use client";

import { Square, Volume2 } from "lucide-react";

interface SpeechButtonProps {
  isActive: boolean;
  isSupported: boolean;
  onToggle: () => void;
  className?: string;
}

export default function SpeechButton({
  isActive,
  isSupported,
  onToggle,
  className = "",
}: SpeechButtonProps) {
  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all active:scale-95 ${
        isActive
          ? "bg-teal-600 text-white animate-pulse"
          : "text-teal-600 hover:bg-teal-50"
      } ${className}`}
      aria-label={isActive ? "Зупинити озвучування" : "Озвучити відповідь"}
    >
      {isActive ? <Square size={13} fill="currentColor" /> : <Volume2 size={15} />}
    </button>
  );
}
