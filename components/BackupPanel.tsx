"use client";

import { useRef, useState } from "react";
import {
  X,
  Download,
  Upload,
  DatabaseBackup,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useCoachStore } from "@/lib/store";
import type { Client, WeeklyMenu } from "@/lib/types";

const BACKUP_VERSION = 4;

interface BackupPayload {
  version: number;
  app: string;
  exportedAt: string;
  clients: Client[];
  menus: Record<string, WeeklyMenu>;
}

interface BackupPanelProps {
  onClose: () => void;
}

export default function BackupPanel({ onClose }: BackupPanelProps) {
  const clients = useCoachStore((s) => s.clients);
  const menus = useCoachStore((s) => s.menus);
  const restoreBackup = useCoachStore((s) => s.restoreBackup);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const exportBackup = () => {
    const payload: BackupPayload = {
      version: BACKUP_VERSION,
      app: "Тренер Про",
      exportedAt: new Date().toISOString(),
      clients,
      menus,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trener-pro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setStatus("success");
    setMessage(
      `Експортовано: ${clients.length} клієнтів (з історією ваги та тренуваннями), ${Object.keys(menus).length} меню.`
    );
  };

  const importBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupPayload;

      if (!Array.isArray(data.clients)) {
        throw new Error("Файл не містить список клієнтів.");
      }

      restoreBackup({ clients: data.clients, menus: data.menus ?? {} });
      setStatus("success");
      setMessage(
        `Відновлено: ${data.clients.length} клієнтів, ${Object.keys(data.menus ?? {}).length} меню.`
      );
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Не вдалося прочитати файл бекапу."
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <DatabaseBackup size={22} className="text-teal-600" />
            Резервна копія
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
          <p className="text-sm text-gray-500">
            JSON-бекап зберігає всіх клієнтів разом з історією ваги, розкладом
            тренувань і тижневими меню.
          </p>

          <button
            onClick={exportBackup}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-teal-600 text-white font-semibold py-4 text-sm active:scale-[0.98] transition-all hover:bg-teal-700"
          >
            <Download size={18} />
            Завантажити бекап (.json)
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-teal-200 text-teal-700 font-semibold py-4 text-sm active:scale-[0.98] transition-all hover:bg-teal-50"
          >
            <Upload size={18} />
            Відновити з файлу
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={importBackup}
            className="hidden"
          />

          {status !== "idle" && (
            <div
              className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm ${
                status === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                  : "bg-red-50 text-red-700 border border-red-100"
              }`}
            >
              {status === "success" ? (
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
              )}
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
