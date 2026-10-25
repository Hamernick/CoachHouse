"use client"

import { useCallback, useMemo, useRef, useState, type RefObject } from "react"
import { toast } from "@/lib/toast"
import type { ReactFlowInstance } from "@xyflow/react"
import {
  imageFileTitle,
  MAX_PARTICLE_IMAGES,
  isImagePlaceholder,
  particleImageFileError,
} from "../lib/particle-image"
import {
  createFileParticle,
  particleFileError,
  uploadParticleFile,
} from "../lib/particle-file"
import {
  fillImagePlaceholder,
  pendingParticleUploads,
  type ParticleUploadOperation,
} from "../lib/particle-upload-operations"
import type { ParticlePosition } from "../types"
import type { useParticleSession } from "./use-particle-session"

type Input = {
  session: ReturnType<typeof useParticleSession>
  dirty: RefObject<boolean>
  blocked: boolean
  flush: () => Promise<boolean>
  flow: RefObject<ReactFlowInstance | null>
}
export function useParticleImageUpload(input: Input) {
  const latest = useRef(input)
  latest.current = input
  const running = useRef(false)
  const prepared = useRef<{
    workspaceId: string
    operations: ParticleUploadOperation[]
  } | null>(null)
  const [canRetry, setCanRetry] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const upload = useCallback(
    async (
      files: File[],
      position?: ParticlePosition,
      placeholderId?: string
    ) => {
      const current = latest.current
      if (running.current || current.blocked || !current.session.editable)
        return false
      if (
        prepared.current?.workspaceId !== current.session.graph?.workspaceId
      ) {
        prepared.current = null
        setCanRetry(false)
      }
      if (prepared.current) {
        toast.error(
          "Retry adding the uploaded files before starting another upload."
        )
        return false
      }
      if (current.dirty.current) {
        setMessage("Save or discard the open Particle edits first.")
        toast.error("Save or discard the open Particle edits first.")
        return false
      }
      if (!files.length) return false
      const invalid = placeholderId
        ? files.length !== 1
          ? "Drop one image into this placeholder."
          : particleImageFileError(files[0])
        : files.map(particleFileError).find(Boolean)
      if (invalid || files.length > MAX_PARTICLE_IMAGES) {
        toast.error(
          invalid ?? `Add up to ${MAX_PARTICLE_IMAGES} files at once.`
        )
        setMessage(invalid ?? `Add up to ${MAX_PARTICLE_IMAGES} files at once.`)
        return false
      }
      const workspaceId = current.session.graph?.workspaceId
      if (!workspaceId) return false
      running.current = true
      setPending(true)
      setMessage("Uploading files…")
      const toastId = toast.loading("Uploading files…")
      const report = (text: string) => {
        setMessage(text)
        toast.error(text, { id: toastId })
      }
      try {
        if (!(await current.flush())) {
          report("Finish saving canvas changes, then try again.")
          return false
        }
        const target = placeholderId
          ? latest.current.session
              .getCurrentGraph()
              ?.particles.find((particle) => particle.id === placeholderId)
          : undefined
        if (
          placeholderId &&
          (!target ||
            !isImagePlaceholder(target) ||
            target.locked ||
            target.canvasHidden)
        ) {
          report("This image placeholder is no longer available.")
          return false
        }
        const canvas = document
          .querySelector("[data-workspace-canvas-flow-frame]")
          ?.getBoundingClientRect()
        const origin =
          position ??
          (canvas && current.flow.current
            ? current.flow.current.screenToFlowPosition({
                x: canvas.left + canvas.width / 2 - 200,
                y: canvas.top + 80,
              })
            : { x: 100, y: 100 })
        const operations: ParticleUploadOperation[] = []
        for (const [index, file] of files.entries()) {
          const image = await uploadParticleFile(workspaceId, file)
          if (target) {
            if (image.kind !== "image")
              throw new Error("Choose an image for this placeholder.")
            operations.push(
              fillImagePlaceholder(target, image, imageFileTitle(file.name))
            )
          } else
            operations.push({
              kind: "put_particle",
              expectedRevision: null,
              particle: createFileParticle(
                workspaceId,
                imageFileTitle(file.name),
                image,
                { x: origin.x + index * 32, y: origin.y + index * 32 },
                crypto.randomUUID(),
                new Date().toISOString()
              ),
            })
          prepared.current = { workspaceId, operations: [...operations] }
          setCanRetry(true)
        }
        const next = latest.current
        if (
          next.session.getCurrentGraph()?.workspaceId !== workspaceId ||
          next.blocked ||
          next.dirty.current
        ) {
          report(
            "Files were uploaded to Documents. Finish your current edit, then retry adding them in the original workspace."
          )
          return false
        }
        const saved = await next.session.commit(operations)
        if (saved) {
          prepared.current = null
          setCanRetry(false)
          setMessage(null)
          toast.success(files.length === 1 ? "File added" : "Files added", {
            id: toastId,
          })
        } else
          report("Files are in Documents. Retry adding them to the canvas.")
        return saved
      } catch (error) {
        report(
          `${error instanceof Error ? error.message : "File upload failed. Try again."}${prepared.current ? " Retry adding the files already uploaded." : ""}`
        )
        return false
      } finally {
        running.current = false
        setPending(false)
      }
    },
    []
  )
  const retry = useCallback(async () => {
    const current = latest.current
    const ready = prepared.current
    if (
      !ready ||
      running.current ||
      current.blocked ||
      current.dirty.current ||
      current.session.getCurrentGraph()?.workspaceId !== ready.workspaceId
    )
      return false
    running.current = true
    setPending(true)
    try {
      if (current.session.error && !(await current.session.retry()))
        return false
      if (!(await current.flush())) return false
      const next = latest.current
      const graph = next.session.getCurrentGraph()
      if (
        !graph ||
        graph.workspaceId !== ready.workspaceId ||
        next.dirty.current ||
        next.blocked
      )
        return false
      const missing = pendingParticleUploads(ready.operations, graph.particles)
      if (!missing) {
        prepared.current = null
        setCanRetry(false)
        const message =
          "Image saved to Documents. The placeholder changed before it could be attached."
        setMessage(message)
        toast.error(message)
        return false
      }
      const saved = !missing.length || (await next.session.commit(missing))
      if (saved) {
        prepared.current = null
        setCanRetry(false)
        setMessage(null)
        toast.success("Files added")
      }
      return saved
    } catch {
      setMessage("Could not finish adding files. Try again.")
      return false
    } finally {
      running.current = false
      setPending(false)
    }
  }, [])
  const uploadToPlaceholder = useCallback(
    (id: string, files: File[]) => upload(files, undefined, id),
    [upload]
  )
  return useMemo(
    () => ({ upload, uploadToPlaceholder, retry, canRetry, pending, message }),
    [upload, uploadToPlaceholder, retry, canRetry, pending, message]
  )
}
