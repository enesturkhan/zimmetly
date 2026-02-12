"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Timeline, type TimelineEvent } from "@/components/Timeline";

type TimelineModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentNumber: string;
  items: TimelineEvent[];
  loading?: boolean;
};

export function TimelineModal({
  open,
  onOpenChange,
  documentNumber,
  items,
  loading = false,
}: TimelineModalProps) {
  const router = useRouter();

  const handleGoToDetail = () => {
    onOpenChange(false);
    router.push(`/documents/${documentNumber}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[calc(100vw-1rem)] max-h-[80vh] flex flex-col gap-0 p-0 sm:max-w-2xl"
        showCloseButton={true}
      >
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0 sm:px-6 sm:pt-6">
          <DialogTitle>Evrak Geçmişi – {documentNumber}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto px-4 py-2 scroll-area-timeline sm:px-6">
          {!loading && items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Bu evrak için hareket bulunmuyor.
            </p>
          )}
          {(loading || items.length > 0) && (
            <Timeline items={items} loading={loading} className="pb-2" />
          )}
        </div>

        <DialogFooter className="px-4 py-4 border-t shrink-0 gap-2 sm:px-6 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Kapat
          </Button>
          <Button
            variant="secondary"
            onClick={handleGoToDetail}
            className="cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            Detay Sayfasına Git
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
