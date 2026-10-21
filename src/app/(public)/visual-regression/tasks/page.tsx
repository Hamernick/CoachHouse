import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { TaskReviewPreview } from "@/features/member-workspace/client"
import { canAccessVisualRegressionRoute } from "@/lib/visual-regression-access"

export default async function TasksPreviewPage({ searchParams }: { searchParams: Promise<{ ssr?: string }> }) {
  if (!canAccessVisualRegressionRoute(await headers())) notFound()
  return <TaskReviewPreview renderImmediately={(await searchParams).ssr === "1"} />
}
