/* eslint-disable react/no-children-prop -- SSR fixtures compose shared header contexts. */
import { Children, createElement, isValidElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createPortal } from "react-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  WorkspaceWindowHeaderProvider,
  WorkspaceWindowHeaderScope,
} from "@/components/workspace/workspace-window-header-slots"
import { ParticlePresetEditor } from "@/features/workspace-particles/components/particle-preset-editor"
import { ParticleDraftBackButton } from "@/features/workspace-particles/components/particle-draft-back-button"
import { ParticleLibrary } from "@/features/workspace-particles/components/particle-library"
import { PARTICLE_PRESETS } from "@/features/workspace-particles/lib/particle-presets"
import { WORKSPACE } from "./fixtures/particle-fixtures"

vi.mock("react-dom", async (original) => ({
  ...(await original<typeof import("react-dom")>()),
  // Portals are captured; their markup is intentionally absent from the body.
  createPortal: vi.fn(() => null),
}))
const targets = {
  actions: { id: "actions" } as HTMLDivElement,
  accessory: { id: "accessory" } as HTMLDivElement,
  title: { id: "title" } as HTMLDivElement,
}
function hosted(children: ReactNode, active = true, mounted = true) {
  return createElement(WorkspaceWindowHeaderProvider, {
    enabled: true,
    actions: mounted ? targets.actions : null,
    accessory: mounted ? targets.accessory : null,
    title: mounted ? targets.title : null,
    children: createElement(WorkspaceWindowHeaderScope, { active, children }),
  })
}
function slot(target: HTMLDivElement) {
  return vi
    .mocked(createPortal)
    .mock.calls.filter(([, container]) => container === target)
    .map(([children]) => renderToStaticMarkup(children))
    .join("")
}
const props = {
  workspaceId: WORKSPACE,
  disabled: false,
  pending: false,
  error: null,
  onRetry: vi.fn(),
  onBack: vi.fn(),
  onAdd: vi.fn(async () => true),
}
beforeEach(() => vi.clearAllMocks())

function findDraftAction(node: ReactNode, label: string): {
  disabled?: boolean
  onClick?: (event: { preventDefault: () => void }) => void
} | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{
      children?: ReactNode; "aria-label"?: string; disabled?: boolean;
      onClick?: (event: { preventDefault: () => void }) => void
    }>(child)) continue
    if (child.props["aria-label"] === label || child.props.children === label) return child.props
    const found = findDraftAction(child.props.children, label)
    if (found) return found
  }
}

describe("Particle draft discard guard", () => {
  it.each([false, true])("dirty=%s opens confirmation only for an unsaved draft", (dirty) => {
    const onBack = vi.fn(), preventDefault = vi.fn()
    const view = ParticleDraftBackButton({ dirty, pending: false, onBack })
    findDraftAction(view, "Back to Particles")?.onClick?.({ preventDefault })
    expect(onBack).toHaveBeenCalledTimes(dirty ? 0 : 1)
    expect(preventDefault).toHaveBeenCalledTimes(dirty ? 0 : 1)
    expect(findDraftAction(view, "Keep editing")?.onClick).toBeUndefined()
  })
  it("discards only after explicit confirmation", () => {
    const onBack = vi.fn()
    const view = ParticleDraftBackButton({ dirty: true, pending: false, onBack })
    expect(onBack).not.toHaveBeenCalled()
    findDraftAction(view, "Discard draft")?.onClick?.({ preventDefault: vi.fn() })
    expect(onBack).toHaveBeenCalledExactlyOnceWith()
  })
  it("cannot leave through Back or Discard while a save is pending", () => {
    const onBack = vi.fn(), preventDefault = vi.fn()
    const view = ParticleDraftBackButton({ dirty: true, pending: true, onBack })
    for (const label of ["Back to Particles", "Discard draft"]) {
      const action = findDraftAction(view, label)
      expect(action?.disabled).toBe(true)
      action?.onClick?.({ preventDefault })
    }
    expect(preventDefault).toHaveBeenCalledTimes(2)
    expect(onBack).not.toHaveBeenCalled()
  })
})

describe("Particle editor header standard", () => {
  it.each(PARTICLE_PRESETS)(
    "routes $label title, Back and Add to the window slots with native form association",
    (preset) => {
      const body = renderToStaticMarkup(
        hosted(createElement(ParticlePresetEditor, { ...props, preset }))
      )
      const title = slot(targets.title),
        actions = slot(targets.actions)
      expect(title).toContain(preset.label)
      expect(title).toContain('aria-label="Back to Particles"')
      expect(actions).toContain('aria-label="Add to canvas"')
      expect(actions).toContain('type="submit"')
      const formId = /<form[^>]*\sid="([^"]+)"/.exec(body)?.[1]
      expect(formId).toBeTruthy()
      expect(actions).toContain(`form="${formId}"`)
      expect(body).not.toContain('aria-label="Back to Particles"')
      expect(body).not.toContain('aria-label="Add to canvas"')
      expect(body).not.toContain('aria-label="Particle display"')
      const cardStart = body.indexOf('<article')
      const cardEnd = body.indexOf('</article>', cardStart)
      expect(cardStart).toBeGreaterThan(-1)
      expect(body.match(/data-particle-frame="true"/g)).toHaveLength(1)
      const fieldStart = body.indexOf('data-slot="field-group"')
      expect(fieldStart).toBeGreaterThan(cardStart)
      expect(fieldStart).toBeLessThan(cardEnd)
      if (preset.id !== "image") {
        const headerStart = body.indexOf('data-workspace-node-part="header"', cardStart)
        const bodyStart = body.indexOf('data-workspace-node-part="body"', cardStart)
        expect(headerStart).toBeGreaterThan(cardStart)
        expect(bodyStart).toBeGreaterThan(headerStart)
        expect(fieldStart).toBeGreaterThan(bodyStart)
      }
      if (preset.id === "form") {
        const titleInput = body.match(/<input[^>]*placeholder="Name this form\.\.\."[^>]*>/)?.[0]
        expect(titleInput).toBeTruthy()
        expect(titleInput).toContain('value=""')
        const formHeader = body.slice(body.indexOf('<header', cardStart), body.indexOf('</header>', cardStart))
        expect(formHeader).toContain('Private draft')
        expect(formHeader).toContain('0 questions')
        expect(formHeader).toContain('>Edit</button>')
        expect(formHeader).toContain('>Preview</button>')
        expect(body.match(/>Preview<\/button>/g)).toHaveLength(1)
        expect(body).not.toContain('Edit form')
        expect(body).not.toContain('Add your first question.')
        expect(body).not.toContain('Drive sync aren’t connected yet.')
        expect(actions).toContain('disabled=""')
      }
      expect(props.onAdd).not.toHaveBeenCalled()
    }
  )
  it.each([
    [false, true],
    [true, false],
  ])(
    "never flashes editor chrome in inactive or unmounted header slots",
    (active, mounted) => {
      const body = renderToStaticMarkup(
        hosted(
          createElement(ParticlePresetEditor, {
            ...props,
            preset: PARTICLE_PRESETS[0],
          }),
          active,
          mounted
        )
      )
      expect(createPortal).not.toHaveBeenCalled()
      expect(body).not.toContain('aria-label="Add to canvas"')
      expect(body).not.toContain('aria-label="Back to Particles"')
      expect(body).toContain('aria-label="Configure')
    }
  )
  it("preserves pending guards on portalled controls", () => {
    renderToStaticMarkup(
      hosted(
        createElement(ParticlePresetEditor, {
          ...props,
          preset: PARTICLE_PRESETS[0],
          pending: true,
        })
      )
    )
    expect(slot(targets.title)).toContain('disabled=""')
    expect(slot(targets.actions)).toContain('disabled=""')
    expect(slot(targets.actions)).toContain('aria-label="Adding to canvas"')
  })
  it("retains one inline header when used outside a workspace window", () => {
    const body = renderToStaticMarkup(
      createElement(ParticlePresetEditor, {
        ...props,
        preset: PARTICLE_PRESETS[0],
      })
    )
    expect(body).toContain('aria-label="Back to Particles"')
    expect(body).toContain('aria-label="Add to canvas"')
    expect(body.match(/<h2[ >]/g)).toHaveLength(1)
    expect(createPortal).not.toHaveBeenCalled()
  })
  it.each([true, false])(
    "does not reserve header actions for library views: active=%s",
    (active) => {
      const body = renderToStaticMarkup(
        hosted(
          createElement(ParticleLibrary, {
            particles: [],
            editable: true,
            canEdit: true,
            pending: false,
            error: null,
            onRetry: vi.fn(),
            onCreate: vi.fn(async () => true),
          }),
          active
        )
      )
      expect(body).not.toContain('aria-label="Particle display"')
      expect(createPortal).not.toHaveBeenCalled()
    }
  )
})
