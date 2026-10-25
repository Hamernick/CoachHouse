import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Visual Test Preview",
  description: "Internal visual regression fixtures for Coach House interface testing.",
  robots: { index: false, follow: false },
}

export default function VisualRegressionLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}
