import type { Metadata } from "next"
import { AcceleratorOverviewPageContent } from "./_components/accelerator-overview-page-content"

export const metadata: Metadata = {
  title: "Accelerator",
  description: "Follow guided training to build and fund your nonprofit.",
}


export const runtime = "edge"
export const dynamic = "force-dynamic"

export default function AcceleratorOverviewPage() {
  return <AcceleratorOverviewPageContent />
}
