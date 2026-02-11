"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "rounded-xl border bg-white p-3 shadow-sm dark:bg-slate-900 dark:border-slate-800",
        className
      )}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-4",
        month_caption:
          "flex items-center justify-center gap-2 h-10 w-full relative",
        caption_label:
          "text-sm font-semibold text-slate-800 dark:text-slate-100",
        nav: "absolute inset-x-0 flex justify-between px-2",
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex w-full",
        weekday:
          "text-slate-500 dark:text-slate-400 w-9 text-center text-xs font-medium",
        week: "flex w-full mt-1",
        day: cn(
          "relative h-9 w-9 p-0 text-center text-sm",
          "focus-within:z-20"
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 rounded-md p-0 font-normal transition-colors",
          "hover:bg-slate-100 dark:hover:bg-slate-800",
          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "dark:focus-visible:ring-offset-slate-900"
        ),
        selected:
          "bg-primary text-primary-foreground hover:bg-primary focus:bg-primary rounded-md",
        today:
          "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white font-semibold",
        outside:
          "text-slate-400 dark:text-slate-500 opacity-60",
        disabled:
          "text-slate-400 opacity-40 cursor-not-allowed",
        range_middle:
          "aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800",
        range_end: "rounded-r-md",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight
          return <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        },
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
