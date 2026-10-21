import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { canAccessVisualRegressionRoute } from "@/lib/visual-regression-access"
import { ProjectDirectoryReviewPreview } from "@/features/member-workspace/client"

export default async function ProjectDirectoryReviewPage() {
  if (!canAccessVisualRegressionRoute(await headers())) notFound()
  return <ProjectDirectoryReviewPreview />
}
