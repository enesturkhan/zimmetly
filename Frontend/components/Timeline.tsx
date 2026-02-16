"use client";

import { useMemo } from "react";
import { ArrowRight, Archive, RotateCcw, Lock, LockOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function formatDate(iso?: string) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusLabelTR(status?: string) {
  switch (status) {
    case "PENDING":
      return "Beklemede";
    case "ACCEPTED":
      return "Kabul Edildi";
    case "REJECTED":
      return "Reddedildi";
    case "RETURNED":
      return "İade";
    case "CANCELLED":
      return "İptal";
    default:
      return status ?? "-";
  }
}

function statusVariant(
  status?: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ACCEPTED") return "default";
  if (status === "PENDING") return "secondary";
  if (status === "REJECTED" || status === "CANCELLED") return "destructive";
  return "outline";
}

// Shared row styling: padding, hover, focus, mobile-friendly
const itemBaseClasses =
  "relative z-10 min-w-0 flex-1 rounded-lg px-3.5 py-2.5 sm:px-4 sm:py-3 transition-colors cursor-pointer hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0";

const SKELETON_ROWS = 4;

function NoteLine({ note }: { note: string }) {
  return (
    <p className="mt-1.5 text-sm italic text-muted-foreground">
      Not: {note}
    </p>
  );
}

const ARCHIVE_AUTH_HINT =
  "Bu işlem yalnızca arşivleyen kişi veya admin tarafından yapılabilir.";

function TimelineSkeleton() {
  return (
    <div className="relative z-0 border-l-2 border-muted pl-1" aria-hidden>
      <ul className="space-y-0">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <li
            key={i}
            className="relative flex gap-3 pb-4 last:pb-0"
          >
            <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2 rounded-lg px-3 py-2 sm:px-4 sm:py-3">
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-3 w-1/3 rounded-md" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type TimelineEvent =
  | {
      type: "TRANSACTION";
      id?: string;
      createdAt?: string;
      status?: string;
      note?: string;
      fromUser?: { fullName?: string };
      toUser?: { fullName?: string };
    }
  | {
      type: "ARCHIVED";
      archivedBy?: { fullName?: string };
      archivedAt?: string;
      createdAt?: string;
      note?: string;
    }
  | {
      type: "UNARCHIVED";
      createdAt?: string;
      note?: string;
    }
  | {
      type: "RETURN";
      createdAt?: string;
      note?: string;
      createdBy?: { fullName?: string };
    };

type TimelineProps = {
  items: TimelineEvent[];
  className?: string;
  loading?: boolean;
};

/** Event'in sıralama tarihi (ARCHIVED için archivedAt, diğerleri için createdAt) */
function getSortDate(item: TimelineEvent): number {
  const d =
    item.type === "ARCHIVED"
      ? (item.archivedAt ?? item.createdAt)
      : item.createdAt;
  return new Date(d ?? 0).getTime();
}

/** createdAt ASC - en yeni event en altta (son satır gerçek son durumla örtüşür) */
function sortByCreatedAt(items: TimelineEvent[]): TimelineEvent[] {
  return [...items].sort((a, b) => getSortDate(a) - getSortDate(b));
}

export function Timeline({ items, className, loading = false }: TimelineProps) {
  if (loading) return <TimelineSkeleton />;
  if (items.length === 0) return null;

  const sortedItems = useMemo(() => sortByCreatedAt(items), [items]);
  const lastIndex = sortedItems.length - 1;

  return (
    <div className={cn("relative z-0 border-l-2 border-muted pl-1", className)}>
      <ul className="space-y-0">
        {sortedItems.map((item, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === lastIndex;

          if (item.type === "TRANSACTION") {
            const title = `${item.fromUser?.fullName ?? "—"} → ${item.toUser?.fullName ?? "—"} zimmetledi`;
            const date = item.createdAt;
            return (
              <li
                key={item.id ?? `tx-${idx}`}
                className="relative flex gap-3 pb-4 last:pb-0"
              >
                <div
                  className={cn(
                    "relative z-10 shrink-0 flex items-center justify-center rounded-full border-2 border-blue-200 bg-blue-50 text-blue-600",
                    isFirst ? "h-5 w-5 opacity-70" : "h-6 w-6"
                  )}
                >
                  <ArrowRight className={isFirst ? "h-3 w-3" : "h-3.5 w-3.5"} />
                </div>
                <div
                  tabIndex={0}
                  role="article"
                  className={cn(
                    itemBaseClasses,
                    "border border-blue-200 bg-blue-50/50",
                    isLast && "border-2 border-blue-200/80 bg-blue-50/60"
                  )}
                >
                  <p className="text-sm font-medium text-foreground break-words">{title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(date)}
                  </p>
                  {item.status && (
                    <Badge
                      variant={statusVariant(item.status)}
                      className="mt-1.5 text-xs"
                    >
                      {statusLabelTR(item.status)}
                    </Badge>
                  )}
                  {item.note && <NoteLine note={item.note} />}
                </div>
              </li>
            );
          }

          if (item.type === "ARCHIVED") {
            const title = `Evrak arşivlendi (${item.archivedBy?.fullName ?? "-"})`;
            const date = item.archivedAt ?? item.createdAt;
            return (
              <li
                key={`archived-${item.archivedAt ?? idx}`}
                className="relative flex gap-3 pb-4 last:pb-0"
              >
                <div
                  className={cn(
                    "relative z-10 shrink-0 flex items-center justify-center rounded-full border-2 border-amber-200 bg-amber-50 text-amber-600",
                    isFirst ? "h-5 w-5 opacity-70" : "h-6 w-6"
                  )}
                  aria-hidden
                >
                  <Lock className={isFirst ? "h-3 w-3" : "h-3.5 w-3.5"} />
                </div>
                <div
                  tabIndex={0}
                  role="article"
                  className={cn(
                    itemBaseClasses,
                    "border border-amber-200 bg-amber-50/50",
                    isLast && "border-2 border-amber-300/90 bg-amber-50/70"
                  )}
                >
                  <p className="text-sm font-medium text-amber-900 break-words">{title}</p>
                  <p className="mt-0.5 text-xs text-amber-700/80">
                    {formatDate(date)}
                  </p>
                  {item.note && <NoteLine note={item.note} />}
                  <p className="mt-1.5 text-xs italic text-muted-foreground">
                    {ARCHIVE_AUTH_HINT}
                  </p>
                </div>
              </li>
            );
          }

          if (item.type === "UNARCHIVED") {
            const title = "Evrak arşivden çıkarıldı";
            const date = item.createdAt;
            return (
              <li
                key={`unarchived-${item.createdAt ?? idx}`}
                className="relative flex gap-3 pb-4 last:pb-0"
              >
                <div
                  className={cn(
                    "relative z-10 shrink-0 flex items-center justify-center rounded-full border-2 border-green-200 bg-green-50 text-green-600",
                    isFirst ? "h-5 w-5 opacity-70" : "h-6 w-6"
                  )}
                  aria-hidden
                >
                  <LockOpen className={isFirst ? "h-3 w-3" : "h-3.5 w-3.5"} />
                </div>
                <div
                  tabIndex={0}
                  role="article"
                  className={cn(
                    itemBaseClasses,
                    "border border-green-200 bg-green-50/50",
                    isLast && "border-2 border-green-300/90 bg-green-50/70"
                  )}
                >
                  <p className="text-sm font-medium text-green-900 break-words">{title}</p>
                  <p className="mt-0.5 text-xs text-green-700/80">
                    {formatDate(date)}
                  </p>
                  {item.note && <NoteLine note={item.note} />}
                  <p className="mt-1.5 text-xs italic text-muted-foreground">
                    {ARCHIVE_AUTH_HINT}
                  </p>
                </div>
              </li>
            );
          }

          if (item.type === "RETURN") {
            const title = `${item.createdBy?.fullName ?? "—"} evrağı iade etti`;
            const date = item.createdAt;
            return (
              <li
                key={`return-${item.createdAt ?? idx}`}
                className="relative flex gap-3 pb-4 last:pb-0"
              >
                <div
                  className={cn(
                    "relative z-10 shrink-0 flex items-center justify-center rounded-full border-2 border-rose-200 bg-rose-50 text-rose-600",
                    isFirst ? "h-5 w-5 opacity-70" : "h-6 w-6"
                  )}
                >
                  <RotateCcw className={isFirst ? "h-3 w-3" : "h-3.5 w-3.5"} />
                </div>
                <div
                  tabIndex={0}
                  role="article"
                  className={cn(
                    itemBaseClasses,
                    "border border-rose-200 bg-rose-50/50",
                    isLast && "border-2 border-rose-300/90 bg-rose-50/70"
                  )}
                >
                  <p className="text-sm font-medium text-rose-900 break-words">{title}</p>
                  <p className="mt-0.5 text-xs text-rose-700/80">
                    {formatDate(date)}
                  </p>
                  {item.note && <NoteLine note={item.note} />}
                </div>
              </li>
            );
          }

          return null;
        })}
      </ul>
    </div>
  );
}
