/**
 * Backend / network hatalarını kullanıcı dostu Türkçe mesaja çevirir.
 * Teknik mesaj console'da bırakılır, UI'da sade mesaj gösterilir.
 */
export function toUserFriendlyError(
  raw: string | undefined,
  context?: "network"
): string {
  const msg = (raw ?? "").trim();
  if (context === "network" || !msg) {
    return "Sunucuya ulaşılamadı, tekrar deneyin.";
  }
  const lower = msg.toLowerCase();
  if (
    lower.includes("forbidden") ||
    lower.includes("yetkin") ||
    lower.includes("unauthorized")
  ) {
    return "Bu işlem için yetkin yok.";
  }
  if (
    lower.includes("badrequest") ||
    lower.includes("bad request") ||
    lower.includes("şu an yapılamıyor")
  ) {
    return "Bu işlem şu an yapılamıyor.";
  }
  if (lower.includes("not found") || lower.includes("bulunamadı")) {
    return msg;
  }
  return msg;
}

/** Fetch/network hatalarında kullan (try/catch içinde). */
export function getNetworkError(): string {
  return "Sunucuya ulaşılamadı, tekrar deneyin.";
}
