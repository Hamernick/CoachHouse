"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { DocumentsPolicyEntry } from "@/components/organization/org-profile-card/tabs/documents-tab/types"
import { toast } from "@/lib/toast"

export function OrganizationPolicyFile({
  policy,
  organizationId,
  onSaved,
  onOpen,
}: {
  policy: DocumentsPolicyEntry
  organizationId: string
  onSaved: () => void
  onOpen: (url: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(policy.title)
  const [summary, setSummary] = useState(policy.summary)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const params = new URLSearchParams({ organizationId, id: policy.id })
  const documentUrl = `/api/account/org-policies/document?${params}`
  const save = async () => {
    setBusy(true)
    try {
      const response = await fetch(`/api/account/org-policies?${params}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...policy, title, summary }),
      })
      const payload = await response.json()
      if (!response.ok)
        throw new Error(payload.error ?? "Unable to save policy")
      if (pendingFile) {
        const body = new FormData()
        body.append("file", pendingFile)
        const upload = await fetch(documentUrl, { method: "POST", body })
        const result = await upload.json()
        if (!upload.ok)
          throw new Error(
            `Policy details saved, but the PDF was not replaced. ${result.error ?? "Try again."}`
          )
      }
      setPendingFile(null)
      toast.success("Policy saved")
      setEditing(false)
      onSaved()
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Unable to save policy"
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{policy.title}</p>
          <p className="text-muted-foreground text-xs">Policy</p>
        </div>
        <div className="flex gap-2">
          {policy.document ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void onOpen(documentUrl)}
            >
              Open file
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      </div>
      {editing ? (
        <div className="space-y-3">
          <Input
            aria-label="Policy title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={busy}
          />
          <Textarea
            aria-label="Policy summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            disabled={busy}
          />
          <label className="block space-y-1 text-sm">
            <span>
              {policy.document ? "Replace policy PDF" : "Upload policy PDF"}
            </span>
            <Input
              type="file"
              accept="application/pdf"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) setPendingFile(file)
                event.target.value = ""
              }}
            />
            {pendingFile ? (
              <p className="text-muted-foreground text-xs">
                Ready to upload: {pendingFile.name}
              </p>
            ) : null}
          </label>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || !title.trim()}
              onClick={() => void save()}
            >
              {busy ? "Saving…" : "Save policy"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setPendingFile(null)
                setTitle(policy.title)
                setSummary(policy.summary)
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
