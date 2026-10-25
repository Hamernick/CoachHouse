import { z } from "zod"
import { getDocumentEditorHref } from "@/lib/workspace/editor-navigation"
import { createParticle } from "./particle-registry"
import {
  getParticleDocument,
  particleFileFormat,
  type ParticleDocument,
} from "./particle-file"
import { imageFileEndpoint, readImageResponse } from "./particle-image"
import type { Particle } from "../types"

import { particleDocumentSourceSchema } from "./particle-widget-schema"
import { moduleNotesParticle } from "./particle-notes"
const MIME_FORMATS: Readonly<Record<string, ParticleDocument["format"]>> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "text/markdown": "md",
  "text/x-markdown": "md",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/csv": "csv",
}
export type ParticleDocumentSource = z.infer<
  typeof particleDocumentSourceSchema
>
export type ParticleLibraryDocument = {
  name: string
  title?: string
  mimeType: string
  size?: number
} & (
  | { fileId: string; source?: never }
  | { source: ParticleDocumentSource; fileId?: never }
)

export function createLibraryDocumentParticle(
  workspaceId: string,
  document: ParticleLibraryDocument,
  id: string,
  now: string,
  dimensions?: { width: number; height: number }
) {
  if (document.source?.kind === "workspace_note")
    throw new Error("Place the existing Notes Particle.")
  if (document.source?.kind === "module_note")
    return moduleNotesParticle({
      workspaceId,
      id,
      now,
      moduleId: document.source.moduleId,
      title: document.title ?? document.name,
    })
  const particle = createParticle("activity", {
    workspaceId,
    title: (document.title ?? document.name).slice(0, 240),
    id,
    now,
  })
  if (particle.type !== "activity")
    throw new Error("Invalid file Particle type.")
  const image = document.mimeType.startsWith("image/")
  if (image && dimensions && dimensions.width * dimensions.height > 40_000_000)
    throw new Error("Choose an image smaller than 40 megapixels.")
  const widget =
    image && document.fileId && dimensions
      ? {
          kind: "image" as const,
          fileId: document.fileId,
          ...dimensions,
          alt: "",
        }
      : {
          kind: "document" as const,
          ...(document.fileId
            ? { fileId: document.fileId }
            : { source: document.source }),
          format:
            (document.source?.kind === "drive" || document.source?.kind === "roadmap_drive")
              ? ("link" as const)
              : document.source?.kind === "roadmap"
                ? ("roadmap" as const)
                : image
                  ? ("image" as const)
                  : (particleFileFormat(document.name) ??
                    MIME_FORMATS[document.mimeType] ??
                    "link"),
          name: document.name,
          size: document.size,
        }
  return {
    ...particle,
    size: "large" as const,
    data: { ...particle.data, widget },
  }
}

export function particleDocumentEndpoint(
  workspaceId: string,
  file: ParticleDocument
) {
  if (file.fileId) return imageFileEndpoint(workspaceId, file.fileId)
  const source = file.source
  if (
    !source ||
    source.kind === "drive" ||
    source.kind === "roadmap_drive" ||
    source.kind === "workspace_note" ||
    source.kind === "module_note"
  )
    return null
  const query = new URLSearchParams({ organizationId: workspaceId })
  if (source.kind === "upload") {
    query.set("kind", source.documentKind)
    return `/api/account/org-documents?${query}`
  }
  if (source.kind === "policy") {
    query.set("id", source.id)
    return `/api/account/org-policies/document?${query}`
  }
  query.set("id", `roadmap:${source.sectionId}`)
  return `/api/account/workspace-documents-index/item?${query}`
}

export function particleDocumentOriginal(file: ParticleDocument) {
  return file.source?.kind === "drive" || file.source?.kind === "roadmap_drive"
    ? file.source.webViewLink
    : file.source?.kind === "roadmap"
      ? getDocumentEditorHref(file.source.sectionId)
      : null
}

// Usually the visible library thumbnail supplies dimensions. Decode only when
// an image is dragged before that thumbnail has loaded; never upload it again.
export async function resolveLibraryImageParticle(
  particle: Particle
): Promise<Particle> {
  const file = getParticleDocument(particle)
  if (particle.type !== "activity" || file?.format !== "image" || !file.fileId)
    return particle
  const response = await fetch(
    imageFileEndpoint(particle.workspaceId, file.fileId),
    { signal: AbortSignal.timeout(15000), cache: "no-store" }
  )
  const { url } = z
    .object({ url: z.url({ protocol: /^https?$/ }) })
    .parse(await readImageResponse(response))
  const dimensions = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      const image = new Image()
      const timer = setTimeout(() => {
        image.src = ""
        reject(new Error("Image loading timed out."))
      }, 15000)
      image.onload = () => {
        clearTimeout(timer)
        const width = image.naturalWidth,
          height = image.naturalHeight
        if (
          !width ||
          !height ||
          width > 20000 ||
          height > 20000 ||
          width * height > 40_000_000
        )
          reject(new Error("Image dimensions are unsupported."))
        else resolve({ width, height })
      }
      image.onerror = () => {
        clearTimeout(timer)
        reject(new Error("Image unavailable."))
      }
      image.src = url
    }
  )
  return {
    ...particle,
    data: {
      ...particle.data,
      widget: { kind: "image", fileId: file.fileId, ...dimensions, alt: "" },
    },
  }
}
