import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ADJUST_WORKOUT_SYSTEM_PROMPT } from "@/lib/prompt";
import { WEEK_DAYS, type WeekDay } from "@/lib/types";
import { parseAdjustWorkoutResponse, serializeWorkoutsForAi } from "@/lib/workout-utils";

export const runtime = "nodejs";
export const maxDuration = 120;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AdjustWorkoutBody {
  client: {
    name: string;
    goal?: string;
    notes?: string;
    sex?: string;
    activityLevel?: number;
  };
  weeklyWorkouts?: Partial<Record<WeekDay, string>>;
  activeDay?: WeekDay;
  instruction: string;
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

  let body: AdjustWorkoutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некоректне тіло запиту." }, { status: 400 });
  }

  if (!body.client?.name || !body.instruction?.trim()) {
    return NextResponse.json(
      { error: "Потрібні дані клієнта та інструкція." },
      { status: 400 }
    );
  }

  const c = body.client;
  const instruction = body.instruction.trim();
  const history = (body.messages ?? []).slice(-6);
  const workouts = serializeWorkoutsForAi(body.weeklyWorkouts ?? {});

  const contextBlock = [
    `Клієнт: ${c.name}`,
    c.goal ? `Ціль: ${c.goal}` : "",
    c.sex ? `Стать: ${c.sex}` : "",
    c.activityLevel ? `Коефіцієнт активності: ${c.activityLevel}` : "",
    c.notes ? `Особливості: ${c.notes}` : "",
    body.activeDay ? `Зараз тренер переглядає день: ${body.activeDay}` : "",
    ``,
    `Поточний тижневий розклад тренувань (weeklyWorkouts, JSON). Порожній рядок = відпочинок:`,
    JSON.stringify(workouts),
  ]
    .filter(Boolean)
    .join("\n");

  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: ADJUST_WORKOUT_SYSTEM_PROMPT },
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
      max_tokens: 4000,
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
    const { updatedWorkouts, explanation } = parseAdjustWorkoutResponse(parsed);

    if (updatedWorkouts === null) {
      return NextResponse.json({
        updatedWorkouts: null,
        explanation:
          explanation ||
          "Не вдалося сформувати відповідь. Спробуйте переформулювати запит.",
      });
    }

    const changedDays = WEEK_DAYS.filter((d) => d in updatedWorkouts);

    if (changedDays.length === 0) {
      return NextResponse.json({
        updatedWorkouts: null,
        explanation:
          explanation ||
          "Не вдалося оновити тренування. Спробуйте конкретніше сформулювати запит.",
      });
    }

    return NextResponse.json({
      updatedWorkouts,
      explanation: explanation || "Тренування оновлено.",
      changedDays,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Невідома помилка під час звернення до OpenAI.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
