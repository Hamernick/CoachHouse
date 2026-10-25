# Workspace Node Frame Contract

This contract defines the visual and ownership pattern for cards rendered as nodes on the Organization Workspace React Flow canvas.

The goal is to make workspace nodes easy for an engineer or AI agent to identify, modify, and extend without guessing whether the correct owner is a shared primitive, a React Flow node wrapper, or feature content.

## Current Transitional State

The workspace canvas currently has mixed node shells:

- Generic workspace nodes use `WorkspaceBoardCardFrame`, built from `Frame`, `FramePanel`, `FrameHeader`, `FrameBody`, and optional `FrameFooter`.
- `accelerator` uses a card-style shell in `WorkspaceBoardAcceleratorCard`.
- `fiscal-sponsorship` uses a card-style shell in `FiscalSponsorshipPanel` when rendered as `surface="workspace-card"`.
- `organization-overview` uses a card-style shell in `WorkspaceBoardOrganizationCardShell`.

This mixed state is allowed only as a transition. Do not add new one-off canvas node shells.

## Target Pattern

The target product-level abstraction is `WorkspaceNodeFrame`.

`WorkspaceNodeFrame` should use lower-level UI primitives internally, but it owns the canvas node visual convention:

```tsx
<WorkspaceNodeFrame cardId="organization-overview" title="Organization">
  <WorkspaceNodeFrame.Body>
    <OrganizationOverviewBody />
  </WorkspaceNodeFrame.Body>
  <WorkspaceNodeFrame.Footer>
    <WorkspaceNodeProgress />
  </WorkspaceNodeFrame.Footer>
</WorkspaceNodeFrame>
```

Required anatomy:

- **Root shell:** muted rounded workspace node surface.
- **Header:** title, status/meta, and header-only actions.
- **Body:** primary card content inside the inset content surface.
- **Footer:** progress, summaries, and primary/secondary action buttons.

The title belongs in the header. Primary content belongs in the body. Progress and action rows belong in the footer unless they are truly header metadata.

## Spacing Rules


- The workspace node root owns the outer card rhythm.
- The body content should sit in an inset panel.
- Header, body, and footer gaps must be visually balanced.
- If a node has no footer, the bottom gutter must still intentionally balance the shell.
- Do not leave a no-footer node with a collapsed bottom gap just because `CardContent` or `FrameBody` defaults to `pb-0`.
- Child radius must be less than or equal to parent radius.
- Avoid nested floating card stacks. Use the inset body panel for the main content surface.

### Particle editor window standard

- Preset configuration fields belong inside the same Particle card as its interactive content. Do not place fields beside a separate preview card. Use the card’s optional editorFields slot, including Event and Image placeholders; canvas/library rendering omits that slot. Keep one card, a bounded responsive width, and one outer scroll region. Adding editorFields must not remove or flatten its existing card header, muted outer frame, inset body, or concentric radii. Window header ownership does not replace the card’s own anatomy.

- Do not add blanket Particle status badges or Backlog/status selectors to cards or editors. Preserve stored status and task-specific checklist behavior without generic status chrome.

- All Particle preset editors and metadata inspectors use `ParticleEditorHeader` from `src/features/workspace-particles/components/particle-editor-header.tsx`. The canvas card's own header is a separate surface.
- Inside a workspace content window, route the editor title and Back control through `WorkspaceWindowHeaderPortal slot="title"`; route editor actions through its actions slot. Do not add another heading/action row inside the editor body. Use the shared compact action class (28px desktop, 44px touch).
- Keep editor state and handlers with the editor. A portalled submit button must use `form={formId}` referencing its owning form so native validation, keyboard submission and save guards still work. Back keeps unsaved-draft confirmation and pending protection.
- Preset draft Back uses `ParticleDraftBackButton` with the shared shadcn AlertDialog: Keep editing / Discard draft, cancel-first focus and Escape behavior. Do not replace this in-app guard with `window.confirm`. Browser tab-close/refresh protection remains a separate browser-controlled `beforeunload` guard.
- Library layout switches belong to browsing only. `ParticleLibrary` owns their conditional portal: render while browsing, remove while configuring a preset. Its retained-panel header scope hides them when another tab or a Particle inspector is active. Do not mount these switches independently at the dock/window level.
- Only standalone editors without a window header may render an inline header. Enabled but not-yet-mounted header targets must not flash inline controls; inactive retained editors must not publish header content.
- Use `tests/acceptance/particle-editor-header.test.ts` and `workspace-window-header.test.ts` when changing this ownership. Preserve all presets and responsive/mobile behavior; a new preset must inherit this rule rather than add its own header.


## React Flow Boundary

React Flow owns canvas behavior:

- node and edge state
- positions and layout reconciliation
- drag behavior
- selection/connectability
- handles
- viewport commands
- node measurement and `useUpdateNodeInternals`

The workspace node shell owns visual structure only:

- root shell chrome
- header/body/footer anatomy
- internal spacing
- drag-handle class placement
- `nodrag` / `nopan` boundaries around interactive content

Do not move React Flow state, edge logic, handle IDs, viewport commands, or node persistence into the visual shell.

## React Flow Practices To Preserve

- Keep `nodeTypes` and `edgeTypes` stable, outside render or memoized.
- Keep custom node components memoized when they receive React Flow node props.
- Keep handles rendered through React Flow `Handle` components.
- Keep handles outside clipped or scrollable content.
- Use `.workspace-card-drag-handle` for draggable card regions.
- Use `nodrag` and `nopan` on buttons, menus, inputs, drawers, and other interactive regions inside a node.
- Use `nowheel` on scrollable regions that should not zoom the canvas.
- When dynamic node content changes size, keep the `useUpdateNodeInternals` sync path intact.

Reference docs:

- React Flow custom nodes: https://reactflow.dev/learn/customization/custom-nodes
- React Flow handles: https://reactflow.dev/learn/customization/handles
- React Flow performance: https://reactflow.dev/learn/advanced-use/performance
- React Flow utility classes: https://reactflow.dev/learn/customization/utility-classes

## Ownership Rules

When changing a workspace canvas node:

1. Identify the React Flow wrapper first.
2. Identify the workspace node shell.
3. Identify the feature body/footer owner.
4. Patch the highest valid owner.

Examples:

- Node position persistence belongs to workspace board state/persistence, not the visual shell.
- Handles and connections belong to the React Flow node wrapper and connection helpers, not feature body content.
- Header/body/footer spacing belongs to the workspace node shell.
- Checklist row, document row, or fiscal step behavior belongs to the feature component that renders that content.

## Anti-Patterns

Do not:

- Create a new one-off canvas node shell by importing `Card` or raw `Frame` directly into a feature component.
- Put the title in the body because it is easier to align.
- Put footer actions in the body because the footer is missing.
- Fix a React Flow drag/edge/persistence bug by changing card padding.
- Fix a visual shell bug by changing React Flow node state.
- Apply `overflow-hidden` to a shell if it clips handles, focus rings, or callout surfaces.
- Add broad `transition-all` or layout animations to node shell dimensions.
- Edit shared UI primitives when the bug belongs to a workspace-node owner.

## Migration Order

Migrate existing nodes only in small visual-neutral slices:

1. `organization-overview`
2. `accelerator`
3. `fiscal-sponsorship`
4. generic `WorkspaceBoardCardFrame` nodes

Each migration must preserve:

- current canvas node dimensions
- React Flow handles
- drag-handle behavior
- `nodrag` / `nopan` behavior
- visible content ordering
- existing focused acceptance tests

## Guardrail Expectations

Tests should enforce:

- header renders before body
- body renders before footer when footer exists
- no-footer body spacing remains intentional
- React Flow handles stay outside visual card content
- visual shells do not import React Flow state APIs
- feature body components do not own workspace shell chrome
