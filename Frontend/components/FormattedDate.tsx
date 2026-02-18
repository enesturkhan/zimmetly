"use client";

/**
 * Tarih formatlama - SSR/Client hydration uyumluluğu için suppressHydrationWarning.
 * Server ve client farklı timezone/locale kullandığında HTML farklı olabilir;
 * React bu farkı kabul eder.
 */
export function FormattedDate({
  iso,
  fallback = "-",
  className,
}: {
  iso?: string | null;
  fallback?: string;
  className?: string;
}) {
  const formatted =
    iso && iso.trim()
      ? new Intl.DateTimeFormat("tr-TR", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(iso))
      : fallback;

  return (
    <span suppressHydrationWarning className={className}>
      {formatted}
    </span>
  );
}
