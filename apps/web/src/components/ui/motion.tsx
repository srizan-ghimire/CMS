"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import type { Variants } from "framer-motion";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One motion vocabulary for the whole app.
 *
 * The contract every export here upholds: **animation is decorative without exception**. Each
 * element is fully legible and correctly laid out in its resting state, which is what lets the
 * reduced-motion path drop the animation entirely rather than merely shorten it — and what makes
 * the blanket `prefers-reduced-motion` reset in globals.css safe. Break that property (animate
 * something into existence, gate content on an animation completing) and both stop being true.
 */

/** The project's easing curve — a decisive start that settles rather than bouncing. */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const DURATION = {
  /** Hover, press, colour changes. Fast enough to feel like a response, not a transition. */
  feedback: 0.15,
  /** Sheets, dialogs, popovers entering. */
  surface: 0.25,
  /** Content entrances — list items, cards, sections. */
  entrance: 0.5,
  /** Structural flourishes: rules drawing themselves in. */
  structural: 0.9,
} as const;

/* --------------------------------- Reveal --------------------------------- */

/**
 * Scroll-triggered reveal. `once` because a page that re-animates on every scroll-back reads as a
 * demo rather than a product.
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
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </Component>
  );
}

/**
 * A horizontal rule that draws itself left-to-right as it enters view. The rules *are* the layout
 * on the marketing pages, so animating them is animating the structure rather than decorating it.
 */
export function DrawRule({ className, delay = 0 }: { className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={cn("bg-border h-px w-full", className)} />;
  }

  return (
    <motion.div
      className={cn("bg-border h-px w-full origin-left", className)}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: DURATION.structural, delay, ease: EASE }}
    />
  );
}

/* --------------------------------- Stagger -------------------------------- */

const containerVariants: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: { duration: DURATION.entrance, ease: EASE } },
};

/**
 * Entrance for a list or grid of results. Wrap the container in `Stagger` and each child in
 * `StaggerItem`; children cascade rather than appearing as one block, which reads as the data
 * arriving instead of the page repainting.
 *
 * Deliberately animates on mount, not on scroll — these sit above the fold after a query resolves.
 * The stagger step is small: at 45ms, twenty rows finish in under a second.
 */
export function Stagger({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul" | "section";
}) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as];

  if (reduceMotion) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Component className={className} variants={containerVariants} initial="hidden" animate="shown">
      {children}
    </Component>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as];

  if (reduceMotion) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Component className={className} variants={itemVariants}>
      {children}
    </Component>
  );
}

/* ----------------------------- AnimatedNumber ----------------------------- */

/**
 * Counts a figure up to its value. Used on stat tiles, where the movement draws the eye to what
 * changed between visits.
 *
 * Spring rather than a linear tween so the number decelerates into place instead of stopping dead,
 * and `Math.round` on the way out so it never renders a fractional count.
 */
export function AnimatedNumber({
  value,
  className,
  format,
}: {
  value: number;
  className?: string;
  /** Defaults to the browser's locale grouping. */
  format?: (value: number) => string;
}) {
  const reduceMotion = useReducedMotion();
  const render = format ?? ((n: number) => n.toLocaleString());

  const source = useMotionValue(0);
  const spring = useSpring(source, { stiffness: 90, damping: 20, restDelta: 0.5 });
  const text = useTransform(spring, (latest) => render(Math.round(latest)));

  useEffect(() => {
    source.set(value);
  }, [source, value]);

  // Not just a shorter animation: a counter is meaningless mid-flight, so reduced motion gets the
  // final figure immediately.
  if (reduceMotion) return <span className={className}>{render(value)}</span>;

  return (
    <motion.span className={className} aria-label={render(value)}>
      {text}
    </motion.span>
  );
}

/* ------------------------------- Interactions ------------------------------ */

/**
 * Press feedback for cards and tiles that behave as buttons. Scale only — no shadow or colour
 * change — so it composes with whatever the element already looks like.
 *
 * Spread onto a `motion.*` element. Returns nothing under reduced motion, so the spread is a no-op.
 */
export function usePressable(enabled = true) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion || !enabled) return {};
  return {
    whileHover: { y: -2 },
    whileTap: { scale: 0.985 },
    transition: { duration: DURATION.feedback, ease: EASE },
  } as const;
}

export { motion, useReducedMotion };
