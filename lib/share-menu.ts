/** Копіює текст у буфер обміну */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

function isMobile(): boolean {
  return typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent);
}

/** Відкриває Telegram з готовим текстом меню */
export function openTelegramShare(text: string): void {
  const encoded = encodeURIComponent(text);
  const webUrl = `https://t.me/share/url?url=&text=${encoded}`;
  if (isMobile()) {
    window.location.href = `tg://msg?text=${encoded}`;
    window.setTimeout(() => window.open(webUrl, "_blank", "noopener"), 600);
  } else {
    window.open(webUrl, "_blank", "noopener");
  }
}

/** Відкриває Viber з готовим текстом меню */
export function openViberShare(text: string): void {
  const encoded = encodeURIComponent(text);
  if (isMobile()) {
    window.location.href = `viber://forward?text=${encoded}`;
  } else {
    window.open(`viber://forward?text=${encoded}`);
  }
}

/** Системний діалог «Поділитися» (якщо доступний) */
export async function nativeShare(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  try {
    await navigator.share({ text });
    return true;
  } catch {
    return false;
  }
}

export type ShareTarget = "telegram" | "viber";

/** Поділитися в месенджер; якщо не вдалось — копіює в буфер */
export async function shareToMessenger(
  text: string,
  target: ShareTarget
): Promise<"opened" | "copied"> {
  if (target === "telegram") {
    openTelegramShare(text);
  } else {
    openViberShare(text);
  }
  await copyText(text);
  return "opened";
}
