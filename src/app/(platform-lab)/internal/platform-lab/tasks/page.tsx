import type { Metadata } from "next"
import { PlatformLabTasksPage } from "@/features/platform-admin-dashboard"

export const metadata: Metadata = {
  title: "Platform Tasks",
  description: "Manage internal platform tasks and assignments.",
}


export default function PlatformLabTasksRoutePage() {
  return <PlatformLabTasksPage />
}
