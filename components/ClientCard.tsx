"use client";

import { useState } from "react";
import { ChevronDown, Trash2, Flame, Pencil, Weight, TrendingDown, Plus } from "lucide-react";
import { Client, GOAL_EMOJI, GOAL_LABELS, latestWeight } from "@/lib/types";
import { useCoachStore } from "@/lib/store";
import MenuGenerator from "./MenuGenerator";
import ClientForm from "./ClientForm";
import WeightChart from "./WeightChart";

interface ClientCardProps {
  client: Client;
}

export default function ClientCard({ client }: ClientCardProps) {
  const removeClient = useCoachStore((s) => s.removeClient);
  const addWeightEntry = useCoachStore((s) => s.addWeightEntry);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newWeight, setNewWeight] = useState("");

  const isPhotoAvatar = client.avatar?.startsWith("data:image/");

  const handleDelete = () => {
    if (confirmDelete) {
      removeClient(client.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleAddWeight = () => {
    const w = Number(newWeight);
    if (w > 0) {
      addWeightEntry(client.id, w);
      setNewWeight("");
    }
  };

  return (
    <div className="rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-5 py-4 flex items-center gap-4 active:bg-gray-50 transition-colors"
      >
        <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
          {isPhotoAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.avatar}
              alt={client.name}
              className="w-full h-full object-cover"
            />
          ) : (
            client.avatar || GOAL_EMOJI[client.goal]
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-base truncate">{client.name}</p>
          <p className="text-sm text-gray-500">{GOAL_LABELS[client.goal]}</p>
        </div>
        <div className="flex items-center gap-1.5 text-teal-700 bg-teal-50 rounded-full px-3 py-1.5 text-sm font-medium shrink-0">
          <Flame size={14} />
          {client.calories}
        </div>
        <ChevronDown
          size={20}
          className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-50">
          {(latestWeight(client) || client.height > 0 || client.age > 0) && (
            <p className="flex items-center gap-1.5 text-sm text-gray-500 mb-3 mt-3 px-1">
              <Weight size={14} />
              {[
                latestWeight(client) ? `${latestWeight(client)} кг` : null,
                client.height > 0 ? `${client.height} см` : null,
                client.age > 0 ? `${client.age} р.` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          <div className="rounded-2xl border border-gray-100 px-4 py-3.5 mb-3">
            <p className="flex items-center gap-1.5 font-semibold text-gray-900 text-sm mb-2">
              <TrendingDown size={15} className="text-teal-600" />
              Прогрес ваги
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddWeight();
              }}
              className="flex gap-2 mb-3"
            >
              <input
                type="number"
                inputMode="decimal"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder="Нова вага, кг"
                className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={!newWeight || Number(newWeight) <= 0}
                className="shrink-0 w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center active:scale-95 transition-all hover:bg-teal-700 disabled:opacity-40"
                aria-label="Додати зважування"
              >
                <Plus size={18} />
              </button>
            </form>

            {client.weightHistory.length > 0 ? (
              <WeightChart
                entries={client.weightHistory}
                gainIsGood={client.goal === "muscle_gain"}
              />
            ) : (
              <p className="text-xs text-gray-400 px-1">
                Ще немає зважувань — введіть вагу вище
              </p>
            )}
          </div>

          {client.notes && (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-2xl px-4 py-3 mb-3">
              📝 {client.notes}
            </p>
          )}

          <button
            onClick={() => setEditOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-gray-200 text-gray-700 font-semibold py-3.5 text-sm mb-4 active:scale-[0.98] transition-all hover:bg-gray-50"
          >
            <Pencil size={16} />
            Редагувати дані
          </button>

          <MenuGenerator client={client} />

          <button
            onClick={handleDelete}
            className={`mt-4 w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium transition-colors ${
              confirmDelete
                ? "bg-red-600 text-white"
                : "text-red-500 hover:bg-red-50"
            }`}
          >
            <Trash2 size={16} />
            {confirmDelete ? "Натисніть ще раз для підтвердження" : "Видалити клієнта"}
          </button>
        </div>
      )}

      {editOpen && <ClientForm client={client} onClose={() => setEditOpen(false)} />}
    </div>
  );
}
