import type { Metadata } from "next"
import { PlatformLabPerformancePage } from "@/features/platform-admin-dashboard"

export const metadata: Metadata = {
  title: "Platform Performance",
  description: "Review platform performance and operational activity.",
}


export default function PlatformLabPerformanceRoutePage() {
  return <PlatformLabPerformancePage />
}
