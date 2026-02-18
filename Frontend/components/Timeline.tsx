"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FormattedDate } from "@/components/FormattedDate";

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
  if (status === "RETURNED") return "outline"; // İade kartı kendi amber stilini kullanır
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

/** Timeline artık sadece TRANSACTION kartlarından oluşur (1 zimmet = 1 kart) */
export type TimelineEvent = {
  type: "TRANSACTION";
  id?: string;
  createdAt?: string;
  status?: string;
  note?: string;
  fromUser?: { fullName?: string };
  toUser?: { fullName?: string };
  returnedAt?: string;
  returnNote?: string;
  rejectedAt?: string;
  rejectNote?: string;
};

type TimelineProps = {
  items: TimelineEvent[];
  className?: string;
  loading?: boolean;
};

function getSortDate(item: TimelineEvent): number {
  return new Date(item.createdAt ?? 0).getTime();
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

          // Timeline sadece TRANSACTION (1 zimmet = 1 kart)
          const title = `${item.fromUser?.fullName ?? "—"} → ${item.toUser?.fullName ?? "—"} zimmetledi`;
          const isReturned = item.status === "RETURNED";
          const isRejected = item.status === "REJECTED";
          const hasTwoDates = isReturned || isRejected;
          const date = item.createdAt;
          const returnedAt = item.returnedAt;
          const returnNote = item.returnNote;
          const rejectedAt = item.rejectedAt;
          const rejectNote = item.rejectNote;

          const dotClasses = cn(
            "relative z-10 shrink-0 flex items-center justify-center rounded-full border-2",
            isReturned && "border-amber-200 bg-amber-50 text-amber-600",
            isRejected && "border-red-200 bg-red-50 text-red-600",
            !isReturned && !isRejected && "border-blue-200 bg-blue-50 text-blue-600",
            isFirst ? "h-5 w-5 opacity-70" : "h-6 w-6"
          );
          const cardClasses = cn(
            itemBaseClasses,
            "border",
            isReturned && "border-amber-200 bg-amber-50/50 text-amber-900",
            isRejected && "border-red-200 bg-red-50/50 text-red-900",
            !isReturned && !isRejected && "border-blue-200 bg-blue-50/50",
            isLast && isReturned && "border-2 border-amber-300/90 bg-amber-50/70",
            isLast && isRejected && "border-2 border-red-300/90 bg-red-50/70",
            isLast && !isReturned && !isRejected && "border-2 border-blue-200/80 bg-blue-50/60"
          );
          const dateTextClass = isReturned
            ? "text-amber-700/90"
            : isRejected
              ? "text-red-700/90"
              : "text-muted-foreground";
          const titleClass = isReturned
            ? "text-amber-900"
            : isRejected
              ? "text-red-900"
              : "text-foreground";

          return (
            <li
              key={item.id ?? `tx-${idx}`}
              className="relative flex gap-3 pb-4 last:pb-0"
            >
              <div className={dotClasses}>
                <ArrowRight className={isFirst ? "h-3 w-3" : "h-3.5 w-3.5"} />
              </div>
              <div
                tabIndex={0}
                role="article"
                className={cardClasses}
              >
                <p className={cn("text-sm font-medium break-words", titleClass)}>
                  {title}
                </p>
                <div className="mt-0.5 space-y-0.5 text-xs">
                  {hasTwoDates ? (
                    <>
                      <p className={dateTextClass}>
                        Zimmet: <FormattedDate iso={date} />
                      </p>
                      {isReturned && returnedAt && (
                        <p className={dateTextClass}>
                          İade: <FormattedDate iso={returnedAt} />
                        </p>
                      )}
                      {isRejected && rejectedAt && (
                        <p className={dateTextClass}>
                          Red: <FormattedDate iso={rejectedAt} />
                        </p>
                      )}
                    </>
                  ) : (
                    <p className={dateTextClass}><FormattedDate iso={date} /></p>
                  )}
                </div>
                {item.status && (
                  <Badge
                    variant={statusVariant(item.status)}
                    className={cn(
                      "mt-1.5 text-xs",
                      isReturned &&
                        "border-amber-400/60 bg-amber-100 text-amber-800",
                      isRejected &&
                        "border-red-400/60 bg-red-100 text-red-800"
                    )}
                  >
                    {statusLabelTR(item.status)}
                  </Badge>
                )}
                {item.note && <NoteLine note={item.note} />}
                {isReturned && returnNote && <NoteLine note={returnNote} />}
                {isRejected && rejectNote && <NoteLine note={rejectNote} />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
