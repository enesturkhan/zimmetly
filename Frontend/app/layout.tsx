import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PendingCountProvider } from "@/components/PendingCountProvider";
import { AppNavbar } from "@/components/AppNavbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zimmetly – Evrak Zimmet Yönetimi",
  description: "Evrak zimmet ve arşiv yönetim sistemi",
  applicationName: "Zimmetly",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TooltipProvider delayDuration={300}>
          <PendingCountProvider>
            <AppNavbar />
            {children}
          </PendingCountProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
