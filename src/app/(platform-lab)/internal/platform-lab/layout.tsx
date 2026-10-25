import type { Metadata } from "next"
import type { ReactNode } from "react"
import "@fontsource-variable/geist-mono/wght.css"
import "@fontsource-variable/geist/wght.css"
import { notFound } from "next/navigation"

import "./platform-lab-theme.css"

import { platformLabEnabled } from "@/lib/feature-flags"
import { requireAdmin } from "@/lib/admin/auth"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Platform Lab",
  description: "Imported donor project dashboard for internal platform admins.",
}

export default async function PlatformLabLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  await requireAdmin()

  if (!platformLabEnabled) {
    notFound()
  }

  return (
    <div className="platform-lab-theme min-h-screen font-sans">{children}</div>
  )
}
