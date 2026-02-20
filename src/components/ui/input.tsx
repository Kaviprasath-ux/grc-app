import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, onKeyDown, onPaste, ...props }: React.ComponentProps<"input">) {
  const handleNumericKeyDown = type === "number"
    ? (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Allow: backspace, delete, tab, escape, enter, arrows, home, end
        const allowed = ["Backspace", "Delete", "Tab", "Escape", "Enter",
          "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
        if (allowed.includes(e.key)) return;
        // Allow Ctrl/Cmd + A, C, V, X
        if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key)) return;
        // Allow digits and decimal point/minus for number fields
        if (/^[0-9.\-]$/.test(e.key)) return;
        e.preventDefault();
        onKeyDown?.(e);
      }
    : onKeyDown;

  const handleNumericPaste = type === "number"
    ? (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pasted = e.clipboardData.getData("text");
        if (!/^[0-9.\-]+$/.test(pasted)) {
          e.preventDefault();
        }
        onPaste?.(e);
      }
    : onPaste;

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      onKeyDown={handleNumericKeyDown}
      onPaste={handleNumericPaste}
      {...props}
    />
  )
}

export { Input }
