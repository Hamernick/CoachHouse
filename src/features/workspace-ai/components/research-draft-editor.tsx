import { ResearchOutputCoverage } from "./research-output-coverage"
import { useEffect, useId, useState } from "react"
import { ParticleButton, ParticleInput } from "@/components/ui/particle-ui"
import { ParticleCheckbox as Checkbox } from "@/components/ui/particle-ui"
import { ParticleTextarea as Textarea } from "@/components/ui/particle-ui"
import { OrganizationFormBuilder } from "@/features/organization-forms/client"
import type { ResearchResult } from "../research-types"
import { researchRemovalError, type createResearchDraft } from "../lib/research-draft"

import { ResearchBranchEditor } from "./research-branch-editor"

type EditableDraft = ReturnType<typeof createResearchDraft>
type Item = EditableDraft["items"][number]

export function ResearchDraftEditor({ draft, result, disabled, onChange }: {
  draft: EditableDraft; result: ResearchResult; disabled: boolean; onChange: (draft: EditableDraft) => void
}) {
  const id = useId()
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [undo, setUndo] = useState<{ draft: EditableDraft; key: string } | null>(null)
  useEffect(() => {
    if (!focusKey) return
    document.getElementById(`${id}-${focusKey}`)?.focus()
    setFocusKey(null)
  }, [draft, focusKey, id])
  const items = [...draft.items.filter(item => !draft.removedKeys.includes(item.key)), ...draft.addedItems]
  const candidates = [...result.items.filter(item => item.kind === "reference"), ...items]
  const change = (value: EditableDraft) => { setUndo(null); onChange(value) }
  const edit = (key: string, update: Partial<Item>) => change({ ...draft,
    items: draft.items.map(item => item.key === key ? { ...item, ...update } : item),
    addedItems: draft.addedItems.map(item => item.key === key ? { ...item, ...update } : item),
  })
  const remove = (key: string) => {
    setUndo({ draft, key })
    const original = result.items.find(item => item.key === key)
    onChange({ ...draft, removedKeys: original ? [...draft.removedKeys, key] : draft.removedKeys,
      items: draft.items.map(item => ({ ...item,
        // Removed copy is not applied; keep its required fields valid while hidden.
        ...(item.key === key && original ? { title: original.title, description: original.description } : {}),
        dependsOn: item.dependsOn.filter(parent => parent !== key),
      })),
      addedItems: draft.addedItems.filter(item => item.key !== key).map(item => ({ ...item, dependsOn: item.dependsOn.filter(parent => parent !== key) })),
    })
    setFocusKey("undo")
  }
  const add = () => {
    const key = `manual_${crypto.randomUUID().replaceAll("-", "")}`
    change({ ...draft, addedItems: [...draft.addedItems, { key, title: "", description: "", dependsOn: [] }] })
    setFocusKey(key)
  }
  return <fieldset disabled={disabled} className="particle-ui min-w-0 space-y-3">
    <ResearchOutputCoverage result={result} />
    <legend className="sr-only">Edit plan preview</legend>
    <label className="block space-y-1 text-xs">Plan title
      <ParticleInput size="2xl" value={draft.title} required maxLength={240}
        onChange={event => change({ ...draft, title: event.target.value })} />
    </label>
    <label htmlFor={`${id}-summary`} className="block space-y-1 text-xs">Summary
      <Textarea id={`${id}-summary`} value={draft.summary} rows={2} maxLength={1500} className="rounded-xl px-3 py-2 text-base"
        onChange={event => change({ ...draft, summary: event.target.value })} />
    </label>
    {items.map((item, index) => {
      const removalError = researchRemovalError({ ...result, decisions: [...(result.decisions ?? []).filter(decision => !draft.decisions.some(edit => edit.itemKey === decision.itemKey)), ...draft.decisions] }, item.key)
      return <div key={item.key} className="space-y-2 border-t border-border pt-3">
        <label className="block space-y-1 text-xs">Item {index + 1} title
          <ParticleInput id={`${id}-${item.key}`} size="2xl" value={item.title} required maxLength={result.items.find(value => value.key === item.key)?.kind === "data_view" ? 100 : 240}
            onChange={event => edit(item.key, { title: event.target.value })} />
        </label>
        <label htmlFor={`${id}-${item.key}-details`} className="block space-y-1 text-xs">Item {index + 1} details
          <Textarea id={`${id}-${item.key}-details`} value={item.description} rows={2} maxLength={1800} className="rounded-xl px-3 py-2 text-base"
            onChange={event => edit(item.key, { description: event.target.value })} />
        </label>
        {item.form && <OrganizationFormBuilder definition={item.form} disabled={disabled} onChange={form => edit(item.key, { form })} />}
        {candidates.length > 1 && <details className="text-xs">
          <summary className="min-h-11 cursor-pointer content-center rounded-lg px-2 focus-visible:outline-2 focus-visible:outline-ring">Prerequisites ({item.dependsOn.length})</summary>
          <div role="group" aria-label={`Prerequisites for item ${index + 1}`} className="space-y-1">
            <p className="px-2 text-muted-foreground">Complete these first.</p>
            {candidates.filter(candidate => candidate.key !== item.key).map(candidate => {
              const checked = item.dependsOn.includes(candidate.key)
              return <div key={candidate.key} className="min-h-11 content-center rounded-lg px-2 hover:bg-muted">
                <Checkbox label={<span className="min-w-0 break-words">{candidate.title || "Untitled item"}</span>} checked={checked} disabled={disabled || (!checked && item.dependsOn.length >= 8)}
                  onCheckedChange={value => edit(item.key, { dependsOn: value === true ? [...item.dependsOn, candidate.key] : item.dependsOn.filter(key => key !== candidate.key) })} />
              </div>
            })}
          </div>
        </details>}
        <ResearchBranchEditor decision={draft.decisions.find(decision => decision.itemKey === item.key)} candidates={candidates} disabled={disabled}
          onChange={decision => change({ ...draft, decisions: draft.decisions.map(value => value.itemKey === item.key ? decision : value) })} />
        <ParticleButton type="button" color="secondary" variant="ghost" className="min-h-11" disabled={disabled || !!removalError}
          aria-label={`Remove item ${index + 1}`} aria-describedby={removalError ? `${id}-${item.key}-reason` : undefined}
          onClick={() => remove(item.key)}>Remove</ParticleButton>
        {removalError && <p id={`${id}-${item.key}-reason`} className="text-xs text-muted-foreground">{removalError}</p>}
      </div>
    })}
    {undo && <div role="status" className="flex flex-wrap items-center gap-2 text-xs">
      <span>Item and its prerequisite links removed.</span>
      <ParticleButton id={`${id}-undo`} type="button" color="secondary" variant="ghost" className="min-h-11" disabled={disabled}
        onClick={() => { onChange(undo.draft); setFocusKey(undo.key); setUndo(null) }}>Undo removal</ParticleButton>
    </div>}
    <ParticleButton id={`${id}-add`} type="button" color="secondary" variant="outline" className="min-h-11" disabled={disabled || candidates.length >= 12}
      onClick={add}>Add item</ParticleButton>
    {candidates.length >= 12 && <p className="text-xs text-muted-foreground">This preview holds up to twelve items.</p>}
  </fieldset>
}
