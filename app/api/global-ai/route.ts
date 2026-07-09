import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GLOBAL_AI_SYSTEM_PROMPT } from "@/lib/prompt";
import {
  getTodayContext,
  parseGlobalAiResponse,
  serializeClientsForAi,
} from "@/lib/global-ai";
import type { Client } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GlobalAiBody {
  question: string;
  clients: Client[];
  history?: { role: "user" | "assistant"; content: string }[];
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

  let body: GlobalAiBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некоректне тіло запиту." }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "Потрібен текст запиту." }, { status: 400 });
  }

  const clients = body.clients ?? [];
  const { todayDate, todayWeekDay, tomorrowWeekDay } = getTodayContext();
  const clientPayload = serializeClientsForAi(clients);
  const history = (body.history ?? []).slice(-4);

  const contextBlock = [
    `Сьогодні: ${todayDate} (${todayWeekDay})`,
    `Завтра: ${tomorrowWeekDay}`,
    ``,
    `Клієнти тренера (JSON):`,
    JSON.stringify(clientPayload),
  ].join("\n");

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: GLOBAL_AI_SYSTEM_PROMPT },
    { role: "user", content: contextBlock },
  ];

  for (const msg of history) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  if (
    history.length === 0 ||
    history[history.length - 1]?.content !== question ||
    history[history.length - 1]?.role !== "user"
  ) {
    messages.push({ role: "user", content: question });
  }

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1200,
      messages,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "AI повернув порожню відповідь. Спробуйте ще раз." },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(raw);
    const { answer, actions } = parseGlobalAiResponse(parsed);

    // Валідуємо clientId проти наданого списку
    const validIds = new Set(clients.map((c) => c.id));
    const safeActions = actions.filter((a) => validIds.has(a.clientId));

    return NextResponse.json({ answer, actions: safeActions });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Невідома помилка під час звернення до OpenAI.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
