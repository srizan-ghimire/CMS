"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * `text-base sm:text-sm` is not a typographic choice. Mobile Safari auto-zooms the viewport when a
 * focused form control has a computed font-size below 16px, and it does not zoom back out — the
 * user is left on a horizontally scrolled page after tapping a search box. Rendering at 16px up to
 * the `sm` breakpoint prevents it; blocking zoom in the viewport meta would too, but that breaks
 * pinch-to-zoom for everyone.
 *
 * `min-h-11` gives a 44px touch target on phones and releases above `sm`, matching Button.
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 min-h-11 w-full rounded-md border px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:text-sm",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Input, Textarea };
