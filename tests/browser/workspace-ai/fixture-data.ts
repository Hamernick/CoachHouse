import type { RoadmapSection } from "../../../src/lib/roadmap"

export const scope = {
  userId: "00000000-0000-4000-8000-000000000010",
  organizationId: "00000000-0000-4000-8000-000000000020",
}
export const initialSection: RoadmapSection = {
  id: "mission", title: "Mission", subtitle: "Fictional local fixture", slug: "mission",
  content: "<p>We support neighborhood gardens.</p>", lastUpdated: "2026-10-22T00:00:00.000Z",
  isPublic: true, status: "complete", layout: "square", prompt: "", placeholder: "",
  homework: null, templateTitle: "Mission", templateSubtitle: "", titleIsTemplate: false, subtitleIsTemplate: false,
}

export const additionalSection:RoadmapSection={...initialSection,id:"vision",slug:"vision",title:"Vision",content:"<p>Every neighborhood has a shared garden.</p>"}
