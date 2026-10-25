import type { ReactNode } from "react"

/** Display-only previews must never run their embedded controls. */
export function InertPreview({ children }: { children?: ReactNode }) {
  return <div inert className="pointer-events-none select-none">{children}</div>
}
