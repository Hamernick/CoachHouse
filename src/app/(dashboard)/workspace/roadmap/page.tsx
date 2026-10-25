import type { Metadata } from "next"
import { StrategicRoadmapEditorPage } from "@/components/roadmap/strategic-roadmap-editor-page"

export const metadata: Metadata = {
  title: "Strategic Roadmap",
  description: "Build and edit the strategic roadmap for your nonprofit.",
}


export const dynamic = "force-dynamic"

export default async function WorkspaceRoadmapPage() {
  return <StrategicRoadmapEditorPage redirectTo="/workspace/roadmap" />
}
