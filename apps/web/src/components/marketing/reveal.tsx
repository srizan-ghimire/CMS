"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll-triggered reveal. `once` because a landing page that re-animates on every scroll-back
 * reads as a demo rather than a product.
 *
 * Everything here is decorative — content is fully legible in its resting state — so under
 * prefers-reduced-motion these render as plain elements with no animation attached at all,
 * rather than a fast animation.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "span";
}) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as];

  if (reduceMotion) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Component>
  );
}

/**
 * A horizontal rule that draws itself left-to-right as it enters view. The rules *are* the layout
 * on these pages, so animating them is animating the structure rather than decorating it.
 */
export function DrawRule({ className, delay = 0 }: { className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={cn("h-px w-full bg-border", className)} />;
  }

  return (
    <motion.div
      className={cn("h-px w-full origin-left bg-border", className)}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}
