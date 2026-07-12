import type { Client } from "./types";
import { GOAL_LABELS, latestWeight, SEX_LABELS, WEEK_DAYS } from "./types";

/**
 * Базова ідентичність універсального ШІ-коуча.
 * Використовується в consult-menu, adjust-menu та ask-ai.
 */
export const UNIVERSAL_COACH_IDENTITY = `Ти — універсальний ШІ-коуч і співрозмовник для фітнес-тренера в додатку «Тренер Про».
Твоя роль ширша за генерацію меню: ти емпатичний, розумний, адаптивний помічник, який:
- вільно спілкується на будь-які теми: тренування, техніка вправ, періодизація, ЦНС, відновлення, розбір аналізів, фізіологія, біохімія, мотивація клієнта, загальні питання;
- адаптує тон під тренера (професійно, але людяно, українською);
- спирається на знання з матеріалів Ліндовера, Гаманюка, Литвиненка та Скоромного (харчування, білок, вода, суглоби, травлення);
- ЗАВЖДИ враховує профіль поточного клієнта з контексту (вага, стать, вік, ціль, тренування, особливості, нотатки).

НЕ обмежуй себе лише питаннями про їжу. Якщо тренер питає про вправи, втому, кардіо чи аналізи — дай розгорнуту професійну відповідь.`;

export const CONTEXT_SWITCHING_RULES = `ДИНАМІЧНЕ ПЕРЕМИКАННЯ КОНТЕКСТУ (Intent Switching):

Самостійно визнач інтент повідомлення тренера:

1) РЕЖИМ «chat» — звичайна розмова (Markdown у полі explanation):
   - Будь-які НЕ-menu запити: вправи, техніка, періодизація, втома клієнта, кардіо, аналізи, фізіологія, суглоби, мотивація, загальні питання.
   - Відповідай розгорнуто (100–400 слів за потреби), структуровано (списки, підзаголовки Markdown).
   - НЕ генеруй меню, НЕ ставай нав'язливими питаннями про продукти, якщо тренер про це не просив.
   - dayMenu / updatedDays — null або порожньо.

2) РЕЖИМ «consulting» — збір даних САМЕ для складання меню:
   - Тренер хоче меню, але не вистачає даних (продукти, алергії, кількість прийомів їжі).
   - 2–4 короткі уточнюючі питання + коментар.
   - dayMenu — null.

3) РЕЖИМ «ready» / зміна меню — суворий протокол харчування:
   - Тренер просить «скласти/сформувати меню», дає список продуктів + готовність, або команду змінити граммовки/страви/перекуси.
   - Увімкни математичний протокол БЖВ (г/кг), жорстку базу продуктів, JSON-структуру меню з menu_justification.
   - Не змішуй довгу лекцію з JSON — explanation коротке підтвердження + ключові цифри БЖВ.

ПРАВИЛО: не перетворюй кожен діалог на збір продуктів. Питання «Які вправи на задню дельту?» → phase "chat", без меню.`;

/** Формує розширений профіль клієнта для контексту ШІ */
export function buildClientContextBlock(client: {
  name: string;
  goal: string;
  sex?: string;
  age?: number;
  height?: number;
  weight?: number;
  activityLevel?: number;
  calories?: number;
  macroNormsPerKg?: { protein: number; fat: number; carbs: number };
  targetMacros?: { protein: number; fat: number; carbs: number };
  targetFiber?: number;
  notes?: string;
  workoutForDay?: string;
  weeklyWorkouts?: Partial<Record<string, string>>;
  weightHistory?: { date: string; value: number }[];
  activeDay?: string;
}): string {
  const lines: string[] = [
    "═══ ПРОФІЛЬ КЛІЄНТА (тримай у пам'яті протягом діалогу) ═══",
    `Ім'я: ${client.name}`,
  ];

  if (client.sex) lines.push(`Стать: ${client.sex}`);
  if (client.age) lines.push(`Вік: ${client.age} р.`);
  if (client.height) lines.push(`Зріст: ${client.height} см`);
  if (client.weight) lines.push(`Поточна вага: ${client.weight} кг`);
  lines.push(`Ціль: ${client.goal}`);

  if (client.activityLevel) {
    lines.push(`Коефіцієнт активності: ${client.activityLevel}`);
  }
  if (client.calories) lines.push(`Орієнтир калорій: ${client.calories} ккал/день`);

  if (client.macroNormsPerKg) {
    const n = client.macroNormsPerKg;
    lines.push(
      `Норми БЖВ (г/кг): білок ${n.protein}, жири ${n.fat}, вуглеводи ${n.carbs}`
    );
  }
  if (client.targetMacros && client.weight) {
    const t = client.targetMacros;
    lines.push(
      `Цільові БЖВ на день (Вага ${client.weight} кг): Б-${t.protein}г, Ж-${t.fat}г, В-${t.carbs}г` +
        (client.targetFiber ? `, Кл-${client.targetFiber}г` : "")
    );
  }

  if (client.notes?.trim()) {
    lines.push(`Особливості / нотатки тренера: ${client.notes.trim()}`);
  }

  if (client.weightHistory && client.weightHistory.length >= 2) {
    const recent = client.weightHistory.slice(-3);
    lines.push(
      `Динаміка ваги: ${recent.map((e) => `${e.value} кг (${e.date})`).join(" → ")}`
    );
  }

  if (client.weeklyWorkouts) {
    const schedule = WEEK_DAYS.map((d) => {
      const w = client.weeklyWorkouts![d];
      return `${d}: ${w?.trim() ? w.trim() : "відпочинок"}`;
    }).join("\n  ");
    lines.push(`Тижневий розклад тренувань:\n  ${schedule}`);
  }

  if (client.activeDay) lines.push(`Зараз тренер працює з днем: ${client.activeDay}`);
  if (client.workoutForDay?.trim()) {
    lines.push(`Тренування цього дня: ${client.workoutForDay.trim()}`);
  } else if (client.activeDay) {
    lines.push("Тренування цього дня: відпочинок / не заплановано");
  }

  lines.push(
    "",
    "Підказки для персоналізації:",
    "- Вага 100+ кг → обережне кардіо, захист колін (велотренажер, плавання замість бігу).",
    "- Групи ризику для суглобів: надмірна вага, спортсмени >100 кг м'язової маси.",
    "- Враховуй notes тренера (травми, алергії, непереносимість) у кожній відповіді."
  );

  return lines.join("\n");
}

/** Будує client context з повного об'єкта Client */
export function buildClientContextFromClient(
  client: Client,
  opts?: { activeDay?: string; workoutForDay?: string }
): string {
  return buildClientContextBlock({
    name: client.name,
    goal: GOAL_LABELS[client.goal],
    sex: SEX_LABELS[client.sex],
    age: client.age > 0 ? client.age : undefined,
    height: client.height > 0 ? client.height : undefined,
    weight: latestWeight(client),
    activityLevel: client.activityLevel,
    calories: client.calories,
    macroNormsPerKg: client.macroNormsPerKg,
    targetMacros: client.macros,
    targetFiber: client.targetFiber,
    notes: client.notes,
    weeklyWorkouts: client.weeklyWorkouts,
    weightHistory: client.weightHistory,
    activeDay: opts?.activeDay,
    workoutForDay: opts?.workoutForDay,
  });
}
