"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// SSO error messages mapped from URL query params
const SSO_ERROR_MESSAGES: Record<string, string> = {
  UserNotRegistered: "Your account is not registered. Please contact your administrator.",
  NoEmail: "No email address was provided by the sign-in provider.",
  EmailNotVerified: "Your email address is not verified with the provider.",
  SSOError: "An error occurred during sign-in. Please try again.",
  OAuthAccountNotLinked: "This email is already associated with another sign-in method.",
  Configuration: "SSO provider is not configured. Please contact your administrator.",
};

function LoginContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSsoLoading, setIsSsoLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Read SSO error from URL params
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam && SSO_ERROR_MESSAGES[errorParam]) {
      setError(t(SSO_ERROR_MESSAGES[errorParam]));
    }
  }, [searchParams, t]);

  // Bootstrap superadmin user on page load
  useEffect(() => {
    const bootstrap = async () => {
      try {
        await fetch("/api/bootstrap", { method: "POST" });
      } catch (error) {
        console.error("Bootstrap failed:", error);
      }
    };
    bootstrap();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(t("Invalid username or password"));
      } else {
        // Redirect to root, which handles role-based landing page
        router.push("/");
        router.refresh();
      }
    } catch {
      setError(t("An error occurred. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSsoSignIn = (provider: "google" | "microsoft-entra-id") => {
    setIsSsoLoading(provider);
    setError("");
    signIn(provider, { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-muted p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="flex justify-center mb-4">
            <img src="/logo 3.png" alt="GRC Platform" className="h-12 w-12 object-contain" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{t("Welcome Back !")}</h1>
          <p className="text-sm text-muted-foreground">{t("Log into your account")}</p>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md mb-4">
              {error}
            </div>
          )}

          {/* SSO Buttons */}
          <div className="space-y-3 mb-6">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isSsoLoading !== null}
              onClick={() => handleSsoSignIn("google")}
            >
              {isSsoLoading === "google" ? (
                t("Redirecting...")
              ) : (
                <>
                  <svg className="h-5 w-5 ltr:mr-2 rtl:ml-2" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  {t("Sign in with Google")}
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isSsoLoading !== null}
              onClick={() => handleSsoSignIn("microsoft-entra-id")}
            >
              {isSsoLoading === "microsoft-entra-id" ? (
                t("Redirecting...")
              ) : (
                <>
                  <svg className="h-5 w-5 ltr:mr-2 rtl:ml-2" viewBox="0 0 23 23">
                    <rect x="1" y="1" width="10" height="10" fill="#f25022" />
                    <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
                    <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
                    <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
                  </svg>
                  {t("Sign in with Microsoft")}
                </>
              )}
            </Button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                {t("Or continue with")}
              </span>
            </div>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t("Username")}</Label>
              <Input
                id="username"
                type="text"
                placeholder={t("Enter your username")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("Passcode")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="**********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <Label htmlFor="remember" className="text-sm font-normal">
                  {t("Remember me")}
                </Label>
              </div>
              <button
                type="button"
                className="text-sm text-primary hover:underline"
              >
                {t("Forgot passcode?")}
              </button>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || isSsoLoading !== null}
            >
              {isLoading ? t("Logging in...") : t("Login")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-muted p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </CardContent>
        </Card>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
