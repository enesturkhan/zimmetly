"use client";

import { useRouter } from "next/navigation";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
      <Card className="w-full max-w-md rounded-xl border shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="h-7 w-7 text-muted-foreground" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            404 – Sayfa Bulunamadı
          </h1>

          <p className="text-sm text-muted-foreground">
            Aradığın sayfa taşınmış, silinmiş ya da hiç var olmamış olabilir.
          </p>

          <div className="mt-4 flex gap-3">
            <Button
              className="cursor-pointer"
              onClick={() => router.push("/dashboard")}
            >
              Dashboard'a Dön
            </Button>

            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => router.back()}
            >
              Geri Git
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
