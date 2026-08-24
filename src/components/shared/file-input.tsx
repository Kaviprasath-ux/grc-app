"use client";

import * as React from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_EXTENSIONS_LABEL,
  validateUploadedFile,
} from "@/lib/upload-validation";

/**
 * Drop-in replacement for `<input type="file">` that enforces the
 * project-wide upload allowlist (see src/lib/upload-validation.ts).
 *
 * Two ways to use it:
 *
 *   // Uncontrolled, forwarded ref:
 *   const ref = useRef<HTMLInputElement>(null);
 *   <FileInput ref={ref} multiple onFilesSelected={(files) => ...} />
 *
 *   // As a native input with onChange (drops rejected files):
 *   <FileInput multiple onChange={(e) => handle(e.target.files)} />
 *
 * The component:
 *   - Always sets `accept` to the project allowlist (props can widen
 *     narrower still via `accept`, but never override the allowlist —
 *     validation runs after the picker).
 *   - Validates each selected file against the extension allowlist.
 *   - Shows a toast with the rejected file(s) and blocks the change
 *     event from firing for rejected files.
 *
 * The SERVER remains authoritative — this is a UX early-reject, not a
 * security boundary.
 */

export interface FileInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  /**
   * Called with only the files that passed validation. Fires even if
   * some (but not all) files were rejected.
   */
  onFilesSelected?: (files: File[]) => void;
  /**
   * Same signature as native `onChange`. `event.target.files` will
   * contain only the accepted files.
   */
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  function FileInput({ onFilesSelected, onChange, accept, ...rest }, ref) {
    const { toast } = useToast();
    const { t } = useLanguage();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) {
        onChange?.(e);
        return;
      }

      const accepted: File[] = [];
      const rejected: { name: string; reason: string }[] = [];
      for (const f of files) {
        const r = validateUploadedFile(f);
        if (r.ok) {
          accepted.push(f);
        } else {
          rejected.push({ name: f.name, reason: r.reason || "Not allowed" });
        }
      }

      if (rejected.length > 0) {
        toast({
          title: t("Some files were blocked"),
          description:
            rejected.length === 1
              ? `${rejected[0].name}: ${rejected[0].reason}`
              : `${rejected.length} ${t("files rejected")}. ${t("Allowed types")}: ${ALLOWED_EXTENSIONS_LABEL}.`,
          variant: "destructive",
        });
      }

      if (accepted.length === 0) {
        // Clear the input so the user can retry with the same filename
        e.target.value = "";
        return;
      }

      // Rebuild a FileList-like list containing only accepted files
      // so downstream handlers see a consistent shape.
      const dt = new DataTransfer();
      for (const f of accepted) dt.items.add(f);
      e.target.files = dt.files;

      onFilesSelected?.(accepted);
      onChange?.(e);
    };

    return (
      <input
        {...rest}
        ref={ref}
        type="file"
        accept={accept ?? ACCEPT_ATTRIBUTE}
        onChange={handleChange}
      />
    );
  },
);
