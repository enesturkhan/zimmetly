/**
 * Tarih formatlama yardımcıları (Türkçe locale).
 */
export function formatDateTR(iso?: string): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
