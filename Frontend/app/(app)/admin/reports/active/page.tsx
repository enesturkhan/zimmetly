import { Suspense } from "react";
import ActiveReportsClient from "./ActiveReportsClient";

export const dynamic = "force-dynamic";

export default function ActiveReportsPage() {
  return (
    <Suspense fallback={<div className="p-6">Yükleniyor...</div>}>
      <ActiveReportsClient />
    </Suspense>
  );
}
