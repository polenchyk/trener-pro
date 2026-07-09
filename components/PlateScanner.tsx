"use client";

import { useRef, useState } from "react";
import {
  X,
  Camera,
  ScanLine,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import type { ScanResult } from "@/lib/types";
import { fileToResizedDataUrl } from "@/lib/image";

function formatScanForClipboard(result: ScanResult): string {
  const lines: string[] = [];
  lines.push(`📸 РОЗБІР ТАРІЛКИ`);
  lines.push("");
  lines.push(`🍽 Страва: ${result.title}`);
  if (result.ingredients.length > 0) {
    lines.push(`🧾 Склад: ${result.ingredients.join(", ")}`);
  }
  lines.push("");
  lines.push(`🔥 Калорійність: ~${result.calories} ккал`);
  lines.push(`🥩 Білки: ${result.protein} г`);
  lines.push(`🥑 Жири: ${result.fat} г`);
  lines.push(`🍞 Вуглеводи: ${result.carbs} г`);
  lines.push("");
  lines.push("З турботою про твою форму, твій тренер! 💪🏼");
  return lines.join("\n");
}

interface PlateScannerProps {
  onClose: () => void;
}

export default function PlateScanner({ onClose }: PlateScannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setResult(null);

    let image: string;
    try {
      image = await fileToResizedDataUrl(file, 1024);
    } catch {
      setError("Не вдалося прочитати фото. Спробуйте інше зображення.");
      return;
    }

    setPreview(image);
    setLoading(true);
    try {
      const res = await fetch("/api/scan-plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не вдалося розпізнати страву.");
      }
      setResult(data.result as ScanResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сталася помилка. Спробуйте ще раз.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!result) return;
    const text = formatScanForClipboard(result);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <ScanLine size={22} className="text-teal-600" />
            Сканер тарілки
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Закрити"
          >
            <X size={22} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!preview && !loading && (
            <>
              <p className="text-sm text-gray-500">
                Сфотографуйте тарілку клієнта — AI визначить страву, склад і порахує
                калорійність та БЖВ.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-teal-300 bg-teal-50/50 py-10 text-teal-700 active:scale-[0.98] transition-all hover:bg-teal-50"
              >
                <Camera size={36} />
                <span className="font-semibold">Зробити фото або обрати з галереї</span>
              </button>
            </>
          )}

          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Фото тарілки"
              className="w-full max-h-64 object-cover rounded-3xl"
            />
          )}

          {loading && (
            <div className="flex flex-col items-center gap-3 py-6 text-teal-600">
              <Loader2 size={36} className="animate-spin" />
              <p className="text-sm text-gray-500 text-center">
                AI аналізує тарілку...
                <br />
                Це займе 5–15 секунд
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-2xl bg-red-50 border border-red-100 px-4 py-3.5">
              <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-teal-50 border border-teal-100 px-4 py-4">
                <p className="font-bold text-teal-900 text-lg">🍽 {result.title}</p>
                {result.ingredients.length > 0 && (
                  <p className="text-sm text-teal-700 mt-1">
                    {result.ingredients.join(" · ")}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-2xl bg-orange-50 px-2 py-3 text-center">
                  <p className="text-xs text-orange-400">Ккал</p>
                  <p className="font-bold text-orange-700">{result.calories}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-2 py-3 text-center">
                  <p className="text-xs text-gray-400">Білки</p>
                  <p className="font-bold text-gray-800">{result.protein} г</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-2 py-3 text-center">
                  <p className="text-xs text-gray-400">Жири</p>
                  <p className="font-bold text-gray-800">{result.fat} г</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-2 py-3 text-center">
                  <p className="text-xs text-gray-400">Вугл.</p>
                  <p className="font-bold text-gray-800">{result.carbs} г</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={copyToClipboard}
                  className={`flex items-center justify-center gap-2 rounded-2xl font-semibold py-4 text-sm active:scale-[0.98] transition-all ${
                    copied
                      ? "bg-emerald-600 text-white"
                      : "bg-teal-600 text-white hover:bg-teal-700"
                  }`}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? "Скопійовано!" : "Зберегти в буфер"}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-teal-200 text-teal-700 font-semibold py-4 text-sm active:scale-[0.98] transition-all hover:bg-teal-50"
                >
                  <RefreshCw size={18} />
                  Інше фото
                </button>
              </div>
            </div>
          )}

          {(error || (preview && !result && !loading)) && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-teal-600 text-white font-semibold py-4 text-base active:scale-[0.98] transition-all hover:bg-teal-700"
            >
              <Camera size={20} />
              Спробувати інше фото
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhoto}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}
