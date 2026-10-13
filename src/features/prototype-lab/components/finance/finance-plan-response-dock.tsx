"use client"

import ArrowUpIcon from "lucide-react/dist/esm/icons/arrow-up"
import PaperclipIcon from "lucide-react/dist/esm/icons/paperclip"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  buildFinancePlanResponseLinks,
  type FinancePlanResponse,
  type FinancePlanResponseAction,
} from "@/lib/prototype-lab/finance-plan-response"
import { cn } from "@/lib/utils"

import { FinancePlanResponseActions } from "./finance-plan-response-actions"
import {
  FINANCE_PLAN_RESPONSE_ENABLED,
  useFinancePlanResponses,
} from "./finance-plan-response-context"
import { FinancePlanResponseHistory } from "./finance-plan-response-history"
import { FinancePlanResponseDraftPreviews } from "./finance-plan-response-previews"

const ENDPOINT = "/api/prototypes/finance-plan-responses"
const MAX_FILE_COUNT = 5
const MAX_FILE_SIZE = 25 * 1024 * 1024
const MAX_TOTAL_FILE_SIZE = 50 * 1024 * 1024

type ResponsePayload = {
  response?: FinancePlanResponse
  error?: string
}

function readFiles(entries: FileList | readonly File[]) {
  return Array.from(entries).filter((file) => file.size > 0)
}

function getFileError(files: File[]) {
  if (files.length > MAX_FILE_COUNT) return "Attach up to 5 files."
  if (files.some((file) => file.size > MAX_FILE_SIZE)) {
    return "Each attachment must be 25 MB or less."
  }
  if (
    files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_FILE_SIZE
  ) {
    return "Attachments must total 50 MB or less."
  }
  return null
}

export function FinancePlanResponseDock({
  nodeId,
  viewId,
}: {
  nodeId: string | null
  viewId: string
}) {
  const reducedMotion = useReducedMotion()
  const {
    addResponse,
    error: loadError,
    loading,
    responses,
  } = useFinancePlanResponses()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [message, setMessage] = useState("")
  const [pendingAction, setPendingAction] =
    useState<FinancePlanResponseAction | null>(null)
  const [saving, setSaving] = useState(false)
  const links = useMemo(() => buildFinancePlanResponseLinks(message), [message])
  const currentResponse = responses.find(
    (response) =>
      response.nodeId === nodeId &&
      (nodeId !== null || response.viewId === viewId)
  )

  const addFiles = useCallback((incoming: File[]) => {
    setFiles((current) => {
      const combined = [...current, ...incoming].filter(
        (file, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.name === file.name &&
              candidate.size === file.size &&
              candidate.lastModified === file.lastModified
          ) === index
      )
      const fileError = getFileError(combined)
      if (fileError) {
        setError(fileError)
        return current
      }
      setError(null)
      return combined
    })
  }, [])

  const saveResponse = useCallback(
    async (action: FinancePlanResponseAction | null) => {
      if (saving) return
      if (!action && !message.trim() && !files.length) {
        setError("Add a reply or attachment.")
        inputRef.current?.focus()
        return
      }

      setSaving(true)
      setPendingAction(action)
      setError(null)

      try {
        const formData = new FormData()
        formData.set("planId", "finance-release-plan")
        formData.set("viewId", viewId)
        if (nodeId) formData.set("nodeId", nodeId)
        formData.set("message", message)
        if (action) formData.set("action", action)
        files.forEach((file) => formData.append("files", file))

        const request = await fetch(ENDPOINT, {
          body: formData,
          method: "POST",
        })
        const payload = (await request
          .json()
          .catch(() => ({}))) as ResponsePayload
        if (!request.ok || !payload.response) {
          throw new Error(payload.error || "Unable to save the reply.")
        }

        addResponse(payload.response)
        setMessage("")
        setFiles([])
        if (fileInputRef.current) fileInputRef.current.value = ""
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to save the reply."
        )
      } finally {
        setSaving(false)
        setPendingAction(null)
      }
    },
    [addResponse, files, message, nodeId, saving, viewId]
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return
    event.preventDefault()
    void saveResponse(null)
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pastedFiles = readFiles(event.clipboardData.files)
    if (pastedFiles.length) addFiles(pastedFiles)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    addFiles(readFiles(event.dataTransfer.files))
  }

  if (!FINANCE_PLAN_RESPONSE_ENABLED) return null

  const resolvedAction =
    currentResponse?.state === "resolved" ? currentResponse.action : null
  const isInProgress = currentResponse?.state === "in_progress"
  const displayedError = error ?? loadError

  return (
    <div className="pointer-events-none absolute right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 z-40 flex justify-center lg:right-56">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="nowheel nodrag nopan border-border/70 bg-card/95 pointer-events-auto w-full max-w-3xl rounded-[1.75rem] border p-2 shadow-lg backdrop-blur-xl"
        data-finance-plan-response-dock="true"
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        transition={{ duration: reducedMotion ? 0 : 0.18, ease: "easeOut" }}
      >
        <AnimatePresence initial={false}>
          {files.length || links.length ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              initial={reducedMotion ? false : { opacity: 0, y: 4 }}
              transition={{ duration: reducedMotion ? 0 : 0.16 }}
            >
              <FinancePlanResponseDraftPreviews
                files={files}
                links={links}
                onRemoveFile={(index) =>
                  setFiles((current) =>
                    current.filter((_, fileIndex) => fileIndex !== index)
                  )
                }
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <FinancePlanResponseActions
            disabled={saving}
            inProgress={isInProgress}
            onAction={(action) => void saveResponse(action)}
            onAddNote={() => inputRef.current?.focus()}
            resolvedAction={resolvedAction}
          />

          <div className="border-input bg-background focus-within-visible:border-ring focus-within-visible:ring-ring/50 flex h-12 min-w-0 flex-1 items-center rounded-full border px-1 shadow-xs focus-within-visible:ring-3">
            <input
              accept="image/avif,image/gif,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,application/pdf,text/plain,text/csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rtf"
              className="sr-only"
              multiple
              onChange={(event) =>
                addFiles(readFiles(event.target.files ?? []))
              }
              ref={fileInputRef}
              type="file"
            />
            <Button
              aria-label="Attach images, videos, or documents"
              className="size-10 rounded-full"
              disabled={saving}
              onClick={() => fileInputRef.current?.click()}
              size="icon"
              title="Attach files"
              type="button"
              variant="ghost"
            >
              <PaperclipIcon aria-hidden="true" className="size-4" />
            </Button>
            <Input
              aria-label="Reply to the plan"
              className="h-10 min-w-24 flex-1 rounded-full border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
              disabled={saving}
              maxLength={4_000}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Reply, paste a link, or drop a file…"
              ref={inputRef}
              value={message}
            />
            <FinancePlanResponseHistory
              loading={loading}
              responses={responses}
            />
            <Button
              aria-label="Save response"
              className="size-10 rounded-full"
              disabled={saving || (!message.trim() && !files.length)}
              onClick={() => void saveResponse(null)}
              size="icon"
              title="Save response"
              type="button"
            >
              <ArrowUpIcon aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {displayedError || saving ? (
            <motion.p
              animate={{ opacity: 1, y: 0 }}
              aria-live="polite"
              className={cn(
                "px-3 pt-1 text-xs",
                displayedError ? "text-destructive" : "text-muted-foreground"
              )}
              exit={{ opacity: 0, y: -2 }}
              initial={reducedMotion ? false : { opacity: 0, y: -2 }}
              transition={{ duration: reducedMotion ? 0 : 0.14 }}
            >
              {displayedError
                ? displayedError
                : pendingAction
                  ? `Saving ${pendingAction}…`
                  : "Saving response…"}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
