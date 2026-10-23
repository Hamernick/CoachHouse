import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { ProjectTimelineReviewPreview } from "@/features/member-workspace/client"
import { canAccessVisualRegressionRoute } from "@/lib/visual-regression-access"

export default async function ProjectTimelinePreviewPage() {
  if (!canAccessVisualRegressionRoute(await headers())) notFound()
  return <ProjectTimelineReviewPreview />
}
