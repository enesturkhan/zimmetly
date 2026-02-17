"use client";

import { useState, FormEvent, KeyboardEvent, useRef, useEffect } from "react";
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

  // Navbar'ı kesinlikle gizle - mount anında ve refresh sırasında
  useEffect(() => {
    // Mount anında hemen gizle
    const header = document.querySelector("header");
    if (header) {
      header.style.display = "none";
    }
    document.body.classList.add("login-page");
    
    // MutationObserver ile dinamik eklenen navbar'ı da gizle
    const observer = new MutationObserver(() => {
      const header = document.querySelector("header");
      if (header) {
        header.style.display = "none";
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Logo pulse animasyonu için keyframe ekle (sadece bir kez)
    let style = document.getElementById("login-logo-pulse-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "login-logo-pulse-style";
      style.textContent = `
        @keyframes logo-pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
      `;
      document.head.appendChild(style);
    }

    return () => {
      document.body.classList.remove("login-page");
      observer.disconnect();
      const header = document.querySelector("header");
      if (header) {
        header.style.display = "";
      }
      // Style tag'i kaldırma - diğer login instance'ları için kalabilir
    };
  }, []);

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
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10 overflow-hidden">
      {/* Logo + Zimmetly - Başlangıçta üstte, loading'de ortaya gelir */}
      <div
        className={cn(
          "flex flex-col items-center gap-4 transition-all duration-500 ease-in-out",
          isLoading
            ? "fixed inset-0 z-20 justify-center opacity-100"
            : "absolute top-10 left-1/2 -translate-x-1/2 opacity-100"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3 transition-all duration-500 ease-in-out",
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
      </div>
    </div>
  );
}
