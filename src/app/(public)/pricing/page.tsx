import type { Metadata } from "next"

import { PricingSurface } from "@/components/public/pricing-surface"

export const metadata: Metadata = {
  title: "Pricing",
  description: "Compare Coach House plans for your nonprofit.",
  alternates: { canonical: "/pricing" },
}

export default function PricingPage() {
  return <PricingSurface />
}
