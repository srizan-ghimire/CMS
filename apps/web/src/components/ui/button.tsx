"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // `min-h-11` (44px) up to the `sm` breakpoint, released above it. A 36px control is
      // comfortable with a cursor and fiddly with a thumb, so the touch sizing is applied where
      // touch actually happens rather than by resizing the desktop UI. `min-h` rather than `h` so
      // it layers over the base height without either winning by specificity accident.
      //
      // `sm` and `xl` are left alone: `sm` is the deliberately dense variant (still well past the
      // 24px WCAG 2.2 AA floor) and `xl` is already 48px.
      size: {
        default: "h-9 min-h-11 px-4 py-2 sm:min-h-0",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 min-h-11 rounded-md px-6 sm:min-h-0",
        // Marketing-scale CTA. Square-cornered on purpose: it sits inside the rule grid on the
        // landing page, where a rounded edge would fight the ruling.
        xl: "h-12 rounded-none px-7 text-[0.9375rem] [&_svg]:size-[1.125rem]",
        icon: "h-9 min-h-11 w-9 min-w-11 sm:min-h-0 sm:min-w-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
