"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Eye,
  EyeOff,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// SSO error messages mapped from URL query params
const SSO_ERROR_MESSAGES: Record<string, string> = {
  UserNotRegistered:
    "Your account is not registered. Please contact your administrator.",
  NoEmail: "No email address was provided by the sign-in provider.",
  EmailNotVerified: "Your email address is not verified with the provider.",
  SSOError: "An error occurred during sign-in. Please try again.",
  OAuthAccountNotLinked:
    "This email is already associated with another sign-in method.",
  Configuration:
    "SSO provider is not configured. Please contact your administrator.",
  MissingSubscriptionId: "Payment setup incomplete. Please try signing up again.",
  InvalidSignature: "Payment verification failed. Please contact support.",
  SubscriptionNotFound: "Could not find your subscription. Please contact support.",
  ProcessingError: "An error occurred. Please try logging in or contact support.",
};

function LoginContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read callbackUrl and username from query params (from email deep-links)
  const callbackUrlParam = searchParams.get("callbackUrl");
  const usernameParam = searchParams.get("username");
  const emailParam = searchParams.get("email");
  const signupSuccess = searchParams.get("signup") === "success";
  const successMessage = searchParams.get("message");

  // Validate callbackUrl: must be relative path starting with / (prevent open-redirect)
  const safeCallbackUrl =
    callbackUrlParam &&
    callbackUrlParam.startsWith("/") &&
    !callbackUrlParam.startsWith("//")
      ? callbackUrlParam
      : "/";

  const [username, setUsername] = useState(
    usernameParam || emailParam || ""
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSsoLoading, setIsSsoLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Mandate retry state
  const [showMandateRetry, setShowMandateRetry] = useState(false);
  const [mandateRetryLoading, setMandateRetryLoading] = useState(false);
  const [mandateError, setMandateError] = useState("");

  // Read SSO/signup errors and success from URL params
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam && SSO_ERROR_MESSAGES[errorParam]) {
      setError(t(SSO_ERROR_MESSAGES[errorParam]));
    }
    if (signupSuccess && successMessage) {
      setSuccess(successMessage);
    }
  }, [searchParams, t, signupSuccess, successMessage]);

  // Try to auto-login from sessionStorage (after Razorpay redirect)
  useEffect(() => {
    const storedCreds = sessionStorage.getItem("signup_credentials");
    if (storedCreds && signupSuccess) {
      try {
        const { email, password: pwd } = JSON.parse(storedCreds);
        sessionStorage.removeItem("signup_credentials");
        setUsername(email);
        setPassword(pwd);
        // Attempt auto-login after a short delay
        setTimeout(async () => {
          setIsLoading(true);
          const result = await signIn("credentials", {
            username: email,
            password: pwd,
            redirect: false,
          });
          if (!result?.error) {
            router.push("/dashboard");
            router.refresh();
          }
          setIsLoading(false);
        }, 500);
      } catch {
        sessionStorage.removeItem("signup_credentials");
      }
    }
  }, [signupSuccess, router]);

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
    setSuccess("");

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Check if this might be a mandate pending situation
        if (username) {
          setShowMandateRetry(true);
        }
        setError(t("Invalid username or password"));
      } else {
        // Redirect to callbackUrl (from email deep-link) or root for role-based landing
        router.push(safeCallbackUrl);
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
    signIn(provider, { callbackUrl: safeCallbackUrl });
  };

  const handleMandateRetry = async () => {
    if (!username) {
      setMandateError(t("Please enter your email first"));
      return;
    }

    setMandateRetryLoading(true);
    setMandateError("");

    try {
      const res = await fetch("/api/public/signup/retry-mandate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: username }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.alreadyActive) {
          setMandateError(t("Your payment setup is already complete. Please try logging in again."));
        } else {
          setMandateError(json.error || t("Could not retrieve payment link"));
        }
        return;
      }

      // Redirect to Razorpay checkout
      if (json.data?.checkoutUrl) {
        window.location.href = json.data.checkoutUrl;
      } else {
        setMandateError(t("Payment link not available. Please contact support."));
      }
    } catch (e) {
      setMandateError((e as Error).message || t("An error occurred"));
    } finally {
      setMandateRetryLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-muted p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="flex justify-center mb-4">
            <img
              src="/logo.png"
              alt="Glimmora VerifAI"
              className="h-24 w-auto max-w-[340px] object-contain"
            />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            {t("Welcome Back !")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("Log into your account")}
          </p>
        </CardHeader>
        <CardContent>
          {/* Success Banner */}
          {success && (
            <div className="p-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md mb-4 flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md mb-4">
              {error}
            </div>
          )}

          {/* Mandate Retry Banner */}
          {showMandateRetry && (
            <div className="p-4 text-sm bg-amber-50 border border-amber-200 rounded-md mb-4">
              <div className="flex items-start gap-2 text-amber-800">
                <CreditCard className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium mb-1">
                    {t("Payment setup incomplete?")}
                  </p>
                  <p className="text-xs text-amber-700 mb-2">
                    {t(
                      "If you started signup but didn't complete the payment authorization, click below to continue."
                    )}
                  </p>
                  {mandateError && (
                    <p className="text-xs text-red-600 mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {mandateError}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleMandateRetry}
                    disabled={mandateRetryLoading}
                    className="text-amber-800 border-amber-300 hover:bg-amber-100"
                  >
                    {mandateRetryLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin ltr:mr-1 rtl:ml-1" />
                        {t("Loading...")}
                      </>
                    ) : (
                      t("Complete Payment Setup")
                    )}
                  </Button>
                </div>
              </div>
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
                  <svg
                    className="h-5 w-5 ltr:mr-2 rtl:ml-2"
                    viewBox="0 0 24 24"
                  >
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
                  <svg
                    className="h-5 w-5 ltr:mr-2 rtl:ml-2"
                    viewBox="0 0 23 23"
                  >
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
                  onCheckedChange={(checked) =>
                    setRememberMe(checked as boolean)
                  }
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

            <div className="text-center text-sm text-muted-foreground">
              {t("Don't have an account?")}{" "}
              <a
                href="/signup/v2"
                className="text-primary font-medium hover:underline"
              >
                {t("Sign Up")}
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-muted p-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardContent className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
