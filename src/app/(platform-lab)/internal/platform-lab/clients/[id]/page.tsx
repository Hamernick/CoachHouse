import type { Metadata } from "next"
import { PlatformLabClientDetailsRoute } from "@/features/platform-admin-dashboard"

export const metadata: Metadata = {
  title: "Platform Client Details",
  description: "Review an organization in the platform administration workspace.",
}


type PageProps = {
  params: Promise<{ id: string }>
}

export default async function PlatformLabClientDetailsPage({ params }: PageProps) {
  const { id } = await params
  return <PlatformLabClientDetailsRoute clientId={id} />
}
