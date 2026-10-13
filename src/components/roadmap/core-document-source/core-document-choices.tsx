"use client"

import Link from "next/link"
import PenLineIcon from "lucide-react/dist/esm/icons/pen-line"
import { Button } from "@/components/ui/button"
import { GoogleDriveMark } from "./google-drive-mark"

export function CoreDocumentChoices({
  canWrite = true,
  title,
  pending,
  error,
  onWrite,
  onDrive,
}: {
  canWrite?: boolean
  title: string
  pending: boolean
  error?: string | null
  onWrite: () => void
  onDrive: () => void
}) {
  return (
    <div className="border-border/60 bg-card mx-auto flex w-full max-w-lg flex-col gap-4 rounded-xl border p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Start {title}</h2>
        <p className="text-muted-foreground text-sm">
          Write a draft here, or link a document from Google Drive. The title
          stays {title}.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          className="min-h-11"
          onClick={onWrite}
          disabled={pending || !canWrite}
        >
          <PenLineIcon aria-hidden="true" />
          {canWrite ? "Start writing" : "Start writing · Upgrade"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={onDrive}
          disabled={pending}
        >
          <GoogleDriveMark />
          {pending ? "Connecting document…" : "Choose from Google Drive"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Link
        href="/workspace?drawer=tools"
        className="text-muted-foreground text-sm underline underline-offset-4"
      >
        Manage Google Drive in Tools
      </Link>
    </div>
  )
}
