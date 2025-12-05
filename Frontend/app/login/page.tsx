"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const token = useAuthStore((state) => state.token);
  const setToken = useAuthStore((state) => state.setToken);

  // Eğer zaten giriş yapılmışsa dashboard'a yönlendir
  useEffect(() => {
    const stored = localStorage.getItem("access_token");
    if (stored || token) {
      router.push("/dashboard");
    }
  }, [token, router]);

  const handleLogin = async () => {
    setErrorMsg("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "Giriş başarısız");
        return;
      }

      setToken(data.session.access_token);
      router.push("/dashboard");
    } catch {
      setErrorMsg("Sunucuya bağlanılamadı");
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-neutral-100">
      <Card className="w-[380px] shadow-lg border border-neutral-300">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-semibold">
            Zimmetly Giriş
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="ornek@belediye.gov.tr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Şifre</Label>
            <Input
              type="password"
              placeholder="******"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
            />
          </div>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleLogin} className="w-full">
            Giriş Yap
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

