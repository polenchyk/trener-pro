/**
 * Стискає зображення до квадрата maxSize×maxSize (для аватарок)
 * або до maxSize по більшій стороні (для фото страв)
 * і повертає base64 data URL.
 */
export function fileToResizedDataUrl(
  file: File,
  maxSize: number,
  options?: { square?: boolean; quality?: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas не підтримується"));
        return;
      }

      if (options?.square) {
        // Обрізаємо по центру до квадрата
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        canvas.width = maxSize;
        canvas.height = maxSize;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
      } else {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      resolve(canvas.toDataURL("image/jpeg", options?.quality ?? 0.82));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не вдалося прочитати зображення"));
    };

    img.src = url;
  });
}
