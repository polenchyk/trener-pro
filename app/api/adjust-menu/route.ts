import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ADJUST_MENU_SYSTEM_PROMPT } from "@/lib/prompt";
import {
  extractMenuDays,
  formatMealKeysForContext,
  isGlobalMenuInstruction,
  parseAdjustResponse,
  suggestNextSnackKey,
} from "@/lib/menu-utils";
import { WEEK_DAYS, type WeekDay, type WeeklyMenu } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AdjustMenuBody {
  client: {
    name: string;
    goal: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    notes?: string;
  };
  weeklyMenu?: WeeklyMenu | null;
  menuDays?: Record<WeekDay, unknown>;
  days?: Record<WeekDay, unknown>;
  /** День, який зараз переглядає тренер у UI */
  activeDay?: WeekDay;
  instruction: string;
  /** Історія діалогу (до 6 останніх реплік) */
  messages?: ChatMessage[];
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY не налаштований. Додайте ключ у файл .env.local у корені проекту.",
      },
      { status: 500 }
    );
  }

  let body: AdjustMenuBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некоректне тіло запиту." }, { status: 400 });
  }

  const menuDays = extractMenuDays(body);

  if (!body.client?.name || !body.instruction?.trim()) {
    return NextResponse.json(
      { error: "Потрібні дані клієнта та інструкція." },
      { status: 400 }
    );
  }

  if (!menuDays) {
    return NextResponse.json(
      {
        error:
          "Меню порожнє або некоректне. Згенеруйте тижневе меню заново перед коригуванням.",
      },
      { status: 400 }
    );
  }

  const c = body.client;
  const instruction = body.instruction.trim();
  const globalChange = isGlobalMenuInstruction(instruction);
  const history = (body.messages ?? []).slice(-6);
  const activeDayMenu = body.activeDay ? menuDays[body.activeDay] : undefined;
  const wantsSnack = /перекус|snack/i.test(instruction);

  const contextBlock = [
    `Клієнт: ${c.name}`,
    `Ціль: ${c.goal}`,
    `Добова калорійність: ${c.calories} ккал`,
    c.notes ? `Особливості: ${c.notes}` : "",
    body.activeDay ? `Зараз тренер переглядає день: ${body.activeDay}` : "",
    activeDayMenu
      ? `Поточні прийоми їжі на ${body.activeDay}: ${formatMealKeysForContext(activeDayMenu)}`
      : "",
    activeDayMenu && wantsSnack
      ? `Наступний вільний ключ для нового перекусу: ${suggestNextSnackKey(activeDayMenu)}`
      : "",
    globalChange
      ? `Підказка: запит може стосуватися всього тижня — якщо тренер дає команду змінити, поверни updatedDays для ВСІХ 7 днів.`
      : body.activeDay
        ? `Підказка: при локальній зміні поверни updatedDays лише для дня «${body.activeDay}» з ПОВНИМ об'єктом дня (усі існуючі ключі прийомів їжі + зміни).`
        : "",
    ``,
    `Поточне тижневе меню клієнта (JSON):`,
    JSON.stringify({ title: body.weeklyMenu?.title ?? "Меню на тиждень", days: menuDays }),
  ]
    .filter(Boolean)
    .join("\n");

  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: ADJUST_MENU_SYSTEM_PROMPT },
    { role: "user", content: contextBlock },
  ];

  for (const msg of history) {
    if (msg.role === "user" || msg.role === "assistant") {
      openaiMessages.push({ role: msg.role, content: msg.content });
    }
  }

  if (
    history.length === 0 ||
    history[history.length - 1]?.content !== instruction ||
    history[history.length - 1]?.role !== "user"
  ) {
    openaiMessages.push({ role: "user", content: instruction });
  }

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: globalChange ? 8000 : 4000,
      messages: openaiMessages,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "AI повернув порожню відповідь. Спробуйте ще раз." },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(raw);
    const { updatedDays, explanation } = parseAdjustResponse(parsed);

    if (updatedDays === null) {
      return NextResponse.json({
        updatedDays: null,
        explanation:
          explanation ||
          "Не вдалося сформувати відповідь. Спробуйте переформулювати запит.",
      });
    }

    const changedCount = WEEK_DAYS.filter((d) => updatedDays[d]).length;

    if (changedCount === 0) {
      return NextResponse.json({
        updatedDays: null,
        explanation:
          explanation ||
          "Не вдалося оновити страви. Спробуйте конкретніше або оберіть варіант з попередньої відповіді.",
      });
    }

    return NextResponse.json({ updatedDays, explanation: explanation || "" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Невідома помилка під час звернення до OpenAI.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
