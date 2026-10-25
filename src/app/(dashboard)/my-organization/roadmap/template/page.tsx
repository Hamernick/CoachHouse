import type { Metadata } from "next"
import { RoadmapShell } from "@/components/roadmap/roadmap-shell"
import { resolveRoadmapSections } from "@/lib/roadmap"

export const metadata: Metadata = {
  title: "Roadmap Template",
  description: "Review the strategic roadmap template for your nonprofit.",
}


export default function RoadmapTemplatePage() {
  const sections = resolveRoadmapSections({})

  return (
    <RoadmapShell
      sections={sections}
      publicSlug={null}
      canEdit={false}
      heroUrl={null}
      showHeroEditor={false}
      showProgramPreview={false}
      showHeader={false}
    />
  )
}
