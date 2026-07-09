import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { WORKOUT_SYSTEM_PROMPT } from "@/lib/prompt";
import { WEEK_DAYS, type WeekDay } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface GenerateWorkoutBody {
  name: string;
  goal: string;
  sex: string;
  activityLevel: number;
  weight?: number;
  age?: number;
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

  let body: GenerateWorkoutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некоректне тіло запиту." }, { status: 400 });
  }

  if (!body.name || !body.activityLevel) {
    return NextResponse.json(
      { error: "Потрібні дані клієнта: ім'я та рівень активності." },
      { status: 400 }
    );
  }

  const userPrompt = [
    `Склади тижневий план тренувань для клієнта:`,
    `Ім'я: ${body.name}`,
    `Стать: ${body.sex}`,
    `Ціль: ${body.goal}`,
    `Коефіцієнт активності: ${body.activityLevel}`,
    body.weight ? `Вага: ${body.weight} кг` : "",
    body.age ? `Вік: ${body.age}` : "",
    body.notes ? `Особливості: ${body.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000,
      messages: [
        { role: "system", content: WORKOUT_SYSTEM_PROMPT },
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

    const parsed = JSON.parse(raw) as { workouts?: Record<string, string> };
    if (!parsed.workouts || typeof parsed.workouts !== "object") {
      return NextResponse.json(
        { error: "AI повернув план у неочікуваному форматі. Спробуйте ще раз." },
        { status: 502 }
      );
    }

    // Лишаємо тільки валідні дні; порожні описи = відпочинок (ключ не зберігаємо)
    const workouts: Partial<Record<WeekDay, string>> = {};
    for (const day of WEEK_DAYS) {
      const text = parsed.workouts[day];
      if (typeof text === "string" && text.trim()) {
        workouts[day] = text.trim();
      }
    }

    if (Object.keys(workouts).length === 0) {
      return NextResponse.json(
        { error: "AI не запланував жодного тренування. Спробуйте ще раз." },
        { status: 502 }
      );
    }

    return NextResponse.json({ workouts });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Невідома помилка під час звернення до OpenAI.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
