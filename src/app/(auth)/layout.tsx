import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/40">
      {children}
    </div>
  )
}
