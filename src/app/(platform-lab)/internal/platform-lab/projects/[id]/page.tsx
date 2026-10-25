import type { Metadata } from "next"
import { PlatformLabProjectDetailsRoute } from "@/features/platform-admin-dashboard"

export const metadata: Metadata = {
  title: "Platform Project Details",
  description: "Review an internal platform project and its tasks.",
}


type PageProps = {
  params: Promise<{ id: string }>
}

export default async function PlatformLabProjectDetailsPage({ params }: PageProps) {
  const { id } = await params
  return <PlatformLabProjectDetailsRoute projectId={id} />
}
