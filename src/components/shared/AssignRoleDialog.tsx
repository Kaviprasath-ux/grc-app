"use client";

/**
 * AssignRoleDialog — pick a role for an existing user in a specific module.
 *
 * Used by:
 *   - The "Assign Role" action in the All Users tab (every module page)
 *   - Cross-module Add User flow when the user already exists in another module
 *
 * Filters the role dropdown to roles that:
 *   - belong to the target module (via getRolesForModule)
 *   - exclude deprecated/internal roles (Contributor, system roles)
 *
 * POSTs to /api/users/[id]/assign-module-role and surfaces RoleAssignmentError
 * codes (MODULE_NOT_SUBSCRIBED, DUPLICATE_ROLE_IN_MODULE, etc.) via toast.
 */
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getRolesForModule, type ModuleCode } from "@/lib/role-module-map";
import { getRoleDisplayName } from "@/lib/permissions";

// Roles we never offer in the picker even if they're in the module map.
//   Contributor          — hidden in Phase 4 UI (replaced by Dept variants)
//   TPRMCustomerAdmin    — removed in P7
//   CustomerAdministrator — provisioned only via super-admin onboarding;
//                          never assignable from inside a platform's user page.
const HIDDEN_ROLES = new Set<string>([
  "Contributor",
  "TPRMCustomerAdmin",
  "CustomerAdministrator",
]);

// TPRM has additional vendor-onboarded / external roles that must not be
// assignable from the TPRM user page (they are provisioned through the
// vendor onboarding flow, factory admin flow, etc.).
const TPRM_HIDDEN_ROLES = new Set<string>([
  "AccountManager",
  "TPRMSME",
  "FactoryAdmin",
  "FactoryAssessor",
]);

// Internal Audit: the legacy "Auditor" role is retired. "Auditee" remains and
// is displayed as "Auditor" (see getRoleDisplayName), so the old Auditor must
// not be assignable to avoid a duplicate "Auditor" entry in the picker.
const INTERNAL_AUDIT_HIDDEN_ROLES = new Set<string>([
  "Auditor",
]);

interface AssignRoleDialogProps {
  open: boolean;
  onClose: () => void;
  /** The user to assign a role to. */
  user: {
    id: string;
    userName?: string | null;
    fullName?: string | null;
    email?: string | null;
  };
  /** Module the role will be assigned in. */
  moduleCode: ModuleCode;
  /** Called after a successful assignment (parent should refresh its list). */
  onSuccess?: () => void;
}

function moduleLabel(code: ModuleCode): string {
  return code === "INTERNAL_AUDIT" ? "Internal Audit" : code;
}

function roleErrorMessage(code: string, fallback: string): string {
  switch (code) {
    case "MODULE_NOT_SUBSCRIBED":
      return "This module isn't subscribed for this customer.";
    case "DUPLICATE_ROLE_IN_MODULE":
      return "This user already holds a role in this module. Remove the existing role first.";
    case "ROLE_MODULE_MISMATCH":
      return "Selected role doesn't apply to this module.";
    case "ROLE_NOT_IN_MAP":
      return "Selected role is not recognised.";
    default:
      return fallback;
  }
}

export function AssignRoleDialog({
  open,
  onClose,
  user,
  moduleCode,
  onSuccess,
}: AssignRoleDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const availableRoles = useMemo(
    () =>
      getRolesForModule(moduleCode).filter((r) => {
        if (HIDDEN_ROLES.has(r)) return false;
        if (moduleCode === "TPRM" && TPRM_HIDDEN_ROLES.has(r)) return false;
        if (moduleCode === "INTERNAL_AUDIT" && INTERNAL_AUDIT_HIDDEN_ROLES.has(r)) return false;
        return true;
      }),
    [moduleCode],
  );

  const handleSubmit = async () => {
    if (!selectedRole) {
      toast({
        variant: "destructive",
        title: t("Select a role"),
        description: t("Please pick a role before assigning."),
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${user.id}/assign-module-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleCode, roleName: selectedRole }),
      });
      if (res.ok) {
        toast({
          title: t("Role assigned"),
          description: t(
            `${user.fullName || user.userName || "User"} now has ${selectedRole} in ${moduleLabel(moduleCode)}.`,
          ),
        });
        onSuccess?.();
        setSelectedRole("");
        onClose();
      } else {
        const err: { error?: string; code?: string } = await res.json().catch(() => ({}));
        toast({
          variant: "destructive",
          title: t("Role assignment blocked"),
          description: t(
            roleErrorMessage(err.code || "", err.error || "Failed to assign role"),
          ),
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: t("Error"),
        description: t("Network error — please try again."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(`Assign role in ${moduleLabel(moduleCode)}`)}</DialogTitle>
          <DialogDescription>
            {t(`Pick a role for ${user.fullName || user.userName || "this user"}.`)}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <div className="text-sm text-slate-600 space-y-1 rounded-md bg-slate-50 px-3 py-2">
            <div><span className="font-medium">{t("Name")}:</span> {user.fullName || "—"}</div>
            <div><span className="font-medium">{t("Username")}:</span> {user.userName || "—"}</div>
            {user.email && <div><span className="font-medium">{t("Email")}:</span> {user.email}</div>}
          </div>
          <div>
            <Label htmlFor="assign-role" className="text-sm font-medium">
              {t("Role")} *
            </Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="mt-1.5 w-full bg-white">
                <SelectValue placeholder={t("Select a role")} />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(getRoleDisplayName(r))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t("Cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !selectedRole}>
            {submitting ? t("Assigning…") : t("Assign role")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
