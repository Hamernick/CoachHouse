"use client"

import { defineRegistry, JSONUIProvider, Renderer, type ComponentContext } from "@json-render/react"
import { OrganizationFormBuilder } from "@/features/organization-forms/client"
import { PROJECT_DATA_VIEW_COLUMNS } from "@/features/workspace-data-views"
import { projectIncomingResearchPresentation, projectResearchPresentation, researchPresentationEnabled, researchRenderCatalog, validateResearchPresentation, type ResearchPlanContext } from "../lib/research-presentation"
import type { ResearchResult } from "../research-types"
import type { ResearchItemPreview } from "../lib/research-item-preview"

const ItemContent = ({ props }: { props: ComponentContext<typeof researchRenderCatalog, "PlanItem">["props"] }) =>
  <>
    <span className="font-medium">{props.title}</span>
    {props.membership && <span className="ml-2 text-xs text-muted-foreground">{props.membership}</span>}
    {props.content !== null && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{props.content}</p>}
    {props.prerequisites && <p className="text-xs text-muted-foreground">{props.prerequisites}</p>}
    {props.outcomes.map(outcome => <p key={outcome.key} className="text-xs text-muted-foreground"><span className="font-medium">{outcome.label}</span>: {outcome.next}</p>)}
  </>
const NoteOrWorkItem = ({ props }: { props: ComponentContext<typeof researchRenderCatalog, "PlanItem">["props"] }) =>
  <li className="break-words"><ItemContent props={props} /></li>

const { registry } = defineRegistry(researchRenderCatalog, { components: {
  PlanRows: ({ props, children }) => <ul aria-label={props.label} className="space-y-2 text-sm">{children}</ul>,
  PlanItem: NoteOrWorkItem, WorkspaceNote: NoteOrWorkItem,
  WorkspaceForm: ({ props }) => <li className="space-y-2 break-words">
    <ItemContent props={props} />
    <OrganizationFormBuilder definition={props.definition} disabled preview showPreviewControl={false} onChange={() => {}} />
  </li>,
  ProjectDataView: ({ props }) => <li className="space-y-2 break-words">
    <ItemContent props={props} />
    {props.sourceName && <p className="text-xs">Source: {props.sourceName}</p>}
    <p className="text-xs text-muted-foreground">{props.source.kind==="projects"?"Existing projects · sorted by Project":props.source.kind==="responses"?"Existing native response source · default saved view":"Existing shared table · default saved view"} · no copied records</p>
    {props.source.kind==="projects" && <dl aria-label="Declared data view columns" className="grid grid-cols-2 gap-1 text-xs">
      {PROJECT_DATA_VIEW_COLUMNS.map(column => <div key={column.key}><dt className="font-medium">{column.label}</dt><dd>{column.writable ? "Editable at source" : "Read only"}</dd></div>)}
    </dl>}
    <p className="text-xs text-muted-foreground">Records and counts load only after saving and opening the authorized source. No view has been created by this preview.</p>
  </li>,
} })
const unavailable = <p role="alert" className="text-sm text-destructive">This plan preview is unavailable. Reopen the saved research.</p>

/** Preview cannot call a canonical writer. The existing editor and explicit
 * save/recovery flow remain outside the renderer and retain their identities. */
export function ResearchPresentation({ value }: { value: unknown }) {
  let presentation
  try { presentation = validateResearchPresentation(value) }
  catch { return unavailable }
  return <JSONUIProvider registry={registry} initialState={{}} handlers={{}}>
    <Renderer spec={presentation.spec} registry={registry} fallback={() => unavailable} />
  </JSONUIProvider>
}

export function ResearchPlanPresentation({ result, plan }: { result: ResearchResult; plan?: ResearchPlanContext }) {
  let value
  try { value = projectResearchPresentation(result, plan) }
  catch { return unavailable }
  return <ResearchPresentation value={value} />
}

export function IncomingResearchPresentation({ items }: { items: ResearchItemPreview[] }) {
  let value
  try { value = projectIncomingResearchPresentation(items) }
  catch { return unavailable }
  return <ResearchPresentation value={value} />
}

export function IncomingResearchPreview({ items }: { items: ResearchItemPreview[] }) {
  if (!researchPresentationEnabled && items.some(item => item.kind === "form" || item.kind === "data_view")) return unavailable
  return researchPresentationEnabled ? <IncomingResearchPresentation items={items} /> :
    <ul aria-label="Incoming plan items" className="space-y-2 text-sm">{items.map(item => <li key={item.key} className="break-words">
      <span className="font-medium">{item.title}</span>
      <p className="text-xs text-muted-foreground">{item.description}</p>
    </li>)}</ul>
}
