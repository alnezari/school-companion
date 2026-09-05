import type { Transition } from "motion/react";

// The whole motion language: three durations, two eases, a handful of springs. Nothing animates with anything else.
export const DUR = { fast: 0.12, base: 0.22, slow: 0.32 };
export const EASE_OUT = [0.165, 0.84, 0.44, 1] as const;   // anything he triggers: enter, appear
export const EASE_MOVE = [0.645, 0.045, 0.355, 1] as const; // on-screen moves and exits
export const SPRING = {
  spatial: { type: "spring", stiffness: 300, damping: 28, mass: 1 } as Transition, // things that move: a hint of overshoot
  gentle: { type: "spring", stiffness: 200, damping: 26, mass: 1 } as Transition,  // entrances, pushed neighbours
  follow: { type: "spring", stiffness: 600, damping: 44, mass: 1 } as Transition,  // following the finger, press
  bouncy: { type: "spring", stiffness: 340, damping: 18, mass: 1 } as Transition,  // hero moments only
  effect: { type: "spring", stiffness: 300, damping: 35, mass: 1 } as Transition,  // colour and opacity: no bounce
};
export const TAP = { scale: 0.96 };
/** Staggered entrance for a list: pass the index. */
export const enter = (i = 0) => ({
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { ...SPRING.gentle, delay: i * 0.06 } as Transition,
});
