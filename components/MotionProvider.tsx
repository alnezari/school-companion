"use client";
import { MotionConfig } from "motion/react";
import { SPRING } from "@/lib/motion";

/** One place for the defaults: the spatial spring everywhere, and no motion when the device asks for none. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={SPRING.spatial}>{children}</MotionConfig>;
}
