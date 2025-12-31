"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  name: string;
}

interface TimelineStepsProps {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (step: number) => void;
  allowNavigation?: boolean;
}

export function TimelineSteps({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  allowNavigation = false,
}: TimelineStepsProps) {
  const handleStepClick = (stepId: number) => {
    if (!allowNavigation) return;
    // Can only navigate to completed steps or the next available step
    const maxNavigableStep = Math.max(...completedSteps, 0) + 1;
    if (stepId <= maxNavigableStep && onStepClick) {
      onStepClick(stepId);
    }
  };

  return (
    <div className="flex items-center justify-between w-full mb-8">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = currentStep === step.id;
        const isClickable = allowNavigation && step.id <= Math.max(...completedSteps, 0) + 1;

        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => handleStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors border-2",
                  isCompleted
                    ? "bg-green-500 border-green-500 text-white"
                    : isCurrent
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-muted border-muted-foreground/30 text-muted-foreground",
                  isClickable && "cursor-pointer hover:opacity-80",
                  !isClickable && "cursor-not-allowed"
                )}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : step.id}
              </button>
              <span
                className={cn(
                  "mt-2 text-xs font-medium text-center max-w-[80px]",
                  isCurrent ? "text-primary" : "text-muted-foreground"
                )}
              >
                {step.name}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2 mt-[-20px]",
                  completedSteps.includes(step.id) ? "bg-green-500" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
