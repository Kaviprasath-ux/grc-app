"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface Action {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: Action[];
  backAction?: Action;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  backAction,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6",
        className
      )}
    >
      <div className="flex items-center gap-4">
        {backAction && (
          <Button
            variant={backAction.variant || "outline"}
            onClick={backAction.onClick}
            size="sm"
            className="gap-2"
          >
            {backAction.icon && <backAction.icon className="h-4 w-4" />}
            {backAction.label}
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-grc-text">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </div>
      {actions && actions.length > 0 && (
        <div className="flex items-center gap-2">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                variant={action.variant || "default"}
                onClick={action.onClick}
                className="gap-2"
              >
                {Icon && <Icon className="h-4 w-4" />}
                {action.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
