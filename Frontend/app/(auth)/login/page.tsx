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
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const formRef = useRef<HTMLFormElement>(null);

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
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

      setToken(token, false);
      router.push("/dashboard");
    } catch (error) {
      console.error(error);
      setErrorMsg(getNetworkError());
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10 overflow-hidden">
      {/* Logo + Zimmetly - Başlangıçta üstte, loading'de ortaya gelir. Sadece Y ekseni, translateX yok. */}
      <div
        className={cn(
          "fixed left-0 right-0 flex justify-center z-20 transition-[top,transform] duration-[600ms] ease-out",
          isLoading ? "top-1/2 -translate-y-1/2" : "top-10 translate-y-0"
        )}
      >
        <div className="flex flex-col items-center gap-4 animate-[login-logo-enter_600ms_ease-out_both]">
          <div
            className={cn(
              "flex items-center gap-3",
              isLoading && "[animation:logo-pulse_2s_ease-in-out_infinite]"
            )}
          >
            <img
              src="/icon.svg"
              alt="Zimmetly"
              className="h-14 w-14 rounded-full"
            />
            <span className="font-semibold tracking-tight text-2xl text-primary">
              Zimmetly
            </span>
          </div>

        {/* Loading spinner - sadece loading state'te görünür */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
            <svg
              className="h-6 w-6 animate-spin text-primary"
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
      </div>

      {/* Login card container */}
      <div className="w-full max-w-md">
        <div
          className={cn(
            "transition-all duration-[450ms] ease-in-out",
            isLoading
              ? "-translate-y-[40px] scale-[0.95] opacity-0 pointer-events-none"
              : "translate-y-0 scale-100 opacity-100"
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
      </div>
    </div>
  );
}
