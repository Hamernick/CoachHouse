"use client"

import type { ReactNode } from "react"

export function DocumentationTaskCards({ children }: { children: ReactNode }) {
  return (
    <div

      className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3"
    >
      {children}
    </div>
  )
}
