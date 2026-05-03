import { Suspense } from "react";
import ZimmetPageClient from "./ZimmetPageClient";

export const dynamic = "force-dynamic";

export default function ZimmetPage() {
  return (
    <Suspense fallback={<div>Yükleniyor...</div>}>
      <ZimmetPageClient />
    </Suspense>
  );
}
