import type { RoadmapSection } from "@/lib/roadmap/types"
import type {
  ParticleActivity,
  ParticleCalendarEvent,
  ParticleDriveDocument,
  ParticleImage,
  ParticleOrganization,
  ParticleProgram,
  ParticleSource,
} from "../types"

export function buildParticleSources(
  sections: RoadmapSection[],
  documents: ParticleDriveDocument[],
  images: ParticleImage[],
  organization?: ParticleOrganization,
  activities?: ParticleActivity[],
  programs?: ParticleProgram[],
  calendarEvents?: ParticleCalendarEvent[]
): ParticleSource[] {
  return [
    ...(organization
      ? [
          {
            ref: { kind: "organization", id: organization.id } as const,
            title: organization.title,
            description:
              organization.subtitle ||
              `${organization.peopleCount} people · ${organization.programsCount} programs`,
            available: true,
            canvasNodeId: "organization-overview",
            organization,
            href: "/workspace?drawer=organization",
          },
        ]
      : []),
    ...(activities
      ? [
          {
            ref: { kind: "activity", id: "workspace-activity" } as const,
            title: "Activity",
            description:
              "Calendar, Accelerator, communications, and donation activity.",
            available: true,
            canvasNodeId: "programs",
            activities,
            programs,
          },
        ]
      : []),
    ...sections.map(
      (section): ParticleSource => ({
        ref: { kind: "roadmap", id: section.id },
        title: section.title || section.templateTitle,
        description:
          section.subtitle ||
          section.templateSubtitle ||
          "A section from your roadmap.",
        available: true,
        section,
        calendarEvents:
          section.id === "board_calendar" ? calendarEvents : undefined,
      })
    ),
    ...documents.map(
      (document): ParticleSource => ({
        ref: { kind: "drive", id: document.id },
        title: document.name,
        description:
          document.status === "available"
            ? "Linked Google Drive file."
            : "This file needs access in Google Drive.",
        available: document.status === "available",
        document,
      })
    ),
    ...images.map(
      (image): ParticleSource => ({
        ref: { kind: "image", id: image.id },
        title: image.title,
        description: "An image for your workspace.",
        available: true,
        image,
      })
    ),
  ]
}

export function googleParticleUrl(
  document: ParticleDriveDocument,
  mode: "edit" | "preview" = "edit"
) {
  if (
    typeof document.fileId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,160}$/.test(document.fileId)
  )
    return null
  const native = (
    {
      "application/vnd.google-apps.document": "document",
      "application/vnd.google-apps.spreadsheet": "spreadsheets",
      "application/vnd.google-apps.presentation": "presentation",
    } as Record<string, string>
  )[document.mimeType]
  if (native)
    return `https://docs.google.com/${native}/d/${document.fileId}/${mode}`
  return `https://drive.google.com/file/d/${document.fileId}/${mode === "edit" ? "view" : "preview"}`
}

export function particleImageUrl(image: ParticleImage) {
  return `/api/workspace/particles/images?path=${encodeURIComponent(image.path)}`
}
