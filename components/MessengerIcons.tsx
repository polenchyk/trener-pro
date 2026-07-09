/** Логотип Telegram для кнопки «Поділитися» */
export function TelegramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#229ED9" />
      <path
        d="M5.5 11.5L17 7l-2 9.5-3.5-2.5-2 2V11l-3.5-1.5z"
        fill="white"
        stroke="white"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Логотип Viber для кнопки «Поділитися» */
export function ViberIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#7360F2" />
      <path
        d="M16.2 14.1c-.3-.1-1.2-.6-1.4-.7-.2-.1-.3-.1-.5.1-.1.2-.6.7-.7.8-.1.1-.3.1-.6 0-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.5-1.5-1.8-.1-.2 0-.3.1-.5 0-.1.1-.2.2-.3.1-.1.1-.2.2-.3.1-.1.1-.2 0-.4 0-.1-.5-1.3-.7-1.7-.2-.4-.4-.3-.5-.3h-.4c-.1 0-.3 0-.5.2-.2.2-.7.7-.7 1.7 0 1 .7 2 1 2.1.1.2 1.7 2.6 4.1 3.6.6.2 1 .4 1.4.5.6.2 1.1.2 1.5.1.5-.1 1.2-.5 1.4-1 .2-.5.2-.9.1-1-.1-.1-.2-.1-.5-.2z"
        fill="white"
      />
      <path
        d="M12 5.5c-3.5 0-6.5 2.8-6.5 6.2 0 1.1.3 2.1.9 3l-.6 2.2 2.3-.6c.9.5 1.9.8 2.9.8 3.5 0 6.5-2.8 6.5-6.2S15.5 5.5 12 5.5z"
        stroke="white"
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  );
}
