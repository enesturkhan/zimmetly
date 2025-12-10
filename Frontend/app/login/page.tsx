"use client";

import { useState, FormEvent, KeyboardEvent, useRef } from "react"; // FormEvent tipini import ediyoruz
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const formRef = useRef<HTMLFormElement>(null);

  const [email, setEmail] = useState<string>(""); // state tiplerini belirttik
  const [password, setPassword] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Enter tuşuna basıldığında formu submit et
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  // e: FormEvent<HTMLFormElement> ile event tipini belirttik
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); 
    
    setErrorMsg("");

    if (!email || !password) {
      setErrorMsg("Lütfen email ve şifre girin.");
      return;
    }

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
      console.log("LOGIN RESPONSE:", data);

      if (!res.ok) {
        // data.message'ın string olduğundan eminsek doğrudan kullanabiliriz.
        // Veya "||" kullanarak geriye dönüş tipini güvence altına alabiliriz.
        setErrorMsg(data.message || "Giriş başarısız."); 
        return;
      }

      const token: string | undefined = data.session?.access_token;

      if (!token) {
        setErrorMsg("Token alınamadı.");
        return;
      }

      setToken(token);

      router.push("/dashboard");
    } catch (error) {
      console.error(error);
      // Hata tipini belirterek string'e çeviriyoruz
      setErrorMsg("Sunucuya bağlanırken hata oluştu.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader>
          <CardTitle>Zimmet Sistemi Giriş</CardTitle>
        </CardHeader>
        
        <form ref={formRef} onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="ornek@example.com"
                value={email}
                // onChange eventleri React.ChangeEvent<HTMLInputElement> tipindedir
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>

            <div>
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>

            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <Button className="w-full" type="submit">
              Giriş Yap
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}