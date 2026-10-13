"use client"

import { useEffect, useRef, type RefObject } from "react"

export function useOnboardingStepTransition(formRef: RefObject<HTMLFormElement | null>, step: number) {
  const previousStep = useRef(step)

  useEffect(() => {
    const direction = step >= previousStep.current ? 1 : -1
    previousStep.current = step
    const form = formRef.current
    if (!form || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    // Animate existing elements: remounting the form would discard unsaved inputs.
    const animations = Array.from(form.querySelectorAll<HTMLElement>("[data-onboarding-motion]"))
      .filter((element) => typeof element.animate === "function")
      .map((element) => element.animate([
        { opacity: 0, transform: `translateX(${direction * 8}px)` },
        { opacity: 1, transform: "translateX(0)" },
      ], { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }))

    return () => animations.forEach((animation) => animation.cancel())
  }, [formRef, step])
}
