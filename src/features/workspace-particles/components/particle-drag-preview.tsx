"use client"

import { useLayoutEffect, useRef } from "react"
import { workspaceParticleSurfaceProps } from "./particle-surface"
import motion from "./particle-motion.module.css"

export type ParticleDragSnapshot = {
  element: HTMLElement
  width: number
  height: number
  x: number
  y: number
}

/** Carry the rendered tile, without remounting providers or copying event handlers. */
export function captureParticleDragPreview(
  tile: HTMLElement,
  handle: { left: number; top: number }
): ParticleDragSnapshot {
  const rect = tile.getBoundingClientRect()
  const element = tile.cloneNode(true) as HTMLElement
  const nodes = [element, ...element.querySelectorAll("*")]
  const ids = new Map(
    nodes
      .filter((node) => node.id)
      .map((node) => [node.id, `particle-drag-${node.id}`])
  )
  for (const node of nodes) {
    for (const attribute of Array.from(node.attributes)) {
      if (attribute.name.startsWith("data-react-grab-")) {
        node.removeAttribute(attribute.name)
      } else {
        // Preserve SVG paint references and label relationships with unique IDs.
        const value = attribute.value.replace(
          /url\(#([^)]+)\)/g,
          (match, id) => (ids.has(id) ? `url(#${ids.get(id)})` : match)
        )
        if (attribute.name === "id") {
          node.setAttribute(attribute.name, ids.get(attribute.value)!)
        } else if (
          [
            "aria-labelledby",
            "aria-describedby",
            "aria-controls",
            "for",
          ].includes(attribute.name)
        ) {
          const next = value
            .split(" ")
            .map((id) => ids.get(id) ?? id)
            .join(" ")
          if (next !== attribute.value) node.setAttribute(attribute.name, next)
        } else {
          const next =
            value.startsWith("#") && ids.has(value.slice(1))
              ? `#${ids.get(value.slice(1))}`
              : value
          if (next !== attribute.value) node.setAttribute(attribute.name, next)
        }
      }
    }
  }
  element.removeAttribute("data-particle-tile")
  element.setAttribute("inert", "")
  element.setAttribute("aria-hidden", "true")
  element.style.width = `${rect.width}px`
  element.style.height = `${rect.height}px`
  element.style.margin = "0"
  return {
    element,
    width: rect.width,
    height: rect.height,
    x: rect.left - handle.left,
    y: rect.top - handle.top,
  }
}

export function ParticleDragPreview({
  snapshot,
}: {
  snapshot: ParticleDragSnapshot
}) {
  const container = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const target = container.current
    if (!target) return
    target.replaceChildren(snapshot.element)
    return () => target.replaceChildren()
  }, [snapshot])
  return (
    <div
      ref={container}
      inert
      aria-hidden
      className={`pointer-events-none select-none ${motion.lift}`}
      style={{
        width: snapshot.width,
        height: snapshot.height,
        transform: `translate(${snapshot.x}px, ${snapshot.y}px)`,
      }}
      {...workspaceParticleSurfaceProps({
        component: "ParticleDragPreview",
        source:
          "src/features/workspace-particles/components/particle-drag-preview.tsx",
        slot: "particle-drag-preview",
      })}
    />
  )
}
