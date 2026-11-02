"use client"

// Scrolling behavior adapted from https://lab.xevrion.dev/r/overflow-tabs.json.
import { useEffect, useRef, useState } from "react"
import { useMotionTemplate, useMotionValue } from "framer-motion"
const FADE = 48
const GLIDE = 60
const NOTCH = 50

export function useOverflowTabs(reduce: boolean) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })
  const stopGlide = useRef(() => {})
  const fadeStart = useMotionValue(0)
  const fadeEnd = useMotionValue(0)
  const mask = useMotionTemplate`linear-gradient(to right, transparent, #000 ${fadeStart}px, #000 calc(100% - ${fadeEnd}px), transparent)`
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const update = () => {
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      // Clamped at both ends: overscroll on touch can report past the range.
      const before = Math.min(Math.max(el.scrollLeft, 0), max);
      const after = max - before;
      fadeStart.set(Math.min(before, FADE));
      fadeEnd.set(Math.min(after, FADE));
      // One pixel of slack, since zoomed layouts rarely land exactly on 0.
      const start = before > 1;
      const end = after > 1;
      setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
    };

    // Tracked separately from scrollLeft, which some browsers round to whole
    // pixels and would stall the last few frames of the glide.
    let target = 0;
    let position = 0;
    let frame = 0;
    let last = 0;

    const glide = (now: number) => {
      const t = 1 - Math.exp(-(now - last) / GLIDE);
      last = now;
      position += (target - position) * t;
      if (Math.abs(target - position) < 0.5) position = target;
      el.scrollLeft = position;
      frame = position === target ? 0 : requestAnimationFrame(glide);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    stopGlide.current = stop;

    // Shift + wheel and a plain vertical wheel both scroll the strip
    // sideways. A vertical wheel only does so while there's room, so the page
    // takes over again at either end.
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const vertical = !e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX);
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const precise = e.deltaMode === 0 && Math.abs(delta) < NOTCH;
      // A trackpad swiping sideways is already smooth; leave it native.
      if (precise && !vertical) return;

      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      // Picks up from wherever the strip is when nothing is gliding, so a
      // tab click or scrollbar drag in between is respected.
      if (!frame) target = position = el.scrollLeft;
      if ((delta < 0 && target <= 0) || (delta > 0 && target >= max - 1)) {
        return;
      }
      e.preventDefault();
      const px = e.deltaMode === 1 ? delta * 16 : delta;
      target = Math.min(Math.max(target + px, 0), max);

      if (precise || reduce) {
        stop();
        el.scrollLeft = position = target;
        return;
      }
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(glide);
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    el.addEventListener("scroll", update, { passive: true });
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      stop();
      observer.disconnect();
      el.removeEventListener("scroll", update);
      el.removeEventListener("wheel", wheel);
    };
  }, [fadeStart, fadeEnd, reduce]);

  function page(direction: 1 | -1) {
    const el = scrollerRef.current
    if (!el) return
    stopGlide.current()
    el.scrollBy({ left: direction * Math.max(1, el.clientWidth - FADE), behavior: reduce ? "auto" : "smooth" })
  }
  return { scrollerRef, edges, mask, stopGlide, page }
}
