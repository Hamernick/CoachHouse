"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getParticleDocument } from "../lib/particle-file"
import { useParticleFileUrl } from "../hooks/use-particle-file-url"
import { ParticleActionMenu } from "./particle-action-menu"
import { ParticleFrame } from "./particle-frame"
import { particleDrivePreviewUrl } from "../lib/particle-drive-preview"
import { ParticleDrivePreview } from "./particle-drive-preview"
import { ParticleFileViewer } from "./particle-file-viewer"
import { useParticleSurface } from "./particle-surface"
import type { ParticleNodeData } from "./particle-node"

const Preview = dynamic(
  () =>
    import("./particle-document-preview").then(
      (module) => module.ParticleDocumentPreview
    ),
  {
    ssr: false,
    loading: () => (
      <Skeleton
        className="size-full motion-reduce:animate-none"
        role="status"
        aria-label="Loading preview"
      />
    ),
  }
)
export function ParticleDocumentCard({
  data,
  selected,
  controls,
}: {
  data: ParticleNodeData
  selected: boolean
  controls: boolean
}) {
  const file = getParticleDocument(data.particle)
  if (!file) return null
  return (
    <DocumentSurface
      key={`${data.particle.workspaceId}:${file.fileId ?? JSON.stringify(file.source)}`}
      data={data}
      selected={selected}
      controls={controls}
      file={file}
    />
  )
}
function DocumentSurface({
  data,
  selected,
  controls,
  file,
}: {
  data: ParticleNodeData
  selected: boolean
  controls: boolean
  file: NonNullable<ReturnType<typeof getParticleDocument>>
}) {
  const [pdfPage, setPdfPage] = useState(1)
  const [expanded, setExpanded] = useState(false)
  const [driveRefresh, setDriveRefresh] = useState(0)
  const drivePreviewUrl = particleDrivePreviewUrl(file)
  const preview = useParticleFileUrl(data.particle.workspaceId, file, expanded)
  const surface = useParticleSurface(
    "ParticleDocumentCard",
    "particle-document-card.tsx"
  )
  const content = (full: boolean) =>
    drivePreviewUrl ? (
      full ? (
        <ParticleDrivePreview key={driveRefresh} url={drivePreviewUrl} name={file.name} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center text-sm">
          <Button variant="outline" size="sm" className="nodrag nopan h-11 rounded-full sm:h-8" onClick={() => setExpanded(true)}>
            Preview file
          </Button>
          <Button asChild variant="ghost" size="sm" className="nodrag nopan h-11 rounded-full sm:h-8">
            <a href={preview.url ?? undefined} target="_blank" rel="noopener noreferrer">Open original</a>
          </Button>
        </div>
      )
    ) : preview.error ? (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-2 p-4 text-xs"
      >
        <p>{preview.error}</p>
        <Button variant="outline" size="sm" onClick={preview.retry}>
          Retry preview
        </Button>
      </div>
    ) : preview.url ? (
      <Preview
        key={preview.url}
        file={file}
        url={preview.url}
        text={preview.text}
        expanded={full}
        pdfPage={pdfPage}
        onPdfPageChange={setPdfPage}
        retry={preview.retry}
      />
    ) : (
      <Skeleton
        className="size-full motion-reduce:animate-none"
        role="status"
        aria-label="Loading file preview"
      />
    )
  return (
    <ParticleFrame selected={selected} className="gap-0 rounded-[22px] p-0">
      {controls && (
        <ParticleActionMenu
          data={data}
          selected={selected}
          onPreview={() => setExpanded(true)}
        />
      )}
      <figure
        className="particle-file-figure"
        ref={preview.ref}
        {...surface("document")}
      >
        <div className="particle-file-preview nopan nowheel bg-muted/30 h-72 overflow-hidden rounded-[21px]">
          {preview.active && !expanded ? (
            content(false)
          ) : (
            <Skeleton className="size-full animate-none" />
          )}
        </div>
        <figcaption
          {...surface("title")}
          className="truncate px-3 py-2 text-sm font-medium"
          title={data.particle.title}
        >
          {data.particle.title}
        </figcaption>
      </figure>
      <ParticleFileViewer
        open={expanded}
        onOpenChange={setExpanded}
        title={data.particle.title}
        url={preview.url}
        origin={preview.ref}
        onRefresh={drivePreviewUrl ? () => setDriveRefresh((value) => value + 1) : undefined}
      >
        {expanded ? content(true) : null}
      </ParticleFileViewer>
    </ParticleFrame>
  )
}
