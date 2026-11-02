"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useReducedMotion,
  type AnimationPlaybackControls,
} from "motion/react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
// Kicked from rest at 1, this spring peaks near 1.15 about 70ms in, dips
// once to ~0.97 and settles. A spring (not keyframes) so a burst of changes
// keeps the bump alive instead of restarting it from zero each time.
const BUMP = { type: "spring", stiffness: 600, damping: 20 } as const;
const BUMP_VELOCITY = 6.5;
// Anything above this shows as "99+", which is all anyone reads anyway.
const CAP = 99;
// A single digit sits in a circle this wide; more digits grow a pill.
const MIN_WIDTH = 20;
const PADDING_X = 12;

type Slot = { key: string; char: string };

// Keyed by place value from the right, so only the digits that change roll
// and the ones digit stays the ones digit when a tens digit arrives. When
// capped, the two nines keep their slots and only the "+" is new.
function slots(count: number): Slot[] {
  if (count > CAP) {
    return [
      { key: "2", char: "9" },
      { key: "1", char: "9" },
      { key: "plus", char: "+" },
    ];
  }
  const digits = String(count).split("");
  return digits.map((char, i) => ({ key: String(digits.length - i), char }));
}

// Adapted from https://lab.xevrion.dev/r/badge-counter.json.
// Badge only: the existing notification Button owns focus, refs and menu events.
export function BadgeCounter({ count, className }: { count: number; className?: string }) {
  const reduceMotion = useReducedMotion();
  const bumpRef = useRef<HTMLSpanElement>(null);
  const bump = useRef<AnimationPlaybackControls>(undefined);
  const [prev, setPrev] = useState(count);
  const [direction, setDirection] = useState(1);
  if (prev !== count) {
    setDirection(count > prev ? 1 : -1);
    setPrev(count);
  }

  const lastCount = useRef(count);
  useEffect(() => {
    const was = lastCount.current;
    lastCount.current = count;
    // Appearing from zero already has its own entrance, and a capped badge
    // shows the same "99+", so neither gets a bump.
    if (was === count || was === 0 || count === 0) return;
    if (was > CAP && count > CAP) return;
    if (reduceMotion || !bumpRef.current) return;
    bump.current?.stop();
    bump.current = animate(
      bumpRef.current,
      { scale: 1 },
      { ...BUMP, velocity: BUMP_VELOCITY },
    );
  }, [count, reduceMotion]);
  useEffect(() => () => bump.current?.stop(), []);

  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {/* Keep the badge inside the header spacing as its count grows. */}
      <AnimatePresence initial={false}>
        {count > 0 && (
          <motion.span
            key="badge"
            aria-hidden
            className="pointer-events-none absolute -top-1 right-[-4px] origin-bottom-left"
            initial={{
              scale: reduceMotion ? 1 : 0.5,
              opacity: 0,
              filter: reduceMotion ? "blur(0px)" : "blur(2px)",
            }}
            animate={{
              scale: 1,
              opacity: 1,
              filter: "blur(0px)",
              transition: reduceMotion
                ? { duration: 0.15 }
                : {
                    type: "spring",
                    duration: 0.35,
                    bounce: 0.3,
                    // A spring overshoots, and blur below zero is invalid.
                    filter: { duration: 0.2, ease: EASE_OUT },
                  },
            }}
            // Clearing to zero is a soft shrink, quicker and without bounce.
            exit={{
              scale: reduceMotion ? 1 : 0.6,
              opacity: 0,
              filter: reduceMotion ? "blur(0px)" : "blur(2px)",
              transition: { duration: 0.18, ease: EASE_OUT },
            }}
          >
            <span ref={bumpRef} className="block origin-center">
              <Pill count={count} direction={direction} />
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function Pill({ count, direction }: { count: number; direction: number }) {
  const reduceMotion = useReducedMotion();
  const text = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(MIN_WIDTH);
  // New places that arrive after mount (9 to 10) roll in; the first render
  // does not.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    const node = text.current;
    if (!node) return () => cancelAnimationFrame(frame);
    // Width is animated (not scale) because the pill must grow around its
    // digits without stretching them; it is a 20px element, so the layout
    // cost is negligible. Measured, so any font size just works.
    const observer = new ResizeObserver(() => {
      setWidth(Math.max(MIN_WIDTH, Math.ceil(node.offsetWidth) + PADDING_X));
    });
    observer.observe(node);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const custom = { direction, reduceMotion };

  return (
    <span
      style={{ width }}
      className={cn(
        "flex h-5 items-center justify-center overflow-hidden rounded-full bg-destructive text-[12px] leading-5 font-semibold text-background tabular-nums ring-2 ring-background",
        "transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
      )}
    >
      <span ref={text} className="flex">
        {slots(count).map((slot) => (
          <span key={slot.key} className="inline-grid overflow-hidden">
            <AnimatePresence initial={ready} custom={custom}>
              <motion.span
                key={slot.char}
                custom={custom}
                variants={ROLL}
                initial="enter"
                animate="center"
                exit="exit"
                className="col-start-1 row-start-1"
              >
                {slot.char}
              </motion.span>
            </AnimatePresence>
          </span>
        ))}
      </span>
    </span>
  );
}

type Roll = { direction: number; reduceMotion: boolean | null };

// Counting up brings the new digit in from below and sends the old one up,
// like an odometer; counting down runs the other way.
const ROLL = {
  enter: ({ direction, reduceMotion }: Roll) => ({
    y: reduceMotion ? "0%" : `${direction * 100}%`,
    opacity: 0,
  }),
  center: {
    y: "0%",
    opacity: 1,
    transition: { duration: 0.24, ease: EASE_OUT },
  },
  // Leaves sooner than the new digit arrives, so the two never tangle.
  exit: ({ direction, reduceMotion }: Roll) => ({
    y: reduceMotion ? "0%" : `${direction * -100}%`,
    opacity: 0,
    transition: { duration: 0.18, ease: EASE_OUT },
  }),
};
