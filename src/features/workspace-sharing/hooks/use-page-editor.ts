"use client"

import { useEffect, useRef, useState } from "react"
import { commitWorkspacePageAction, reviewWorkspacePageAction } from "../server/actions"
import type { PageEditorData } from "../lib/page-editor"
import { movePageMember } from "../lib/page-membership"
import { WORKSPACE_PAGE_PARTICLE_LIMIT, workspacePageDraftSchema } from "../lib/page-draft"
import type { WorkspacePageCommand } from "../lib/page-command"
import type { WorkspacePage, WorkspacePageDraft, WorkspacePageSnapshot } from "../types"

type EditorState = {
  page: PageEditorData["page"]
  pageId: string
  draft: WorkspacePageDraft
  baseline: WorkspacePageDraft
  preview: { snapshot: WorkspacePageSnapshot; reviewToken: string } | null
  pending: boolean
  uncertain: boolean
  error: string | null
  field: string | null
  notice: string | null
}
export function pageEditorDirty(state: Pick<EditorState, "draft" | "baseline">) {
  return JSON.stringify(state.draft) !== JSON.stringify(state.baseline)
}

/** Local draft only. Page/graph persistence stays in the authorized actions.
 * A request receipt survives transport errors until its exact retry resolves. */
export function usePageEditor({ data, particleId, onDirtyChange, onSaved }: {
  data: PageEditorData; particleId: string; onDirtyChange: (dirty: boolean) => void; onSaved?: (page: WorkspacePage) => void
}) {
  const initial = data.page?.draft ?? { title: "", description: "", particleIds: data.initialParticleIds.length ? data.initialParticleIds : [particleId] }
  const [state, setState] = useState<EditorState>({
    page: data.page, pageId: data.page?.id ?? data.suggestedPageId,
    draft: initial, baseline: initial, preview: null,
    pending: false, uncertain: false, error: null, field: null, notice: null,
  })
  const current = useRef(state)
  const alive = useRef(true)
  const retry = useRef<WorkspacePageCommand | null>(null)
  const publish = (next: EditorState) => {
    current.current = next
    if (!alive.current) return
    onDirtyChange(pageEditorDirty(next) || next.pending || next.uncertain)
    setState(next)
  }
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; onDirtyChange(false) }
  }, [onDirtyChange])
  const dirty = pageEditorDirty(state)
  useEffect(() => {
    if (!dirty && !state.pending && !state.uncertain) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty, state.pending, state.uncertain])

  function update(draft: WorkspacePageDraft) {
    const before = current.current
    if (before.pending || before.uncertain) return
    publish({ ...before, draft, preview: null, error: null, field: null, notice: null })
  }
  function validate() {
    const before = current.current
    const result = workspacePageDraftSchema.safeParse(before.draft)
    if (result.success) return result.data
    publish({ ...before, error: result.error.issues[0]?.message ?? "Review this page.",
      field: String(result.error.issues[0]?.path[0] ?? "particleIds"), notice: null })
    return null
  }
  async function review() {
    const before = current.current
    if (before.pending || before.uncertain) return
    const draft = validate()
    if (!draft) return
    publish({ ...before, pending: true, error: null, field: null, notice: null })
    try {
      const result = await reviewWorkspacePageAction({ pageId: before.pageId,
        expectedRevision: before.page?.revision ?? 0, draft })
      if (!alive.current) return
      publish(result.ok
        ? { ...current.current, pending: false, preview: { snapshot: result.value.snapshot, reviewToken: result.value.reviewToken } }
        : { ...current.current, pending: false, preview: null, error: result.error })
    } catch {
      publish({ ...current.current, pending: false, error: "Unable to load the preview. Try again." })
    }
  }
  async function send(command: WorkspacePageCommand) {
    if (current.current.pending) return
    retry.current = command
    publish({ ...current.current, pending: true, error: null, field: null, notice: null })
    try {
      const result = await commitWorkspacePageAction(command)
      if (!alive.current) return
      if (!result.ok) {
        if (!result.uncertain) retry.current = null
        publish({ ...current.current, pending: false, uncertain: result.uncertain,
          preview: result.uncertain ? current.current.preview : null, error: result.error })
        return
      }
      retry.current = null
      const page = result.value.page
      publish({ ...current.current, page, draft: command.intent === "make_private" ? current.current.draft : page.draft, baseline: page.draft,
        preview: null, pending: false, uncertain: false, error: null,
        notice: command.intent === "save_draft" ? "Draft saved." : command.intent === "make_private" ? "This page is now private." : "Published." })
      onSaved?.(page)
    } catch {
      publish({ ...current.current, pending: false, uncertain: true,
        error: "This save is unconfirmed. Retry it before making another change." })
    }
  }
  async function write(intent: WorkspacePageCommand["intent"]) {
    const before = current.current
    if (before.pending || before.uncertain) return
    const identity = { pageId: before.pageId, operationId: crypto.randomUUID(), expectedRevision: before.page?.revision ?? 0 }
    if (intent === "make_private") {
      if (before.page) await send({ ...identity, intent })
      return
    }
    const draft = validate()
    if (!draft) return
    if (intent === "publish") {
      if (!data.publishingEnabled || !before.preview) return
      await send({ ...identity, intent, draft, reviewToken: before.preview.reviewToken })
    } else await send({ ...identity, intent, draft })
  }
  return {
    state, dirty, locked: state.pending || state.uncertain,
    activeAction: state.pending ? retry.current?.intent ?? "review" : null,
    update, review, write,
    retry: () => retry.current ? send(retry.current) : Promise.resolve(),
    edit: () => { if (!current.current.pending && !current.current.uncertain) publish({ ...current.current, preview: null }) },
    move: (id: string, direction: -1 | 1) => update({ ...current.current.draft, particleIds: movePageMember(current.current.draft.particleIds, id, direction) }),
    reorder: (ids: string[]) => {
      const selected = current.current.draft.particleIds
      if (ids.length === selected.length && new Set(ids).size === ids.length && ids.every((id) => selected.includes(id)))
        update({ ...current.current.draft, particleIds: ids })
    },
    toggle: (id: string) => {
      const ids = current.current.draft.particleIds
      const choice = data.choices.find((item) => item.id === id)
      if (!ids.includes(id) && (!choice || choice.reason || ids.length >= WORKSPACE_PAGE_PARTICLE_LIMIT)) return
      update({ ...current.current.draft, particleIds: ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id] })
    },
  }
}
