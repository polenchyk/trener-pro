import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Client, DayMenu, WeekDay, WeeklyMenu } from "./types";

/** Нормалізує клієнта зі старих версій даних (міграція, бекапи) */
function normalizeClient(raw: Client & { weight?: number }): Client {
  const { weight, ...client } = raw;
  return {
    ...client,
    sex: client.sex ?? "female",
    height: client.height ?? 0,
    age: client.age ?? 0,
    activityLevel: client.activityLevel ?? 1.375,
    weightHistory:
      client.weightHistory ??
      (weight && weight > 0
        ? [{ date: new Date().toISOString().slice(0, 10), value: weight }]
        : []),
    weeklyWorkouts: client.weeklyWorkouts ?? {},
  };
}

interface CoachStore {
  clients: Client[];
  /** Тижневе меню для кожного клієнта (за id) */
  menus: Record<string, WeeklyMenu>;
  /** UI-стан: чи розгорнуте меню в картці клієнта (не персистується) */
  isMenuExpanded: Record<string, boolean>;

  addClient: (data: Omit<Client, "id" | "createdAt">) => void;
  updateClient: (id: string, data: Partial<Omit<Client, "id" | "createdAt">>) => void;
  removeClient: (id: string) => void;

  setMenu: (clientId: string, menu: WeeklyMenu) => void;
  /** Точкове оновлення окремих днів (після AI-коригування) */
  updateMenuDays: (clientId: string, days: Partial<Record<WeekDay, DayMenu>>) => void;
  /** Фіксує меню та згортає його */
  approveMenu: (clientId: string) => void;
  clearMenu: (clientId: string) => void;
  setMenuExpanded: (clientId: string, expanded: boolean) => void;

  /** Тренування на день: порожній текст = день відпочинку */
  setWorkout: (clientId: string, day: WeekDay, text: string) => void;
  /** Додає запис у історію ваги (нове зважування) */
  addWeightEntry: (clientId: string, value: number, date?: string) => void;
  /** Переносить тренування з одного дня на інший */
  moveWorkout: (clientId: string, fromDay: WeekDay, toDay: WeekDay) => void;
  /** Повне відновлення даних з JSON-бекапу */
  restoreBackup: (data: { clients: Client[]; menus?: Record<string, WeeklyMenu> }) => void;
}

export const useCoachStore = create<CoachStore>()(
  persist(
    (set) => ({
      clients: [],
      menus: {},
      isMenuExpanded: {},

      addClient: (data) =>
        set((state) => ({
          clients: [
            {
              ...data,
              weightHistory: data.weightHistory ?? [],
              weeklyWorkouts: data.weeklyWorkouts ?? {},
              id: crypto.randomUUID(),
              createdAt: Date.now(),
            },
            ...state.clients,
          ],
        })),

      updateClient: (id, data) =>
        set((state) => ({
          clients: state.clients.map((c) => (c.id === id ? { ...c, ...data } : c)),
        })),

      removeClient: (id) =>
        set((state) => {
          const menus = { ...state.menus };
          delete menus[id];
          const isMenuExpanded = { ...state.isMenuExpanded };
          delete isMenuExpanded[id];
          return {
            clients: state.clients.filter((c) => c.id !== id),
            menus,
            isMenuExpanded,
          };
        }),

      setMenu: (clientId, menu) =>
        set((state) => ({ menus: { ...state.menus, [clientId]: menu } })),

      updateMenuDays: (clientId, days) =>
        set((state) => {
          const current = state.menus[clientId];
          if (!current) return state;
          return {
            menus: {
              ...state.menus,
              [clientId]: {
                ...current,
                days: { ...current.days, ...days },
                // Після змін меню потребує повторного затвердження
                approved: false,
              },
            },
          };
        }),

      approveMenu: (clientId) =>
        set((state) => {
          const current = state.menus[clientId];
          if (!current) return state;
          return {
            menus: { ...state.menus, [clientId]: { ...current, approved: true } },
            isMenuExpanded: { ...state.isMenuExpanded, [clientId]: false },
          };
        }),

      clearMenu: (clientId) =>
        set((state) => {
          const menus = { ...state.menus };
          delete menus[clientId];
          return { menus };
        }),

      setMenuExpanded: (clientId, expanded) =>
        set((state) => ({
          isMenuExpanded: { ...state.isMenuExpanded, [clientId]: expanded },
        })),

      setWorkout: (clientId, day, text) =>
        set((state) => ({
          clients: state.clients.map((c) => {
            if (c.id !== clientId) return c;
            const weeklyWorkouts = { ...c.weeklyWorkouts };
            const trimmed = text.trim();
            if (trimmed) {
              weeklyWorkouts[day] = trimmed;
            } else {
              delete weeklyWorkouts[day];
            }
            return { ...c, weeklyWorkouts };
          }),
        })),

      addWeightEntry: (clientId, value, date) =>
        set((state) => ({
          clients: state.clients.map((c) => {
            if (c.id !== clientId || value <= 0) return c;
            const entryDate = date ?? new Date().toISOString().slice(0, 10);
            const history = [...c.weightHistory];
            const sameDayIdx = history.findIndex((e) => e.date === entryDate);
            if (sameDayIdx >= 0) {
              history[sameDayIdx] = { date: entryDate, value };
            } else {
              history.push({ date: entryDate, value });
            }
            history.sort((a, b) => a.date.localeCompare(b.date));
            return { ...c, weightHistory: history };
          }),
        })),

      moveWorkout: (clientId, fromDay, toDay) =>
        set((state) => ({
          clients: state.clients.map((c) => {
            if (c.id !== clientId) return c;
            const text = c.weeklyWorkouts[fromDay]?.trim();
            if (!text) return c;
            const weeklyWorkouts = { ...c.weeklyWorkouts };
            delete weeklyWorkouts[fromDay];
            weeklyWorkouts[toDay] = text;
            return { ...c, weeklyWorkouts };
          }),
        })),

      restoreBackup: (data) =>
        set(() => ({
          clients: (data.clients ?? []).map(normalizeClient),
          menus: data.menus ?? {},
          isMenuExpanded: {},
        })),
    }),
    {
      name: "coachmenu-pro-storage",
      storage: createJSONStorage(() => localStorage),
      version: 4,
      migrate: (persisted, version) => {
        let state = persisted as CoachStore;
        // v0/v1 зберігали одноденні меню несумісного формату — скидаємо лише меню
        if (version < 2) {
          state = { ...state, menus: {} };
        }
        // v3 додала стать/зріст/вік/активність; v4 перетворила вагу на історію
        // зважувань і додала розклад тренувань — normalizeClient покриває все
        if (version < 4) {
          state = {
            ...state,
            clients: (state.clients ?? []).map(normalizeClient),
          };
        }
        return state;
      },
      // UI-прапорець не зберігаємо: після перезавантаження всі меню згорнуті
      partialize: (state) =>
        ({ clients: state.clients, menus: state.menus }) as CoachStore,
    }
  )
);
