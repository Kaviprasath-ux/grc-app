"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, useDayPicker } from "react-day-picker"
import { format, Locale } from "date-fns"
import { arSA } from "date-fns/locale/ar-SA"
import { lv } from "date-fns/locale/lv"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { useLanguage } from "@/contexts/LanguageContext"

const dateFnsLocaleMap: Record<string, Locale> = { ar: arSA, lv }

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function CustomMonthCaption({ calendarMonth }: { calendarMonth: { date: Date }; displayIndex: number }) {
  const { goToMonth, previousMonth, nextMonth } = useDayPicker()
  const { locale } = useLanguage()
  const dateFnsLocale = dateFnsLocaleMap[locale]

  return (
    <div className="flex items-center justify-center gap-1 h-10 w-full">
      <button
        type="button"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
      >
        <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-300" />
      </button>
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 px-1">
        {format(calendarMonth.date, "MMMM yyyy", { locale: dateFnsLocale })}
      </span>
      <button
        type="button"
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
      >
        <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-300" />
      </button>
    </div>
  )
}

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
        month_caption: "h-10 w-full",
        caption_label: "text-sm font-semibold text-slate-800 dark:text-slate-100",
        nav: "hidden",
        button_previous: "hidden",
        button_next: "hidden",
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
        MonthCaption: CustomMonthCaption,
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
