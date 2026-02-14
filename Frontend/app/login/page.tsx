"use client";

import { useState, FormEvent, KeyboardEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { toUserFriendlyError, getNetworkError } from "@/lib/errorMessages";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const formRef = useRef<HTMLFormElement>(null);

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email || !password) {
      setErrorMsg("Lütfen email ve şifre girin.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(
          toUserFriendlyError(data?.message ?? "Giriş başarısız.")
        );
        setIsLoading(false);
        return;
      }

      const token: string | undefined = data.session?.access_token;

      if (!token) {
        setErrorMsg("Token alınamadı.");
        setIsLoading(false);
        return;
      }

      setToken(token, rememberMe);
      router.push("/dashboard");
    } catch (error) {
      console.error(error);
      setErrorMsg(getNetworkError());
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10">
      {/* Üst marka alanı */}
      <header className="mb-10 flex flex-col items-center text-center">
        <h1 className="font-semibold tracking-tight text-foreground text-2xl sm:text-3xl">
          Zimmetly
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Evrak ve zimmet süreçlerini tek yerden yönetin
        </p>
      </header>

      {/* Login card – yukarı kayma animasyonu */}
      <div
        className={cn(
          "w-full max-w-md transition-all duration-[350ms] ease-in-out",
          isLoading && "-translate-y-full opacity-0 pointer-events-none"
        )}
      >
        <Card className="rounded-xl border shadow-lg p-8">
          <CardHeader className="space-y-1 p-0">
            <CardTitle className="text-xl font-semibold tracking-tight">
              Giriş
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Hesabınıza giriş yapın
            </p>
          </CardHeader>

          <form ref={formRef} onSubmit={handleSubmit} className="mt-6">
            <CardContent className="space-y-4 p-0">
              <div className="space-y-2">
                <Label htmlFor="email" className="cursor-default">
                  E-posta
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ornek@sirket.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="rounded-lg transition-colors focus-visible:ring-2 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="cursor-default">
                  Şifre
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="rounded-lg transition-colors focus-visible:ring-2 cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={setRememberMe}
                  disabled={isLoading}
                />
                <Label
                  htmlFor="remember"
                  className="text-sm font-normal cursor-pointer select-none"
                >
                  Beni Hatırla
                </Label>
              </div>

              {errorMsg && (
                <Alert variant="destructive" className="rounded-lg">
                  <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full cursor-pointer rounded-lg transition-colors hover:opacity-90"
                disabled={isLoading}
              >
                Giriş Yap
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>

      {/* Loading overlay – kart kaybolunca ortada spinner */}
      {isLoading && (
        <div
          className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background/80"
          aria-live="polite"
          aria-busy="true"
        >
          <svg
            className="h-10 w-10 animate-spin text-primary"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-sm font-medium text-muted-foreground">
            Giriş yapılıyor…
          </p>
        </div>
      )}
    </div>
  );
}
