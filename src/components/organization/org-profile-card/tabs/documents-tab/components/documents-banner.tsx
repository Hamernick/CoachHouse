"use client"

import type { DragEvent, ReactNode } from "react"
import { IconLock } from "@tabler/icons-react"

type DocumentsBannerProps = {
  canEdit: boolean
  uploading?: boolean
  children: ReactNode
}

export function DocumentsBanner({
  canEdit,
  uploading = false,
  children,
}: DocumentsBannerProps) {
  const preventFileNavigation = (event: DragEvent<HTMLElement>) => {
    if (Array.from(event.dataTransfer.types).includes("Files")) {
      event.preventDefault()
      event.dataTransfer.dropEffect = "none"
    }
  }

  return (
    <section

      className="relative mx-auto w-full max-w-xl rounded-2xl bg-transparent p-3"
      aria-busy={uploading || undefined}
      onDragOver={preventFileNavigation}
      onDrop={preventFileNavigation}
    >
      {children}
      {!canEdit ? (
        <p className="text-muted-foreground mt-5 flex items-center gap-2 text-xs">
          <IconLock className="size-3.5" aria-hidden />
          View-only access. Organization admins can add and manage files.
        </p>
      ) : null}
    </section>
  )
}
