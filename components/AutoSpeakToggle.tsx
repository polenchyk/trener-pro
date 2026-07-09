"use client";

interface AutoSpeakToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function AutoSpeakToggle({
  checked,
  onChange,
  disabled = false,
}: AutoSpeakToggleProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none mt-2 px-0.5">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:opacity-40"
      />
      Озвучувати відповіді автоматично
    </label>
  );
}
