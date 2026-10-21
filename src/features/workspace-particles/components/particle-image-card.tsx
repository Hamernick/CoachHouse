"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { z } from "zod"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ParticleFileViewer } from "./particle-file-viewer"
import {
  getParticleImage,
  imageFileEndpoint,
  readImageResponse,
  type ParticleImage,
} from "../lib/particle-image"
import { PARTICLE_IMAGE_CAPTION_HEIGHT } from "../lib/particle-size"
import { ParticleFrame } from "./particle-frame"
import { ParticleActionMenu } from "./particle-action-menu"
import type { ParticleNodeData } from "./particle-node"
import { useParticleSurface } from "./particle-surface"

export function ParticleImageCard({
  data,
  selected,
  controls,
}: {
  data: ParticleNodeData
  selected: boolean
  controls: boolean
}) {
  const image = getParticleImage(data.particle)
  if (!image) return null
  return (
    <ParticleImageSurface
      key={`${data.particle.workspaceId}:${image.fileId}`}
      data={data}
      image={image}
      selected={selected}
      controls={controls}
    />
  )
}

function ParticleImageSurface({
  data,
  image,
  selected,
  controls,
}: {
  data: ParticleNodeData
  image: ParticleImage
  selected: boolean
  controls: boolean
}) {
  const host = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [preview, setPreview] = useState(false)
  const surface = useParticleSurface(
    "ParticleImageCard",
    "particle-image-card.tsx"
  )
  useEffect(() => {
    if (!host.current || typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "200px" }
    )
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!visible) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    let active = true
    setLoaded(false)
    setUrl(null)
    setError(null)
    void fetch(imageFileEndpoint(data.particle.workspaceId, image.fileId), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(readImageResponse)
      .then((body) => {
        const parsed = z
          .object({ url: z.url({ protocol: /^https?$/ }) })
          .parse(body)
        if (active) setUrl(parsed.url)
      })
      .catch((reason) => {
        if (active)
          setError(
            controller.signal.aborted
              ? "Image loading timed out."
              : reason instanceof Error
                ? reason.message
                : "Image unavailable."
          )
      })
      .finally(() => clearTimeout(timeout))
    return () => {
      active = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [visible, attempt, data.particle.workspaceId, image.fileId])
  return (
    <ParticleFrame selected={selected} className="gap-0 rounded-[22px] p-0">
      {controls && (
        <ParticleActionMenu
          data={data}
          selected={selected}
          onPreview={() => setPreview(true)}
        />
      )}
      <figure className="particle-file-figure" ref={host} {...surface("image")}>
        <div
          className="particle-file-preview bg-muted relative overflow-hidden rounded-[21px]"
          style={{
            aspectRatio: image.width / image.height,
          }}
        >
          {!loaded && !error && (
            <Skeleton
              className="absolute inset-0 motion-reduce:animate-none"
              aria-label="Loading image"
            />
          )}
          {url && !error ? (
            <Image
              src={url}
              alt={image.alt || data.particle.title}
              width={image.width}
              height={image.height}
              unoptimized
              draggable={false}
              className="h-full w-full object-contain"
              onLoad={() => setLoaded(true)}
              onError={() =>
                setError("Image unavailable. Try loading it again.")
              }
            />
          ) : (
            <div
              className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-xs"
              role="status"
            >
              <span>{error ?? "Loading image…"}</span>
              {error && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="nodrag nopan"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Retry image
                </Button>
              )}
            </div>
          )}
        </div>
        <figcaption
          {...surface("title")}
          className="truncate px-3 text-sm font-medium"
          style={{
            height: PARTICLE_IMAGE_CAPTION_HEIGHT,
            lineHeight: `${PARTICLE_IMAGE_CAPTION_HEIGHT}px`,
          }}
          title={data.particle.title}
        >
          {data.particle.title}
        </figcaption>
      </figure>
      <ParticleFileViewer
        open={preview}
        onOpenChange={setPreview}
        title={data.particle.title}
        url={url}
        origin={host}
      >
        {url && !error ? (
          <Image
            src={url}
            alt={image.alt || data.particle.title}
            width={image.width}
            height={image.height}
            unoptimized
            className="h-full w-full object-contain p-3"
          />
        ) : (
          <p className="text-sm">{error ?? "Loading image…"}</p>
        )}
      </ParticleFileViewer>
    </ParticleFrame>
  )
}
