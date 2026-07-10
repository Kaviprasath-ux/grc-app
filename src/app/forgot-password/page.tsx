"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, ShieldCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function requestCode() {
    if (!usernameOrEmail.trim()) {
      setError(t("Enter your username or email"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail: usernameOrEmail.trim() }),
      });
      const data = await res.json();
      setInfo(data.message || t("If an account matches, a code has been sent."));
      setStep(2);
    } catch {
      setError(t("Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setError(null);
    if (otp.trim().length !== 6) {
      setError(t("Enter the 6-digit code"));
      return;
    }
    if (newPassword.length < 8) {
      setError(t("Password must be at least 8 characters"));
      return;
    }
    if (newPassword !== confirm) {
      setError(t("Passwords do not match"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail: usernameOrEmail.trim(), otp: otp.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("Could not reset password"));
        return;
      }
      setStep(3);
    } catch {
      setError(t("Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle>{t("Reset your password")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {step === 1 && (
            <>
              <p className="text-sm text-muted-foreground">{t("We'll send a one-time code to your registered email.")}</p>
              <div className="space-y-1.5">
                <Label>{t("Username or email")}</Label>
                <Input value={usernameOrEmail} onChange={(e) => setUsernameOrEmail(e.target.value)} autoFocus />
              </div>
              <Button className="w-full" onClick={requestCode} disabled={busy}>
                {busy && <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />}
                {t("Send code")}
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              {info && <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{info}</div>}
              <div className="space-y-1.5">
                <Label>{t("6-digit code")}</Label>
                <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="••••••" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("New password")}</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Confirm password")}</Label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button className="w-full" onClick={resetPassword} disabled={busy}>
                {busy && <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />}
                {t("Reset password")}
              </Button>
            </>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-green-700">{t("Your password has been updated.")}</p>
              <Button className="w-full" onClick={() => router.push("/login")}>{t("Back to sign in")}</Button>
            </div>
          )}

          {step !== 3 && (
            <button type="button" onClick={() => router.push("/login")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> {t("Back to sign in")}
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
