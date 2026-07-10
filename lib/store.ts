import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Client, DayMenu, WeekDay, WeeklyMenu } from "./types";
import { DEFAULT_MACRO_NORMS_PER_KG, DEFAULT_TARGET_FIBER, WEEK_DAYS } from "./types";
import { suggestNutritionNorms } from "./macro-norms";
import { calcMacrosFromWeight } from "./macro-utils";
import { createEmptyWeeklyMenu, normalizeDayMenu, normalizeWeeklyMenu } from "./menu-utils";

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
    macroNormsPerKg: client.macroNormsPerKg ?? { ...DEFAULT_MACRO_NORMS_PER_KG },
    targetFiber: client.targetFiber ?? DEFAULT_TARGET_FIBER,
  };
}

interface CoachStore {
  clients: Client[];
  /** Тижневе меню для кожного клієнта (за id) */
  menus: Record<string, WeeklyMenu>;
  /** UI-стан: чи розгорнуте меню в картці клієнта (не персистується) */
  isMenuExpanded: Record<string, boolean>;
  /** Режим консультації по днях (не персистується) */
  isConsulting: Record<string, Partial<Record<WeekDay, boolean>>>;
  /** Чернетка меню дня з консультації до збереження (не персистується) */
  pendingConsultMenus: Record<string, Partial<Record<WeekDay, DayMenu>>>;

  addClient: (data: Omit<Client, "id" | "createdAt">) => void;
  updateClient: (id: string, data: Partial<Omit<Client, "id" | "createdAt">>) => void;
  removeClient: (id: string) => void;

  setMenu: (clientId: string, menu: WeeklyMenu) => void;
  /** Точкове оновлення окремих днів (після AI-коригування) */
  updateMenuDays: (clientId: string, days: Partial<Record<WeekDay, DayMenu>>) => void;
  /** Зберегти меню одного дня (створює тижневе меню, якщо його ще немає) */
  saveDayMenu: (clientId: string, day: WeekDay, dayMenu: DayMenu) => void;
  /** Фіксує меню (approved: true) */
  approveMenu: (clientId: string) => void;
  clearMenu: (clientId: string) => void;
  setMenuExpanded: (clientId: string, expanded: boolean) => void;

  setConsulting: (clientId: string, day: WeekDay, active: boolean) => void;
  setPendingConsultMenu: (clientId: string, day: WeekDay, menu: DayMenu | null) => void;
  clearConsultation: (clientId: string, day: WeekDay) => void;

  /** Тренування на день: порожній текст = день відпочинку */
  setWorkout: (clientId: string, day: WeekDay, text: string) => void;
  updateWorkouts: (clientId: string, workouts: Partial<Record<WeekDay, string>>) => void;
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
      isConsulting: {},
      pendingConsultMenus: {},

      addClient: (data) =>
        set((state) => {
          const suggested = suggestNutritionNorms(
            data.goal,
            data.activityLevel ?? 1.375
          );
          const macroNormsPerKg = data.macroNormsPerKg ?? suggested.macroNormsPerKg;
          const targetFiber = data.targetFiber ?? suggested.targetFiber;
          const weight = data.weightHistory?.[data.weightHistory.length - 1]?.value ?? 0;
          const macrosFromWeight =
            weight > 0
              ? calcMacrosFromWeight(weight, macroNormsPerKg)
              : data.macros ?? { protein: 0, fat: 0, carbs: 0 };
          return {
            clients: [
              {
                ...data,
                macroNormsPerKg,
                targetFiber,
                macros: macrosFromWeight,
                weightHistory: data.weightHistory ?? [],
                weeklyWorkouts: data.weeklyWorkouts ?? {},
                id: crypto.randomUUID(),
                createdAt: Date.now(),
              },
              ...state.clients,
            ],
          };
        }),

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
        set((state) => ({
          menus: {
            ...state.menus,
            [clientId]: {
              ...menu,
              approved: false,
              days: Object.fromEntries(
                WEEK_DAYS.map((d) => {
                  const dayMenu = menu.days[d];
                  return [
                    d,
                    dayMenu
                      ? normalizeDayMenu(dayMenu)
                      : createEmptyWeeklyMenu().days[d],
                  ];
                })
              ) as Record<WeekDay, DayMenu>,
            },
          },
        })),

      updateMenuDays: (clientId, days) =>
        set((state) => {
          const current = state.menus[clientId];
          if (!current) return state;
          const normalizedDays = Object.fromEntries(
            Object.entries(days).map(([d, menu]) => [
              d,
              menu ? normalizeDayMenu(menu) : menu,
            ])
          ) as Partial<Record<WeekDay, DayMenu>>;
          return {
            menus: {
              ...state.menus,
              [clientId]: {
                ...current,
                days: { ...current.days, ...normalizedDays },
                approved: false,
              },
            },
          };
        }),

      saveDayMenu: (clientId, day, dayMenu) =>
        set((state) => {
          const current = state.menus[clientId] ?? createEmptyWeeklyMenu();
          return {
            menus: {
              ...state.menus,
              [clientId]: {
                ...current,
                days: { ...current.days, [day]: normalizeDayMenu(dayMenu) },
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

      setConsulting: (clientId, day, active) =>
        set((state) => {
          const clientDays = { ...(state.isConsulting[clientId] ?? {}) };
          if (active) {
            clientDays[day] = true;
          } else {
            delete clientDays[day];
          }
          return {
            isConsulting: { ...state.isConsulting, [clientId]: clientDays },
          };
        }),

      setPendingConsultMenu: (clientId, day, menu) =>
        set((state) => {
          const clientDays = { ...(state.pendingConsultMenus[clientId] ?? {}) };
          if (menu) {
            clientDays[day] = normalizeDayMenu(menu);
          } else {
            delete clientDays[day];
          }
          return {
            pendingConsultMenus: { ...state.pendingConsultMenus, [clientId]: clientDays },
          };
        }),

      clearConsultation: (clientId, day) =>
        set((state) => {
          const consulting = { ...(state.isConsulting[clientId] ?? {}) };
          const pending = { ...(state.pendingConsultMenus[clientId] ?? {}) };
          delete consulting[day];
          delete pending[day];
          return {
            isConsulting: { ...state.isConsulting, [clientId]: consulting },
            pendingConsultMenus: { ...state.pendingConsultMenus, [clientId]: pending },
          };
        }),

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

      updateWorkouts: (clientId, workouts) =>
        set((state) => ({
          clients: state.clients.map((c) => {
            if (c.id !== clientId) return c;
            const weeklyWorkouts = { ...c.weeklyWorkouts };
            for (const d of Object.keys(workouts) as WeekDay[]) {
              const trimmed = (workouts[d] ?? "").trim();
              if (trimmed) {
                weeklyWorkouts[d] = trimmed;
              } else {
                delete weeklyWorkouts[d];
              }
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
          isConsulting: {},
          pendingConsultMenus: {},
        })),
    }),
    {
      name: "coachmenu-pro-storage",
      storage: createJSONStorage(() => localStorage),
      version: 7,
      migrate: (persisted, version) => {
        let state = persisted as CoachStore;
        if (version < 2) {
          state = { ...state, menus: {} };
        }
        if (version < 4) {
          state = {
            ...state,
            clients: (state.clients ?? []).map(normalizeClient),
          };
        }
        if (version < 5) {
          state = {
            ...state,
            clients: (state.clients ?? []).map(normalizeClient),
          };
        }
        if (version < 6) {
          state = {
            ...state,
            clients: (state.clients ?? []).map(normalizeClient),
          };
        }
        if (version < 7) {
          const menus = state.menus ?? {};
          const migratedMenus: Record<string, WeeklyMenu> = {};
          for (const [clientId, menu] of Object.entries(menus)) {
            migratedMenus[clientId] = menu ? normalizeWeeklyMenu(menu) : menu;
          }
          state = { ...state, menus: migratedMenus };
        }
        return state;
      },
      // UI-прапорець не зберігаємо: після перезавантаження всі меню згорнуті
      partialize: (state) =>
        ({ clients: state.clients, menus: state.menus }) as CoachStore,
    }
  )
);
