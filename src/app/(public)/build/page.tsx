import type { Metadata } from "next"

import { BuildPublicLanding } from "@/features/build-collect-navigation"

export const metadata: Metadata = {
  title: "Workspace for nonprofits",
  description:
    "Plan nonprofit programs, organize documents, and bring staff and board members into one Coach House workspace.",
  alternates: { canonical: "/build" },
}

export default function BuildPage() {
  return <BuildPublicLanding />
}
