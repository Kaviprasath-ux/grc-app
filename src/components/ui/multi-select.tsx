"use client";

import * as React from "react";
import { ChevronDown, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select items...",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const { t, isRTL } = useLanguage();

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectedOptions = selected
    .map((value) => ({ value, label: options.find((opt) => opt.value === value)?.label || value }));

  // The label used to hardcode "risk" / "risks" because the component
  // was first built for a risk picker. That leaked into every other
  // reuse (Industry/Sector on Regulatory Intelligence Hub, process
  // pickers on Internal Audit, etc.), so it's now a noun-less
  // "N selected". Callers that want a domain-specific label can put
  // it in `placeholder` — the label falls back to that when nothing
  // is selected.
  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
      ? t("1 selected")
      : `${selected.length} ${t("selected")}`;

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 flex w-full items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 h-9"
          >
            <span className="text-muted-foreground">{triggerLabel}</span>
            <ChevronDown className="size-4 opacity-50 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-1 max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-md"
          style={{ width: "var(--radix-popover-trigger-width)" }}
          align={isRTL ? "end" : "start"}
          sideOffset={4}
        >
          {options.length === 0 ? (
            <div className="py-2 px-3 text-sm text-muted-foreground">{t("No items")}</div>
          ) : (
            options.map((option) => (
              <div
                key={option.value}
                dir={isRTL ? "rtl" : "ltr"}
                className="relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 px-2 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
                onClick={() => handleToggle(option.value)}
              >
                <Checkbox
                  checked={selected.includes(option.value)}
                  className="pointer-events-none shrink-0"
                />
                <span className="flex-1">{option.label}</span>
              </div>
            ))
          )}
        </PopoverContent>
      </Popover>

      {selectedOptions.length > 0 && (
        <div className="mt-2 flex flex-col gap-1" dir={isRTL ? "rtl" : "ltr"}>
          {selectedOptions.map((opt) => (
            <span
              key={opt.value}
              className="inline-flex items-center justify-between rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
            >
              {opt.label}
              <button
                type="button"
                onClick={() => handleToggle(opt.value)}
                className="ltr:ml-2 rtl:mr-2 rounded hover:bg-slate-200 p-0.5 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
