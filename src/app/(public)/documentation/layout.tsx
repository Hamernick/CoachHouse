import type { Metadata } from "next"
import type { ReactNode } from "react"

import { DocumentationShell } from "@/features/nonprofit-documentation"

export const metadata: Metadata = {
  title: {
    default: "Nonprofit documentation",
    template: "%s · Coach House Documentation",
  },
  description:
    "Stage-specific guidance for starting and operating sustainable nonprofit organizations in the United States.",
  alternates: { canonical: "/documentation" },
  openGraph: {
    title: "Coach House Nonprofit Documentation",
    description:
      "Practical guidance for nonprofit founders and operators, organized by stage.",
    type: "website",
    url: "https://coachhouse.app/documentation",
  },
}

export default function DocumentationLayout({ children }: { children: ReactNode }) {
  return <DocumentationShell>{children}</DocumentationShell>
}
