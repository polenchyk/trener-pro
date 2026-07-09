import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ScanResult } from "@/lib/types";

export const runtime = "nodejs";

const SCAN_SYSTEM_PROMPT = `Ти — професійний нутриціолог. Тобі надсилають фото тарілки з їжею. Твоє завдання — визначити страву та оцінити її харчову цінність.

Правила:
1. Відповідай ВИКЛЮЧНО валідним JSON без жодного тексту до чи після.
2. Оцінюй порцію так, як вона виглядає на фото (не стандартну порцію).
3. Всі назви — українською мовою.
4. Якщо на фото немає їжі, поверни: {"error": "На фото не видно їжі"}

Формат відповіді (суворо):
{
  "title": "назва страви",
  "ingredients": ["інгредієнт 1", "інгредієнт 2"],
  "calories": число,
  "protein": число,
  "fat": число,
  "carbs": число
}`;

interface ScanPlateBody {
  /** Фото у форматі data:image/jpeg;base64,... */
  image: string;
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

  let body: ScanPlateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некоректне тіло запиту." }, { status: 400 });
  }

  if (!body.image?.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "Потрібне фото у форматі base64 (data:image/...)." },
      { status: 400 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.3,
      messages: [
        { role: "system", content: SCAN_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Проаналізуй цю тарілку:" },
            { type: "image_url", image_url: { url: body.image, detail: "low" } },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "AI повернув порожню відповідь. Спробуйте ще раз." },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(raw) as ScanResult & { error?: string };
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 422 });
    }
    if (!parsed.title || typeof parsed.calories !== "number") {
      return NextResponse.json(
        { error: "AI повернув результат у неочікуваному форматі. Спробуйте ще раз." },
        { status: 502 }
      );
    }

    parsed.ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];

    return NextResponse.json({ result: parsed });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Невідома помилка під час звернення до OpenAI.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
