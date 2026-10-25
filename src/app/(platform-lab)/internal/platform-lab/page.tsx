import type { Metadata } from "next"
import { PlatformLabProjectsPage } from "@/features/platform-admin-dashboard"

export const metadata: Metadata = {
  title: "Platform Projects",
  description: "Manage internal platform projects and operations.",
}


export default function PlatformLabPage() {
  return <PlatformLabProjectsPage />
}
