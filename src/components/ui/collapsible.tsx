"use client"

import * as React from "react"
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"
import { cn } from "@/lib/utils"

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  onClick,
  onFocus,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  const scrollPositionRef = React.useRef<number>(0);

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      // Store scroll position before toggle
      scrollPositionRef.current = window.scrollY;

      // Call original onClick if provided
      onClick?.(e);

      // Restore scroll position after content expands/collapses
      const restoreScroll = () => {
        window.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' });
      };

      // Restore at multiple points to handle animation
      requestAnimationFrame(restoreScroll);
      setTimeout(restoreScroll, 100);
    },
    [onClick]
  );

  const handleFocus = React.useCallback(
    (e: React.FocusEvent<HTMLButtonElement>) => {
      // Prevent focus-induced scroll by restoring position
      const scrollY = scrollPositionRef.current || window.scrollY;
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: 'instant' });
      });
      onFocus?.(e);
    },
    [onFocus]
  );

  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      onClick={handleClick}
      onFocus={handleFocus}
      {...props}
    />
  )
}

function CollapsibleContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      className={cn("overflow-hidden", className)}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
