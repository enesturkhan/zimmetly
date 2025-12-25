# Backend API Endpoints Dokümantasyonu

**Base URL:** `http://localhost:4000`

**Not:** Tüm endpoint'ler (login ve root hariç) `SupabaseAuthGuard` gerektirir. Bazı endpoint'ler için ek olarak `AdminGuard` gereklidir.

---

## 📋 İçindekiler

1. [Auth Endpoints](#auth-endpoints)
2. [User Endpoints](#user-endpoints)
3. [Transaction Endpoints](#transaction-endpoints)
4. [Document Endpoints](#document-endpoints)
5. [App Endpoints](#app-endpoints)

---

## 🔐 Auth Endpoints

### POST `/auth/login`
Kullanıcı girişi yapar.

**Guards:** Yok

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:** JWT token ve kullanıcı bilgileri

---

### POST `/auth/create-user`
Yeni kullanıcı oluşturur (Admin only).

**Guards:** `SupabaseAuthGuard`, `AdminGuard`

**Request Body:**
```json
{
  "email": "string",
  "password": "string",
  "fullName": "string",
  "department": "string (optional)",
  "role": "USER | ADMIN (optional, default: USER)"
}
```

**Response:** Oluşturulan kullanıcı bilgileri

---

### GET `/auth/me`
Giriş yapmış kullanıcının bilgilerini getirir.

**Guards:** `SupabaseAuthGuard`

**Response:** Mevcut kullanıcı bilgileri

---

### PATCH `/auth/update-user/:id`
Kullanıcı bilgilerini günceller (Admin only).

**Guards:** `SupabaseAuthGuard`, `AdminGuard`

**URL Parameters:**
- `id`: Kullanıcı ID'si

**Request Body:**
```json
{
  "fullName": "string (optional)",
  "department": "string (optional)",
  "role": "USER | ADMIN (optional)",
  "email": "string (optional)",
  "password": "string (optional)"
}
```

**Response:** Güncellenmiş kullanıcı bilgileri

---

## 👥 User Endpoints

### GET `/users/assignable`
Zimmet için kullanılabilir kullanıcıları listeler (giriş yapmış kullanıcı hariç, sadece aktif).

**Guards:** `SupabaseAuthGuard`

**Response:** Kullanılabilir kullanıcı listesi

---

### GET `/users`
Tüm kullanıcıları listeler (Admin only).

**Guards:** `SupabaseAuthGuard`, `AdminGuard`

**Response:** Tüm kullanıcıların listesi

---

### PATCH `/users/:id`
Kullanıcı bilgilerini günceller (Admin only).

**Guards:** `SupabaseAuthGuard`, `AdminGuard`

**URL Parameters:**
- `id`: Kullanıcı ID'si

**Request Body:**
```json
{
  "fullName": "string (optional)",
  "department": "string (optional)",
  "role": "USER | ADMIN (optional)",
  "email": "string (optional)",
  "password": "string (optional)"
}
```

**Response:** Güncellenmiş kullanıcı bilgileri

---

### DELETE `/users/:id`
Kullanıcıyı siler (soft delete - isActive: false yapar) (Admin only).

**Guards:** `SupabaseAuthGuard`, `AdminGuard`

**URL Parameters:**
- `id`: Kullanıcı ID'si

**Response:** Silme işlemi sonucu

---

### PATCH `/users/:id/status`
Kullanıcı durumunu günceller - Aktif/Pasif yapar (Admin only).

**Guards:** `SupabaseAuthGuard`, `AdminGuard`

**URL Parameters:**
- `id`: Kullanıcı ID'si

**Request Body:**
```json
{
  "isActive": true | false
}
```

**Response:** Güncellenmiş kullanıcı bilgileri

---

### PATCH `/users/:id/active`
Kullanıcı aktif/pasif durumunu toggle eder (Admin only).

**Guards:** `SupabaseAuthGuard`, `AdminGuard`

**URL Parameters:**
- `id`: Kullanıcı ID'si

**Request Body:**
```json
{
  "isActive": true | false
}
```

**Response:** Güncellenmiş kullanıcı bilgileri ve mesaj

---

## 💼 Transaction Endpoints

### POST `/transactions`
Yeni zimmet (transaction) oluşturur.

**Guards:** `SupabaseAuthGuard`

**Request Body:**
```json
{
  "documentNumber": "string",
  "toUserId": "string"
}
```

**Response:** Oluşturulan transaction bilgileri

---

### GET `/transactions/me`
Giriş yapmış kullanıcının gönderdiği ve aldığı tüm zimmetleri listeler.

**Guards:** `SupabaseAuthGuard`

**Response:** Kullanıcının transaction listesi

---

### GET `/transactions/document/:number`
Belirli bir evrak numarasına ait tüm transaction'ları listeler.

**Guards:** `SupabaseAuthGuard`

**URL Parameters:**
- `number`: Evrak numarası

**Response:** Evraka ait transaction listesi

---

### PATCH `/transactions/:id/accept`
Zimmeti kabul eder (sadece alıcı kabul edebilir).

**Guards:** `SupabaseAuthGuard`

**URL Parameters:**
- `id`: Transaction ID'si

**Kurallar:**
- Transaction status PENDING olmalı
- İşlem yapan kullanıcı `toUserId` olmalı
- Transaction status ACCEPTED olur
- Document.currentHolderId güncellenir (alıcıya geçer)

**Response:** Güncellenmiş transaction bilgileri

---

### PATCH `/transactions/:id/reject`
Zimmeti reddeder (sadece alıcı reddedebilir).

**Guards:** `SupabaseAuthGuard`

**URL Parameters:**
- `id`: Transaction ID'si

**Kurallar:**
- Transaction status PENDING olmalı
- İşlem yapan kullanıcı `toUserId` olmalı
- Transaction status REJECTED olur
- Document.currentHolderId değişmez (gönderende kalır)

**Response:** Güncellenmiş transaction bilgileri

---

### PATCH `/transactions/:id/cancel`
Zimmeti iptal eder (sadece gönderen iptal edebilir).

**Guards:** `SupabaseAuthGuard`

**URL Parameters:**
- `id`: Transaction ID'si

**Kurallar:**
- Transaction status PENDING olmalı
- İşlem yapan kullanıcı `fromUserId` olmalı
- Transaction status CANCELLED olur
- Document.currentHolderId değişmez (gönderende kalır)

**Response:** İptal mesajı ve transaction bilgileri

---

### PATCH `/transactions/:id/return`
Zimmeti iade eder (sadece alıcı iade edebilir).

**Guards:** `SupabaseAuthGuard`

**URL Parameters:**
- `id`: Transaction ID'si

**Kurallar:**
- Transaction status ACCEPTED olmalı
- İşlem yapan kullanıcı `toUserId` olmalı
- Mevcut transaction status RETURNED olur
- Yeni bir PENDING transaction oluşturulur (alıcı → gönderen)

**Response:** İade mesajı ve yeni transaction bilgileri

---

## 📄 Document Endpoints

### POST `/documents`
Yeni evrak oluşturur (manuel test için).

**Guards:** `SupabaseAuthGuard`

**Request Body:**
```json
{
  "number": "string"
}
```

**Response:** Oluşturulan evrak bilgileri

---

### GET `/documents`
Tüm evrakları listeler.

**Guards:** `SupabaseAuthGuard`

**Response:** Tüm evrakların listesi

---

### GET `/documents/:number`
Evrak numarasına göre evrak bilgilerini getirir.

**Guards:** `SupabaseAuthGuard`

**URL Parameters:**
- `number`: Evrak numarası

**Response:** Evrak bilgileri

---

## 🏠 App Endpoints

### GET `/`
Uygulama durumunu kontrol eder (health check).

**Guards:** Yok

**Response:** "Hello World!" mesajı

---

## 🔒 Guard Açıklamaları

### SupabaseAuthGuard
- Tüm korumalı endpoint'ler için gereklidir
- `Authorization: Bearer <token>` header'ı ile token gönderilmelidir
- Token Supabase'de doğrulanır ve kullanıcı Prisma'da aktif olmalıdır

### AdminGuard
- Sadece ADMIN rolündeki kullanıcılar erişebilir
- `SupabaseAuthGuard` ile birlikte kullanılır

---

## 📝 Transaction Status Enum

```
PENDING    - Beklemede
ACCEPTED   - Kabul edildi
REJECTED   - Reddedildi
RETURNED   - İade edildi
CANCELLED  - İptal edildi
```

---

## 🔄 Transaction Akışı

1. **Oluşturma:** Gönderen kullanıcı yeni transaction oluşturur → Status: `PENDING`
2. **Kabul:** Alıcı kullanıcı transaction'ı kabul eder → Status: `ACCEPTED`, `currentHolderId` güncellenir
3. **Red:** Alıcı kullanıcı transaction'ı reddeder → Status: `REJECTED`, `currentHolderId` değişmez
4. **İptal:** Gönderen kullanıcı transaction'ı iptal eder → Status: `CANCELLED`, `currentHolderId` değişmez
5. **İade:** Alıcı kullanıcı evrakı geri gönderir → Mevcut transaction: `RETURNED`, yeni transaction: `PENDING` (geri gönderen → gönderen)

---

**Son Güncelleme:** 2024
