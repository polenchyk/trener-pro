"use client";

import { useEffect, useState } from "react";
import { Plus, Dumbbell, Users, ScanLine, DatabaseBackup } from "lucide-react";
import { useCoachStore } from "@/lib/store";
import ClientCard from "@/components/ClientCard";
import ClientForm from "@/components/ClientForm";
import PlateScanner from "@/components/PlateScanner";
import BackupPanel from "@/components/BackupPanel";
import GlobalAIAssistant from "@/components/GlobalAIAssistant";

export default function HomePage() {
  const clients = useCoachStore((s) => s.clients);
  const [formOpen, setFormOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);

  // Уникаємо розбіжностей гідратації: localStorage доступний лише в браузері
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main className="flex-1 w-full max-w-lg mx-auto px-4 pb-28">
      <header className="pt-8 pb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-teal-600 flex items-center justify-center text-white shrink-0">
            <Dumbbell size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight truncate">
              Тренер Про
            </h1>
            <p className="text-sm text-gray-500 truncate">Меню для клієнтів за хвилину</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setBackupOpen(true)}
            className="flex flex-col items-center gap-0.5 rounded-2xl bg-gray-50 text-gray-600 px-3 py-2 active:scale-95 transition-all hover:bg-gray-100"
            aria-label="Резервна копія"
          >
            <DatabaseBackup size={20} />
            <span className="text-[10px] font-semibold leading-none">Бекап</span>
          </button>
          <button
            onClick={() => setScannerOpen(true)}
            className="flex flex-col items-center gap-0.5 rounded-2xl bg-teal-50 text-teal-700 px-3.5 py-2 active:scale-95 transition-all hover:bg-teal-100"
            aria-label="Сканувати тарілку"
          >
            <ScanLine size={22} />
            <span className="text-[11px] font-semibold leading-none">Тарілка</span>
          </button>
        </div>
      </header>

      {mounted && <GlobalAIAssistant clients={clients} />}

      {!mounted ? (
        <div className="space-y-3">
          <div className="h-20 rounded-3xl bg-gray-100 animate-pulse" />
          <div className="h-20 rounded-3xl bg-gray-100 animate-pulse" />
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 px-6">
          <div className="w-20 h-20 rounded-3xl bg-teal-50 flex items-center justify-center mb-5">
            <Users size={36} className="text-teal-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Поки що немає клієнтів</h2>
          <p className="text-sm text-gray-500 max-w-xs">
            Додайте першого клієнта, вкажіть його ціль і калорії — і згенеруйте меню одним
            дотиком.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-400 mb-3 px-1">
            Клієнти · {clients.length}
          </p>
          <div className="space-y-3">
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        </>
      )}

      <button
        onClick={() => setFormOpen(true)}
        className="fixed bottom-6 right-1/2 translate-x-1/2 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 flex items-center gap-2 rounded-full bg-teal-600 text-white font-semibold pl-5 pr-6 py-4 shadow-lg shadow-teal-600/30 active:scale-95 transition-all hover:bg-teal-700"
      >
        <Plus size={22} />
        Додати клієнта
      </button>

      {formOpen && <ClientForm onClose={() => setFormOpen(false)} />}
      {scannerOpen && <PlateScanner onClose={() => setScannerOpen(false)} />}
      {backupOpen && <BackupPanel onClose={() => setBackupOpen(false)} />}
    </main>
  );
}
