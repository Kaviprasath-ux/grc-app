"use client";

/**
 * UserExistsConfirmDialog — confirmation popup when the admin tries to
 * "Add User" with a username/email that already exists for this customer
 * but ONLY in other modules. Asks if they want to add this existing user
 * to the current module instead of creating a duplicate.
 *
 * After confirm, the parent typically opens AssignRoleDialog for the user.
 */
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
import { Badge } from "@/components/ui/badge";
import type { ModuleCode } from "@/lib/role-module-map";

interface UserExistsConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** The existing user that matched. */
  existingUser: {
    id: string;
    userName?: string | null;
    fullName?: string | null;
    email?: string | null;
    designation?: string | null;
    departmentName?: string | null;
  };
  /** Modules the existing user already holds roles in. */
  existingModules: ModuleCode[];
  /** Module the admin is trying to add the user to. */
  targetModule: ModuleCode;
  /** Fired when the admin confirms — parent typically opens AssignRoleDialog. */
  onConfirm: () => void;
}

function moduleLabel(code: ModuleCode): string {
  return code === "INTERNAL_AUDIT" ? "Internal Audit" : code;
}

export function UserExistsConfirmDialog({
  open,
  onClose,
  existingUser,
  existingModules,
  targetModule,
  onConfirm,
}: UserExistsConfirmDialogProps) {
  const { t } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("User already exists")}</DialogTitle>
          <DialogDescription>
            {t("A user with this username or email already exists in this organization. You can assign them to the current module instead of creating a new user.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm space-y-1.5">
            <div><span className="font-medium text-slate-700">{t("Name")}:</span> {existingUser.fullName || "—"}</div>
            <div><span className="font-medium text-slate-700">{t("Username")}:</span> {existingUser.userName || "—"}</div>
            <div><span className="font-medium text-slate-700">{t("Email")}:</span> {existingUser.email || "—"}</div>
            {existingUser.designation && (
              <div><span className="font-medium text-slate-700">{t("Designation")}:</span> {existingUser.designation}</div>
            )}
            {existingUser.departmentName && (
              <div><span className="font-medium text-slate-700">{t("Department")}:</span> {existingUser.departmentName}</div>
            )}
          </div>
          <div className="rounded-md border border-slate-200 px-3 py-2 text-sm">
            <div className="font-medium text-slate-700 mb-1.5">{t("Currently in")}:</div>
            {existingModules.length === 0 ? (
              <span className="text-slate-500 italic">{t("No active modules")}</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {existingModules.map((m) => (
                  <Badge key={m} variant="secondary">{moduleLabel(m)}</Badge>
                ))}
              </div>
            )}
          </div>
          <p className="text-sm text-slate-700">
            {t(`Assign this user to ${moduleLabel(targetModule)} module too?`)}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button onClick={onConfirm}>
            {t(`Assign to ${moduleLabel(targetModule)}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
