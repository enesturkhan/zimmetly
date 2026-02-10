"use client";

import { ArrowRight, Archive, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    };

type TimelineProps = {
  items: TimelineEvent[];
  className?: string;
};

export function Timeline({ items, className }: TimelineProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("relative", className)}>
      {/* Dikey çizgi */}
      <div
        className="absolute left-[11px] top-2 bottom-2 w-px bg-border"
        aria-hidden
      />

      <ul className="space-y-0">
        {items.map((item, idx) => {
          if (item.type === "TRANSACTION") {
            const title = `${item.fromUser?.fullName ?? "—"} → ${item.toUser?.fullName ?? "—"} zimmetledi`;
            const date = item.createdAt;
            return (
              <li key={item.id ?? `tx-${idx}`} className="relative flex gap-3 pb-4 last:pb-0">
                <div
                  className={cn(
                    "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-blue-200 bg-blue-50 text-blue-600"
                  )}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 cursor-pointer transition-colors hover:bg-muted/50">
                  <p className="text-sm font-medium text-foreground">{title}</p>
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
                  {item.note && (
                    <p className="mt-1.5 text-xs italic text-muted-foreground">
                      Not: {item.note}
                    </p>
                  )}
                </div>
              </li>
            );
          }

          if (item.type === "ARCHIVED") {
            const title = `Evrak arşivlendi (${item.archivedBy?.fullName ?? "-"})`;
            const date = item.archivedAt ?? item.createdAt;
            return (
              <li key={`archived-${item.archivedAt ?? idx}`} className="relative flex gap-3 pb-4 last:pb-0">
                <div
                  className={cn(
                    "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-50 text-amber-600"
                  )}
                >
                  <Archive className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 cursor-pointer transition-colors hover:bg-amber-100/80">
                  <p className="text-sm font-medium text-amber-900">{title}</p>
                  <p className="mt-0.5 text-xs text-amber-700/80">
                    {formatDate(date)}
                  </p>
                  {item.note && (
                    <p className="mt-1.5 text-xs italic text-amber-700/80">
                      Not: {item.note}
                    </p>
                  )}
                </div>
              </li>
            );
          }

          if (item.type === "UNARCHIVED") {
            const title = "Evrak arşivden çıkarıldı";
            const date = item.createdAt;
            return (
              <li key={`unarchived-${item.createdAt ?? idx}`} className="relative flex gap-3 pb-4 last:pb-0">
                <div
                  className={cn(
                    "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-green-200 bg-green-50 text-green-600"
                  )}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1 rounded-md border border-green-200 bg-green-50/80 px-3 py-2 cursor-pointer transition-colors hover:bg-green-100/80">
                  <p className="text-sm font-medium text-green-900">{title}</p>
                  <p className="mt-0.5 text-xs text-green-700/80">
                    {formatDate(date)}
                  </p>
                  {item.note && (
                    <p className="mt-1.5 text-xs italic text-green-700/80">
                      Not: {item.note}
                    </p>
                  )}
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
