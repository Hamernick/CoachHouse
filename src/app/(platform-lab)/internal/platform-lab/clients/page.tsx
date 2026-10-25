import type { Metadata } from "next"
import { PlatformLabClientsPage } from "@/features/platform-admin-dashboard"

export const metadata: Metadata = {
  title: "Platform Clients",
  description: "Review organizations in the platform administration workspace.",
}


export default function PlatformLabClientsRoutePage() {
  return <PlatformLabClientsPage />
}
