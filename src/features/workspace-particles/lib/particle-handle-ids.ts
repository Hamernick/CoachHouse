/** Side aliases belong to the canvas, never to the persisted domain contract. */
export function particleHandleId(
  handle: string,
  side: "left" | "right" | "top" | "bottom"
) {
  if (
    (handle === "in" && side === "left") ||
    (handle !== "in" && side === "right")
  )
    return handle
  return `${handle}@${side}`
}

export function semanticParticleHandle(handle: string) {
  return handle.replace(/@(left|right|top|bottom)$/, "")
}
