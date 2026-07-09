# Тренер Про

Мобільний веб-додаток (PWA) для тренера: облік клієнтів, генерація тижневого меню (7 днів) через AI з точковими коригуваннями, контекстний AI-чат по кожному клієнту та сканер тарілки по фото. Експорт у Viber/Telegram — весь тиждень або окремий день.

## Стек

- Next.js (App Router) + TypeScript
- Tailwind CSS 4
- Zustand (стан + збереження у localStorage)
- Lucide React (іконки)
- OpenAI API (генерація меню)

## Запуск

1. Встановіть залежності:

```bash
npm install
```

2. Створіть файл `.env.local` у корені проекту (можна скопіювати `.env.local.example`) і вставте свій ключ OpenAI:

```
OPENAI_API_KEY=sk-...
```

3. Запустіть dev-сервер:

```bash
npm run dev
```

4. Відкрийте [http://localhost:3000](http://localhost:3000) (на смартфоні — за IP комп'ютера в локальній мережі).

## Як користуватися

1. Натисніть **«Додати клієнта»** — вкажіть ім'я, ціль, калорії та БЖВ.
2. Відкрийте картку клієнта та натисніть **«Згенерувати меню»**.
3. Натисніть **«Скопіювати»** — меню з емодзі опиниться в буфері обміну, готове до вставки у Viber/Telegram.

## Де що лежить

| Файл | Призначення |
| --- | --- |
| `lib/store.ts` | Zustand store: клієнти + меню, збереження в localStorage |
| `lib/types.ts` | Типи: клієнт, меню, БЖВ |
| `lib/prompt.ts` | Системний промпт для AI (замініть на свій) |
| `lib/format-menu.ts` | Форматування меню у текст для месенджерів |
| `lib/image.ts` | Стискання фото у base64 (аватарки, сканер) |
| `app/api/generate-menu/route.ts` | API-роут — генерація меню на 7 днів |
| `app/api/adjust-menu/route.ts` | API-роут — точкові коригування днів тижня |
| `app/api/ask-ai/route.ts` | API-роут — контекстний AI-чат по клієнту |
| `app/api/scan-plate/route.ts` | API-роут — розбір тарілки по фото (gpt-4o) |
| `components/ClientCard.tsx` | Картка клієнта (аватар, редагування, чат) |
| `components/ClientForm.tsx` | Форма додавання/редагування клієнта |
| `components/ClientChat.tsx` | AI-чат у картці клієнта |
| `components/MenuGenerator.tsx` | Генерація меню, перегляд, копіювання |
| `components/WeightChart.tsx` | SVG-графік прогресу ваги |
| `components/WorkoutPlanner.tsx` | Календар тренувань на тиждень + AI-генерація |
| `components/BackupPanel.tsx` | Експорт/імпорт JSON-бекапу (вага, тренування, меню) |
| `app/api/generate-workout/route.ts` | API-роут — ШІ-план тренувань на тиждень |

## Свій системний промпт

Відкрийте `lib/prompt.ts` і замініть текст константи `SYSTEM_PROMPT`. Важливо: модель повинна повертати JSON у форматі типу `GeneratedMenu` з `lib/types.ts`.
