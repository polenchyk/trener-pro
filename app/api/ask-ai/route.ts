import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { buildClientContextBlock } from "@/lib/coach-prompt";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompt";
import { extractMenuDays, tryNormalizeDayMenu } from "@/lib/menu-utils";
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
    age?: number;
    height?: number;
    activityLevel?: number;
    sex?: string;
    notes?: string;
    targetFiber?: number;
    macroNormsPerKg?: { protein: number; fat: number; carbs: number };
    targetMacros?: { protein: number; fat: number; carbs: number };
    weeklyWorkouts?: Partial<Record<WeekDay, string>>;
    weightHistory?: { date: string; value: number }[];
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
    buildClientContextBlock({
      name: c.name,
      goal: c.goal,
      sex: c.sex,
      age: c.age,
      height: c.height,
      weight: c.weight,
      activityLevel: c.activityLevel,
      calories: c.calories,
      macroNormsPerKg: c.macroNormsPerKg,
      targetMacros: c.targetMacros ?? { protein: c.protein, fat: c.fat, carbs: c.carbs },
      targetFiber: c.targetFiber,
      notes: c.notes,
      weeklyWorkouts: c.weeklyWorkouts,
      weightHistory: c.weightHistory,
    }),
    menuDays
      ? `\nПоточне тижневе меню клієнта (JSON):\n${JSON.stringify({ title: body.weeklyMenu?.title ?? "Меню на тиждень", days: menuDays })}`
      : `\nТижневе меню клієнта ще не згенероване.`,
  ].join("\n");

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

    const updatedDays: Partial<Record<WeekDay, DayMenu>> = {};
    if (parsed.updatedDays && typeof parsed.updatedDays === "object") {
      for (const day of WEEK_DAYS) {
        const normalized = tryNormalizeDayMenu(parsed.updatedDays[day]);
        if (normalized) {
          updatedDays[day] = normalized;
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
