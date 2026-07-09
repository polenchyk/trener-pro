"use client";

import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { WeightEntry } from "@/lib/types";

interface WeightChartProps {
  entries: WeightEntry[];
  /** true, якщо збільшення ваги — це добре (ціль «Набір маси») */
  gainIsGood?: boolean;
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

const W = 300;
const H = 110;
const PAD_X = 10;
const PAD_Y = 14;

export default function WeightChart({ entries, gainIsGood = false }: WeightChartProps) {
  if (entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const uniqueDates = new Set(sorted.map((e) => e.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (uniqueDates.size < 2) {
    return (
      <p className="text-sm text-gray-500 px-1 leading-relaxed">
        Перше зважування зафіксовано{" "}
        <span className="font-semibold text-gray-800">{first.value} кг</span>,{" "}
        {formatDate(first.date)}). Графік з&apos;явиться після наступного зважування.
      </p>
    );
  }

  const delta = Math.round((last.value - first.value) * 10) / 10;
  const isGood = delta === 0 ? true : delta < 0 ? !gainIsGood : gainIsGood;

  const values = sorted.map((e) => e.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = sorted.map((e, i) => {
    const x = PAD_X + (i / (sorted.length - 1)) * (W - PAD_X * 2);
    const y = PAD_Y + (1 - (e.value - min) / range) * (H - PAD_Y * 2);
    return { x, y, entry: e };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${PAD_X},${H} ${polyline} ${W - PAD_X},${H}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-sm text-gray-500">
          {first.value} кг → <span className="font-semibold text-gray-800">{last.value} кг</span>
        </p>
        <span
          className={`flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 ${
            delta === 0
              ? "bg-gray-100 text-gray-600"
              : isGood
                ? "bg-emerald-50 text-emerald-700"
                : "bg-orange-50 text-orange-700"
          }`}
        >
          {delta === 0 ? (
            <Minus size={13} />
          ) : delta < 0 ? (
            <TrendingDown size={13} />
          ) : (
            <TrendingUp size={13} />
          )}
          {delta > 0 ? `+${delta}` : delta} кг
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Графік зміни ваги"
      >
        <polygon points={area} fill="rgb(13 148 136 / 0.08)" />
        <polyline
          points={polyline}
          fill="none"
          stroke="#0d9488"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#0d9488" />
            {(i === 0 || i === points.length - 1) && (
              <text
                x={p.x}
                y={p.y - 7}
                textAnchor={i === 0 ? "start" : "end"}
                fontSize="10"
                fontWeight="600"
                fill="#374151"
              >
                {p.entry.value}
              </text>
            )}
          </g>
        ))}
      </svg>

      <div className="flex justify-between text-xs text-gray-400 px-1">
        <span>{formatDate(first.date)}</span>
        <span>{formatDate(last.date)}</span>
      </div>
    </div>
  );
}
