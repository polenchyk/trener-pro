import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { WEEKLY_MENU_SYSTEM_PROMPT } from "@/lib/prompt";
import { tryNormalizeDayMenu } from "@/lib/menu-utils";
import { WEEK_DAYS, type DayMenu, type WeeklyMenu } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface GenerateMenuBody {
  name: string;
  goal: string;
  sex?: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  notes?: string;
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

  let body: GenerateMenuBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некоректне тіло запиту." }, { status: 400 });
  }

  if (!body.name || !body.calories) {
    return NextResponse.json(
      { error: "Потрібні дані клієнта: ім'я та калорійність." },
      { status: 400 }
    );
  }

  const userPrompt = [
    `Склади меню на 7 днів тижня для клієнта:`,
    `Ім'я: ${body.name}`,
    body.sex ? `Стать: ${body.sex}` : "",
    `Ціль: ${body.goal}`,
    `Добова калорійність: ${body.calories} ккал`,
    `Білки: ${body.protein} г`,
    `Жири: ${body.fat} г`,
    `Вуглеводи: ${body.carbs} г`,
    body.notes ? `Додаткові побажання: ${body.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 8000,
      messages: [
        { role: "system", content: WEEKLY_MENU_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "AI повернув порожню відповідь. Спробуйте ще раз." },
        { status: 502 }
      );
    }

    const rawMenu = JSON.parse(raw) as WeeklyMenu;

    const days = {} as Record<(typeof WEEK_DAYS)[number], DayMenu>;
    const missingDays: string[] = [];

    for (const day of WEEK_DAYS) {
      const normalized = tryNormalizeDayMenu(rawMenu.days?.[day]);
      if (normalized) {
        days[day] = normalized;
      } else {
        missingDays.push(day);
      }
    }

    if (missingDays.length > 0) {
      return NextResponse.json(
        {
          error: `AI не заповнив усі дні тижня (бракує або некоректні: ${missingDays.join(", ")}). Спробуйте ще раз.`,
        },
        { status: 502 }
      );
    }

    const menu: WeeklyMenu = {
      title: rawMenu.title || "Меню на тиждень",
      days,
      tips: Array.isArray(rawMenu.tips) ? rawMenu.tips : [],
      weekly_justification:
        typeof rawMenu.weekly_justification === "string"
          ? rawMenu.weekly_justification.trim()
          : undefined,
      approved: false,
    };

    return NextResponse.json({ menu });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Невідома помилка під час звернення до OpenAI.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
