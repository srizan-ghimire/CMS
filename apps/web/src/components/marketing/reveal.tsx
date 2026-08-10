/**
 * These primitives started here, then the dashboard needed the same vocabulary — so they now live
 * in components/ui/motion.tsx alongside `Stagger` and `AnimatedNumber`. This re-export keeps the
 * marketing pages' imports pointing somewhere sensible; new code should import from ui/motion.
 */
export { Reveal, DrawRule } from "@/components/ui/motion";
