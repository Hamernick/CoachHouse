import type { Metadata } from "next"
import { StrategicRoadmapEditorPage } from "@/components/roadmap/strategic-roadmap-editor-page"

export const metadata: Metadata = {
  title: "Roadmap Section",
  description: "Edit a section of your nonprofit strategic roadmap.",
}


export const dynamic = "force-dynamic"

type WorkspaceRoadmapSectionPageProps = {
  params: Promise<{ slug: string }>
}

export default async function WorkspaceRoadmapSectionPage({
  params,
}: WorkspaceRoadmapSectionPageProps) {
  const { slug } = await params
  return (
    <StrategicRoadmapEditorPage
      redirectTo={`/workspace/roadmap/${slug}`}
      initialSectionSlug={slug}
    />
  )
}
