import type { Metadata } from "next"

import { PublicNotFound } from "@/components/public/public-not-found"

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "This page could not be found. Return home or explore Coach House resources.",
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return <PublicNotFound />
}
