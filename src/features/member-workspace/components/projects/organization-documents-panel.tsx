"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { loadOrganizationDocuments } from "../../project-workflow-actions"
import { OrganizationPolicyFile } from "./organization-policy-files"
import dynamic from "next/dynamic"
const OrganizationCoreDocumentEditor = dynamic(() =>
  import("./organization-core-document-editor").then(
    (module) => module.OrganizationCoreDocumentEditor
  )
)
import type { RoadmapSection } from "@/lib/roadmap"
import { toast } from "@/lib/toast"

type Documents = Exclude<
  Awaited<ReturnType<typeof loadOrganizationDocuments>>,
  { error: string }
>

export function OrganizationDocumentsPanel({
  organizationId,
}: {
  organizationId: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [data, setData] = useState<Documents | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<RoadmapSection | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    setError(null)
    try {
      const result = await loadOrganizationDocuments(organizationId)
      if ("error" in result)
        setError(result.error ?? "Unable to load organization documents.")
      else setData(result)
    } catch {
      setError("Unable to load organization documents. Try again.")
    }
  }, [organizationId])
  useEffect(() => {
    void load()
  }, [load])
  const matches = (name: string) =>
    name.toLowerCase().includes(query.trim().toLowerCase())
  const endpoint = (kind?: string, id?: string) => {
    const params = new URLSearchParams({ organizationId })
    if (kind) params.set("kind", kind)
    if (id) params.set("id", id)
    return `/api/account/${kind ? "org-documents" : "organization-document-files"}?${params}`
  }
  const openFile = async (url: string) => {
    const tab = window.open("about:blank", "_blank")
    if (tab) tab.opener = null
    try {
      const response = await fetch(url)
      const payload = await response.json()
      if (!response.ok || !payload.url)
        throw new Error(payload.error ?? "Unable to open file")
      if (tab) tab.location.href = payload.url
      else toast.error("Allow pop-ups to open this file.")
    } catch (cause) {
      tab?.close()
      toast.error(
        cause instanceof Error ? cause.message : "Unable to open file"
      )
    }
  }
  const upload = async (file: File, kind?: string) => {
    setBusy(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const response = await fetch(endpoint(kind), { method: "POST", body })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Upload failed")
      toast.success("File saved")
      await load()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Upload failed")
    } finally {
      setBusy(false)
    }
  }
  if (error)
    return (
      <div role="alert" className="space-y-2">
        <p>{error}</p>
        <Button variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  if (!data)
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Loading organization documents…
      </p>
    )
  const sections = data.sections.filter((item) => matches(item.title))
  const uploads = data.uploads.filter((item) =>
    matches(`${item.title} ${item.document?.name ?? ""}`)
  )
  const policies = data.policies.filter((item) => matches(item.title))
  const files = data.files.filter((item) => matches(item.name))
  const drive = data.drive.filter((item) => matches(item.name))
  return (
    <section className="space-y-4" aria-label="Organization documents">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Organization documents</h2>
          <p className="text-muted-foreground text-sm">
            Core documents and files from this organization’s workspace.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          {busy ? "Uploading…" : "Upload file"}
        </Button>
        <Input
          ref={fileInputRef}
          type="file"
          className="hidden"
          aria-label="Upload organization file"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
            event.target.value = ""
          }}
        />
      </div>
      <Input
        type="search"
        aria-label="Search organization documents"
        placeholder="Search organization documents…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {!sections.length &&
      !uploads.length &&
      !policies.length &&
      !files.length &&
      !drive.length ? (
        <p role="status" className="text-muted-foreground text-sm">
          No documents match your search.
        </p>
      ) : null}
      <div className="divide-y rounded-lg border">
        {sections.map((section) => (
          <div
            key={section.id}
            className="flex items-center justify-between gap-3 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{section.title}</p>
              <p className="text-muted-foreground text-xs">Core document</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(section)}
            >
              View / edit
            </Button>
          </div>
        ))}
        {uploads.map((item) => (
          <div
            key={item.kind}
            className="flex items-center justify-between gap-3 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.title}</p>
              <p className="text-muted-foreground truncate text-xs">
                {item.document?.name ?? "Not uploaded"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.document ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void openFile(endpoint(item.kind))}
                >
                  Open
                </Button>
              ) : null}
              <label className="text-sm">
                <span className="sr-only">
                  {item.document ? "Replace" : "Upload"} {item.title}
                </span>
                <Input
                  type="file"
                  className="max-w-56"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void upload(file, item.kind)
                    event.target.value = ""
                  }}
                />
              </label>
            </div>
          </div>
        ))}
        {policies.map((policy) => (
          <OrganizationPolicyFile
            key={`${policy.id}:${policy.updatedAt}`}
            policy={policy}
            organizationId={organizationId}
            onSaved={() => void load()}
            onOpen={openFile}
          />
        ))}
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between gap-3 p-3"
          >
            <p className="truncate text-sm">{file.name}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void openFile(endpoint(undefined, file.id))}
            >
              Open
            </Button>
          </div>
        ))}
        {drive.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between gap-3 p-3"
          >
            <p className="truncate text-sm">
              {file.name}{" "}
              <span className="text-muted-foreground">· Google Drive</span>
            </p>
            {file.web_view_link?.startsWith("https://") ? (
              <Button size="sm" variant="outline" asChild>
                <a
                  href={file.web_view_link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Drive
                </a>
              </Button>
            ) : (
              <span className="text-muted-foreground text-xs">Unavailable</span>
            )}
          </div>
        ))}
      </div>
      {editing ? (
        <OrganizationCoreDocumentEditor
          key={editing.id}
          section={editing}
          organizationId={organizationId}
          userId={data.userId}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      ) : null}
    </section>
  )
}
