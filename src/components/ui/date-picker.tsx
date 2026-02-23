"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: Date | string
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Convert string to Date if needed (using local timezone to avoid UTC date shift)
  const dateValue = React.useMemo(() => {
    if (!value) return undefined
    if (value instanceof Date) return value
    // Parse YYYY-MM-DD as local date (not UTC) to prevent off-by-one day issue
    const parts = value.split('-')
    if (parts.length === 3) {
      const parsed = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      return isNaN(parsed.getTime()) ? undefined : parsed
    }
    const parsed = new Date(value)
    return isNaN(parsed.getTime()) ? undefined : parsed
  }, [value])

  const handleSelect = (date: Date | undefined) => {
    onChange?.(date)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start ltr:text-left rtl:text-right font-normal",
            !dateValue && "text-slate-500",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 text-slate-400 shrink-0" />
          {dateValue ? format(dateValue, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 z-[100]"
        align="start"
        sideOffset={4}
        onFocusOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
