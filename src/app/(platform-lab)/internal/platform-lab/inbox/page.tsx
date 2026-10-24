import type { Metadata } from "next"
import { PlatformLabInboxPage } from "@/features/platform-admin-dashboard"

export const metadata: Metadata = {
  title: "Platform Inbox",
  description: "Review internal platform messages and updates.",
}


export default function PlatformLabInboxRoutePage() {
  return <PlatformLabInboxPage />
}
