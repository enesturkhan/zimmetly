"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export default function ZimmetPage() {
  const token = useAuthStore((state) => state.token);

  const [documentNumber, setDocumentNumber] = useState("");
  const [users, setUsers] = useState<Array<{
    id: string;
    fullName: string;
    department: string;
  }>>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Kullanıcı listesini çek
  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        setUsers(data);
      } catch {
        console.error("Kullanıcılar yüklenemedi");
      }
    }

    loadUsers();
  }, [token]);

  // Zimmetleme işlemi
  const handleZimmetle = async () => {
    setErrorMsg("");
    setMessage(null);

    if (!documentNumber.trim() || !selectedUser) {
      setErrorMsg("Lütfen evrak numarası ve kullanıcı seçin.");
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transactions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentNumber,
            toUserId: selectedUser,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "Zimmetleme başarısız.");
        return;
      }

      setMessage("Zimmet başarıyla oluşturuldu!");
      setDocumentNumber("");
      setSelectedUser("");
    } catch {
      setErrorMsg("Sunucuya bağlanılamadı.");
    }
  };

  return (
    <div className="flex justify-center p-8">
      <Card className="w-full max-w-lg shadow-md border border-neutral-200">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            Evrak Zimmetleme
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Evrak Numarası */}
          <div>
            <Label className="mb-2 block">Evrak Numarası</Label>
            <Input
              placeholder="Ör: 20131"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
            />
          </div>

          {/* Kullanıcı Seçimi */}
          <div>
            <Label className="mb-2 block">Kime Zimmetlenecek?</Label>

            <Select onValueChange={setSelectedUser} value={selectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Kullanıcı Seçin" />
              </SelectTrigger>

              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName} — {u.department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <Button className="w-full" onClick={handleZimmetle}>
            Zimmetle
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
