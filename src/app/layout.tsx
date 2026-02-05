import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "GRC Application",
  description: "Governance, Risk, and Compliance Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <SessionProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </SessionProvider>
        <Toaster />
        <SonnerToaster position="top-right" richColors />
      </body>
    </html>
  );
}
