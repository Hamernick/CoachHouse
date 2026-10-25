"use client"

import { useLayoutEffect, useRef } from "react"
import { useMediaActivity } from "@/components/media/media-activity"
import { ManagedVideoEmbed } from "@/components/media/managed-video-embed"

import ExternalLink from "lucide-react/dist/esm/icons/external-link"
import Play from "lucide-react/dist/esm/icons/play"
import VideoIcon from "lucide-react/dist/esm/icons/video"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface VideoSectionProps {
  embedUrl: string | null
  videoUrl: string | null
  fallbackUrl: string | null
  variant?: "card" | "frame"
  onEnded?: () => void
  className?: string
}

export function VideoSection({
  embedUrl,
  videoUrl,
  fallbackUrl,
  variant = "card",
  className,
  onEnded,
}: VideoSectionProps) {
  const active = useMediaActivity()
  const videoRef = useRef<HTMLVideoElement>(null)
  useLayoutEffect(() => {
    if (!active) videoRef.current?.pause()
  }, [active, videoUrl])
  const isFrame = variant === "frame"
  const mediaClass = isFrame ? "h-full" : "aspect-video"

  const content = embedUrl ? (
    <div className={`relative w-full bg-black ${mediaClass}`}>
      <ManagedVideoEmbed src={embedUrl} title="Class video" />
    </div>
  ) : videoUrl ? (
    <div className={`relative w-full bg-black ${mediaClass}`}>
      <video
        ref={videoRef}
        onPlay={(event) => {
          if (!active) event.currentTarget.pause()
        }}
        src={videoUrl}
        className="absolute inset-0 h-full w-full"
        controls
        onEnded={onEnded}
        playsInline
        preload="metadata"
      />
    </div>
  ) : fallbackUrl ? (
    <div
      className={`bg-muted/40 text-muted-foreground flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm ${mediaClass}`}
    >
      <p>This video is hosted externally — open it in a new tab to watch.</p>
      <Button asChild size="sm">
        <a href={fallbackUrl} target="_blank" rel="noreferrer">
          <ExternalLink className="mr-2 h-4 w-4" /> Open video
        </a>
      </Button>
    </div>
  ) : (
    <div className={`bg-muted grid w-full place-items-center ${mediaClass}`}>
      <Button variant="secondary" size="sm" className="pointer-events-none">
        <Play className="mr-2 h-4 w-4" /> Video coming soon
      </Button>
    </div>
  )

  if (isFrame) {
    return <div className={className}>{content}</div>
  }

  return (
    <Card className={`overflow-hidden ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-3">
        <div className="flex items-center gap-2 text-base font-semibold">
          <VideoIcon className="h-4 w-4" />
          <span>Class video</span>
        </div>
      </div>
      <CardContent className="overflow-hidden rounded-b-2xl p-0">
        {content}
      </CardContent>
    </Card>
  )
}
