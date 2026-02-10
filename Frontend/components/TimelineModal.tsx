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
        className="max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0"
        showCloseButton={true}
      >
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Evrak Geçmişi – {documentNumber}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2">
          {loading && (
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          )}
          {!loading && items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Bu evrak için hareket bulunmuyor.
            </p>
          )}
          {!loading && items.length > 0 && (
            <Timeline items={items} className="pb-2" />
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Kapat
          </Button>
          <Button
            variant="default"
            onClick={handleGoToDetail}
            className="cursor-pointer"
          >
            Detay Sayfasına Git
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
