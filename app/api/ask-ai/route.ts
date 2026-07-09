import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompt";
import { extractMenuDays } from "@/lib/menu-utils";
import { WEEK_DAYS, type DayMenu, type WeekDay, type WeeklyMenu } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface AskAiBody {
  client: {
    name: string;
    goal: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    weight?: number;
    notes?: string;
  };
  /** Поточне тижневе меню клієнта */
  weeklyMenu?: WeeklyMenu | null;
  menuDays?: Record<WeekDay, DayMenu> | null;
  question: string;
  /** Історія діалогу — щоб AI пам'ятав свої пропозиції (напр. пронумеровані варіанти) */
  history?: { role: "user" | "assistant"; content: string }[];
}

interface ChatAiResponse {
  answer: string;
  updatedDays: Partial<Record<WeekDay, DayMenu>>;
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

  let body: AskAiBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некоректне тіло запиту." }, { status: 400 });
  }

  if (!body.client?.name || !body.question?.trim()) {
    return NextResponse.json(
      { error: "Потрібні дані клієнта та текст запитання." },
      { status: 400 }
    );
  }

  const c = body.client;
  const menuDays = extractMenuDays(body);

  const contextPrompt = [
    `Дані клієнта:`,
    `• Ім'я: ${c.name}`,
    `• Ціль: ${c.goal}`,
    `• Добова калорійність: ${c.calories} ккал`,
    `• БЖВ: білки ${c.protein} г, жири ${c.fat} г, вуглеводи ${c.carbs} г`,
    c.weight ? `• Вага: ${c.weight} кг` : "",
    c.notes ? `• Особливості/побажання: ${c.notes}` : "",
    ``,
    menuDays
      ? `Поточне тижневе меню клієнта (JSON, меню ВЖЕ ІСНУЄ):\n${JSON.stringify({ title: body.weeklyMenu?.title ?? "Меню на тиждень", days: menuDays })}`
      : `Тижневе меню клієнта ще не згенероване.`,
  ]
    .filter(Boolean)
    .join("\n");

  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-10);

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 4000,
      messages: [
        { role: "system", content: CHAT_SYSTEM_PROMPT },
        { role: "system", content: contextPrompt },
        ...history,
        { role: "user", content: body.question.trim() },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "AI повернув порожню відповідь. Спробуйте ще раз." },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(raw) as ChatAiResponse;
    if (!parsed.answer) {
      return NextResponse.json(
        { error: "AI повернув відповідь у неочікуваному форматі. Спробуйте ще раз." },
        { status: 502 }
      );
    }

    // Пропускаємо лише валідні дні з повною структурою
    const updatedDays: Partial<Record<WeekDay, DayMenu>> = {};
    if (parsed.updatedDays && typeof parsed.updatedDays === "object") {
      for (const day of WEEK_DAYS) {
        const dayMenu = parsed.updatedDays[day];
        if (
          dayMenu &&
          Array.isArray(dayMenu.breakfast) &&
          Array.isArray(dayMenu.lunch) &&
          Array.isArray(dayMenu.dinner)
        ) {
          updatedDays[day] = dayMenu;
        }
      }
    }

    return NextResponse.json({ answer: parsed.answer, updatedDays });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Невідома помилка під час звернення до OpenAI.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
