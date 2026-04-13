import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import GecmisimPageClient from "./GecmisimPageClient";

function GecmisimPageFallback() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
      <p className="mt-4 text-sm text-muted-foreground">Yükleniyor…</p>
    </div>
  );
}

export default function GecmisimPage() {
  return (
    <Suspense fallback={<GecmisimPageFallback />}>
      <GecmisimPageClient />
    </Suspense>
  );
}
