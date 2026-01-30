"use client";

import { useRouter } from "next/navigation";
import { ShieldX, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface UnauthorizedProps {
  /**
   * Custom title for the unauthorized message
   * @default "Access Denied"
   */
  title?: string;
  /**
   * Custom description explaining why access is denied
   * @default "You don't have permission to access this page."
   */
  description?: string;
  /**
   * Show back button
   * @default true
   */
  showBackButton?: boolean;
  /**
   * Show home button
   * @default true
   */
  showHomeButton?: boolean;
  /**
   * Custom action button
   */
  action?: React.ReactNode;
}

/**
 * Full-page unauthorized message.
 * Use this when a user navigates to a page they don't have permission to view.
 *
 * @example
 * ```tsx
 * // In a page component
 * const { canView, isLoading } = usePermissions('compliance.governance');
 *
 * if (isLoading) return <PageLoader />;
 * if (!canView) return <Unauthorized />;
 *
 * return <GovernancePage />;
 * ```
 */
export function Unauthorized({
  title = "Access Denied",
  description = "You don't have permission to access this page.",
  showBackButton = true,
  showHomeButton = true,
  action,
}: UnauthorizedProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <ShieldX className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="text-base">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {action}
          <div className="flex gap-3 justify-center">
            {showBackButton && (
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {showHomeButton && (
              <Button
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface UnauthorizedInlineProps {
  /**
   * Custom message
   * @default "You don't have permission to view this content."
   */
  message?: string;
}

/**
 * Inline unauthorized message for use within a page section.
 * Use this when part of a page should be hidden due to permissions.
 *
 * @example
 * ```tsx
 * <PermissionGate
 *   resource="risk.register"
 *   action="view"
 *   fallback={<UnauthorizedInline message="You cannot view risks" />}
 * >
 *   <RiskTable />
 * </PermissionGate>
 * ```
 */
export function UnauthorizedInline({
  message = "You don't have permission to view this content.",
}: UnauthorizedInlineProps) {
  return (
    <div className="flex items-center justify-center p-8 text-muted-foreground border border-dashed rounded-lg">
      <div className="flex items-center gap-2">
        <ShieldX className="h-5 w-5" />
        <span>{message}</span>
      </div>
    </div>
  );
}
