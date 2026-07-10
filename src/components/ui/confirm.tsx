"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";

export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** When true (default) the confirm button is styled red/destructive. */
  destructive?: boolean;
}

type ConfirmRequest = ConfirmOptions & { resolve: (value: boolean) => void };

// Single mounted <ConfirmDialog/> registers its state setter here so any module
// can imperatively open the dialog via confirm().
let openConfirm: ((req: ConfirmRequest | null) => void) | null = null;

/**
 * Imperatively ask the user to confirm an action (e.g. a delete).
 * Resolves true if confirmed, false if cancelled / dismissed.
 *
 *   if (!(await confirm({ description: t("Delete this item?") }))) return;
 */
export function confirm(options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!openConfirm) {
      // No dialog mounted — fail safe: do NOT perform the destructive action.
      resolve(false);
      return;
    }
    openConfirm({ ...options, resolve });
  });
}

/** Mount once near the app root so confirm() works everywhere. */
export function ConfirmDialog() {
  const { t } = useLanguage();
  const [req, setReq] = React.useState<ConfirmRequest | null>(null);

  React.useEffect(() => {
    openConfirm = setReq;
    return () => {
      openConfirm = null;
    };
  }, []);

  const finish = (value: boolean) => {
    req?.resolve(value);
    setReq(null);
  };

  return (
    <AlertDialog open={!!req} onOpenChange={(o) => { if (!o) finish(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{req?.title || t("Are you sure?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {req?.description || t("This action cannot be undone.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>
            {req?.cancelText || t("Cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => finish(true)}
            className={req?.destructive === false ? "" : "bg-red-600 hover:bg-red-700"}
          >
            {req?.confirmText || t("Delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
