# PRD — Coach House Particle System

**Implementation brief for Codex**

**Priority:** High  
**Application:** Existing Coach House workspace  
**Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, React Flow  
**Feature:** Interactive, composable, AI-ready workspace canvas

---

## 1. Mission

Implement a reusable **Particle System** inside the existing Coach House workspace.

A Particle is a structured, interactive component representing an element of an organization's work: an objective, activity, decision, group of people, content calendar, workflow, financial resource, or measurable outcome.

Particles connect to form an editable decision tree that makes an organization's goals, resources, activities, and decisions visible and actionable.

The canvas should eventually support AI-generated workflows, but this implementation must first establish a robust, production-quality component system and graph architecture.

**Core principle:** The workspace is not merely a diagram. Particles are interactive representations of actual application data and actions.

### Instructions to Codex

1. Inspect the existing repository, workspace implementation, database architecture, styling, and dependencies before changing anything.
2. Reuse the existing architecture, state management, authentication, persistence, and multiplayer infrastructure where available.
3. Do not create a standalone application or duplicate the existing workspace.
4. Implement this as a reusable feature, not a hardcoded event-series prototype.
5. Preserve existing workspace functionality and data.
6. Use strict TypeScript, modular components, shared contracts, and production-quality error handling.
7. Implement and test the feature rather than stopping after writing an implementation plan.

---

## 2. Product Architecture

The hierarchy is:

```text
Organization
  └── Workspace
       ├── Particles
       │    ├── Objective
       │    ├── Activity
       │    ├── Content Calendar
       │    ├── People
       │    ├── Decision
       │    ├── Metric
       │    ├── Workflow
       │    └── Finance
       ├── Connections
       └── Floating Workspace Interface
            ├── Navigation
            ├── Particle Inspector
            └── Chat Composer
```

The workspace is an editable React Flow canvas associated with an organization.

Every Particle has a unique ID, type, configuration, data payload, status, graph position, and optional connections.

A Particle can contain multiple child records without turning those records into separate canvas Particles.

**Example:** A Content Calendar Particle contains 15 posts and emails. The canvas displays one Particle, not 15 individual cards.

---

## 3. Core Particle Types

Implement the following eight types as the initial extensible registry.

| Particle | Purpose | Specialized UI |
|---|---|---|
| Objective | Define outcomes and goals | Targets, progress, related work |
| Activity | Represent executable work or events | Checklist, activity source, status |
| Content Calendar | Manage scheduled communications | Compact chronological list |
| People | Represent contacts, teams, audiences, or intake | Records, avatars, counts, segments |
| Decision | Evaluate criteria and branch into outcomes | Conditions, Yes/No or custom outcomes |
| Metric | Visualize measurable results | KPIs, progress, charts |
| Workflow | Represent multistep processes | Ordered steps, completion, dependencies |
| Finance | Represent financial goals, budgets, or resources | Currency, progress, charts |

These are **domain component types**, not eight unrelated card designs.

Do not create a separate Particle type for every possible activity or integration.

An event, for example, is an Activity Particle configured with an event-specific template.

An email or LinkedIn post is a Content Calendar entry rather than a standalone Particle by default.

The registry must support additional types without rewriting the canvas architecture.

---

## 4. Shared Particle Design System

Use the supplied Fiscal Sponsorship screenshot as the primary design reference.

The visual language should resemble a well-designed shadcn Card composed of compact shadcn Item-like rows.

Every Particle uses the same underlying structure:

```text
┌─────────────────────────────────┐
│ [Icon] Title           [Status] │
│        Type                     │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Summary          Progress   │ │
│ │ ███████░░░░░░░░░░░░░       │ │
│ │                             │ │
│ │ Specialized content         │ │
│ │ Rows / charts / checklist   │ │
│ └─────────────────────────────┘ │
│                                 │
│ Supporting info      [Action]  │
└─────────────────────────────────┘
```

### 4.1 Shared components

Create:

- `ParticleFrame`
- `ParticleHeader`
- `ParticleBody`
- `ParticleFooter`
- `ParticleStatus`
- `ParticleProgress`
- `ParticleListItem`
- `ParticleHandle`
- `ParticleRegistry`

The frame handles selection, border, radius, shadow, padding, drag behavior, and theming.

Type-specific components render only the contents.

### 4.2 Header

Each Particle displays:

- Icon or initials avatar, left.
- Title and concise type label.
- Status badge, top right.

Statuses:

- Backlog
- In progress
- Done
- Blocked

Use a small neutral badge with a semantic status indicator.

Do not use large colorful banners.

### 4.3 Body

Use a slightly differentiated inner surface for structured content.

Permitted elements include:

- Compact shadcn-style list rows
- Progress indicators
- Status icons
- Small icons or avatars
- Compact metric summaries
- Charts where meaningful
- Nested records
- Checklists
- Inline actions

Avoid unnecessary gaps between adjacent elements.

Do not apply identical body templates to fundamentally different data types.

### 4.4 Footer

Optional supporting text aligned left and one primary contextual action aligned right.

Examples:

- Open activity
- View people
- Open calendar
- Review decision
- View finances

No generic buttons that do nothing.

### 4.5 Sizing

Default Particle width: approximately 280 px.

Calendar and complex workflow Particles may use approximately 320–340 px.

Particle height must be content-driven.

Do not use fixed heights for records with variable-length content.

Use an internal scrollable area or a collapsed summary when records exceed a reasonable preview limit.

The full Particle content belongs in the inspector.

---

## 5. Visual Design & Theme Compatibility

Implement using existing shadcn/ui components and semantic Tailwind tokens.

Prefer:

- `bg-card`
- `text-card-foreground`
- `bg-muted`
- `text-muted-foreground`
- `border-border`
- `bg-accent`
- `text-accent-foreground`
- `ring-ring`

Use the existing application theme provider.

All Particles, handles, connections, charts, tooltips, drawers, and navigation controls must work in light and dark mode.

Do not hardcode white backgrounds, black text, or theme-incompatible colors.

Use status colors sparingly and preserve contrast.

### Dark-mode reference

The supplied Fiscal Sponsorship screenshot demonstrates the target visual hierarchy:

- Dark outer Particle frame
- Slightly darker inner structured surface
- Subtle borders
- Rounded corners
- Compact list items
- Icon containers
- Clear status indicators
- Progress visualization
- Actions integrated into the card

Recreate that hierarchy through theme tokens rather than copying its exact colors.

### Charts

Use shadcn's Chart components with Recharts.

Use charts only when they add information.

Examples:

- Attendees vs. target: progress bar
- Attendance across events: bar chart
- Revenue over time: line chart
- Budget allocation: suitable comparison visualization
- Goal completion: compact progress indicator

Charts must have responsive containers, meaningful labels, accessible descriptions, and theme-aware colors.

No placeholder charts presenting fabricated data as real results.

---

## 6. Particle Contracts & TypeScript

Use a strict discriminated union for type-specific payloads.

Illustrative contract:

```typescript
type ParticleType =
  | "objective"
  | "activity"
  | "calendar"
  | "people"
  | "decision"
  | "metric"
  | "workflow"
  | "finance";

type ParticleStatus =
  | "backlog"
  | "in_progress"
  | "done"
  | "blocked";

interface ParticleBase {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: ParticleStatus;
  position: {
    x: number;
    y: number;
  };
  locked?: boolean;
  createdAt: string;
  updatedAt: string;
}

type Particle =
  | (ParticleBase & {
      type: "objective";
      data: ObjectiveData;
    })
  | (ParticleBase & {
      type: "activity";
      data: ActivityData;
    })
  | (ParticleBase & {
      type: "calendar";
      data: CalendarData;
    })
  | (ParticleBase & {
      type: "people";
      data: PeopleData;
    })
  | (ParticleBase & {
      type: "decision";
      data: DecisionData;
    })
  | (ParticleBase & {
      type: "metric";
      data: MetricData;
    })
  | (ParticleBase & {
      type: "workflow";
      data: WorkflowData;
    })
  | (ParticleBase & {
      type: "finance";
      data: FinanceData;
    });
```

Define each payload separately.

Use Zod or the validation library already established in the repository for runtime validation.

Do not use `any`, fragile type assertions, or a generic `Record<string, unknown>` as a substitute for defined domain contracts.

### Registry

Define a typed Particle registry containing:

- Type identifier
- Display name
- Icon
- Component
- Data validator
- Default factory
- Available actions
- Input/output handles
- Optional inspector component

Keep this registry outside React render functions.

Adding a new Particle type should require registering a new renderer and schema—not modifying large conditional chains throughout the application.

### React Flow compatibility

Keep domain-level `Particle` data distinct from React Flow's rendering-specific `Node` and `Edge` types.

Create explicit adapter functions between persisted domain records and React Flow elements.

Use **Particle** consistently in product-facing labels and interfaces. React Flow's underlying `Node` terminology is acceptable inside framework-specific code.

---

## 7. Graph Model & Connections

Connections represent relationships between Particles.

Supported initial relationship semantics:

- Dependency
- Sequence
- Decision outcome
- Related resource

A connection must have a persistent ID, source ID, target ID, relationship type, and optional source/target handle IDs or outcome label.

Decision connections may specify an outcome such as `yes`, `no`, or another validated value.

Connections must not be inferred from screen position.

### Behaviors

- Select a Particle.
- Drag a Particle to reposition it.
- Connect compatible Particles.
- Disconnect or delete a connection.
- Edit a Particle without breaking connections.
- Add a Particle before or after an existing step.
- Persist graph modifications.
- Undo and redo supported graph changes.

Use connection validation to reject invalid edges.

For dependency and sequence relationships, detect cycles. Explicitly modeled feedback loops may be permitted but must not break automatic layout or execution semantics.

Do not automatically execute workflows simply because two Particles are connected.

---

## 8. Layout Engine — Hierarchical Decision Tree

**This is a critical requirement.**

The previous layout felt like unrelated cards placed on a canvas.

The new layout must visually resemble tree roots:

- One primary objective
- Multiple meaningful branches
- Progressive dependencies
- Decision splits
- Branches that later converge
- Deliberate spacing and routing

### Technology

Use **ELKjs** with React Flow.

Prefer the layered layout algorithm with left-to-right direction and orthogonal edge routing.

ELKjs should calculate positions from the actual graph structure, not from manually assigned semantic lane coordinates.

Use actual measured Particle dimensions when calculating layout.

### Layout requirements

1. Primary objective begins at the left.
2. Dependent Particles advance to the right.
3. Parallel workstreams branch vertically.
4. Decision outcomes visibly split.
5. Related branches may converge.
6. Layout avoids overlapping Particles and excessive edge crossings.
7. Edges use rounded orthogonal routes.
8. Branch spacing remains consistent.
9. Calendar Particles with different heights are accommodated.
10. Feedback loops use intentional routed edges rather than distorting the tree.

Use stable ordering to avoid visually reshuffling the entire canvas after small edits.

Support a clear **Auto-layout** action.

### Manual positioning

The user may drag Particles freely.

Manual positions should persist and must not be overwritten automatically on every render or data update.

Auto-layout is a deliberate operation, except during initial generation of a graph that has no saved positions.

When adding new Particles, calculate sensible initial placement relative to the parent without resetting unrelated manual positions.

### React Flow best practices

Use `@xyflow/react`.

- Custom Particle renderers registered through `nodeTypes`
- Stable memoized components
- Explicit typed edges
- React Flow handles for connections
- Measured node dimensions and handle updates
- Built-in viewport transformation
- React Flow selection and drag events
- `ReactFlowProvider` where required

Avoid implementing a second independent pan/zoom system.

Do not draw connectors through ad hoc DOM measurements or manually managed SVG overlays when React Flow can manage them.

---

## 9. Content Calendar Particle

The Content Calendar is a specialized Particle containing many scheduled content records.

**Posts, newsletters, articles, and emails belong together.**

Example:

```text
Content Calendar
──────────────────────────────
W1 Tue   LinkedIn · The idea
W1 Auto  Email · You're in
W1 Thu   LinkedIn · Relationships
W2 Thu   Article · Our community
W3 Mon   LinkedIn · Final reminder
W4 Auto  Email · Event reminder
──────────────────────────────
8 items              2 complete
```

### Requirements

Each record supports:

- ID
- Title
- Channel or channels
- Content type
- Scheduled date/time
- Draft content
- CTA
- Status
- Optional external URL
- Optional linked activity/event
- Optional actual publish timestamp

The calendar preview shows only compact chronological rows.

Each row displays a date, title, channel icon, and status.

Use appropriate channel logos or accessible icons.

Clicking a row opens that record in the floating inspector.

The user can edit the record without leaving the canvas.

Show a completion summary and progress bar at the top.

Support adding, editing, reordering, and removing entries.

Represent automatic messages distinctly from scheduled manual posts.

Do not assume that a scheduled item has been published or sent.

Actual publishing/sending requires a real provider integration.

---

## 10. Interactive Workflows

Activity and Workflow Particles contain editable checklist items.

Each step has an ID, title, status, order, and optional associated action or resource.

Clicking a checklist row can update its completion state.

Persist the update.

Progress should be derived from actual checklist states:

```text
completedSteps / totalSteps × 100
```

Handle empty checklists correctly.

Never hardcode displayed progress percentages independently of their underlying data.

A workflow may reference other Particles.

Do not duplicate those referenced objects as independent conflicting records.

---

## 11. Decision Particles

Decision Particles evaluate explicit criteria and lead to labeled outcomes.

Example:

```text
Is the event ready?
──────────────────────
○ Venue confirmed
○ Audience mix
○ Guest count

[Yes] [Not yet]
```

A user can choose an outcome.

Selecting an outcome should:

- Record the decision.
- Persist the selected result.
- Highlight the corresponding graph branch.
- Optionally navigate to the connected Particle.

It must not silently mark requirements complete.

Decision conditions and actions should be data-driven.

Do not use hardcoded JavaScript branches for particular example workflows.

---

## 12. Floating Workspace Interface

Preserve the established Apple Maps / Find My-inspired floating interface.

It should be **one expandable component**, not a separate sidebar or detached drawer.

Maximum width: approximately 650 px on desktop, constrained to viewport width on mobile.

Position: horizontally centered near the bottom of the canvas.

### Collapsed state

```text
┌──────────────────────────────────────────┐
│                  ━━━                     │
│ Organization Finance People ...    [⌄]  │
│                                          │
│ [+] Ask or add to the plan…        [↑]  │
└──────────────────────────────────────────┘
```

Navigation order:

Organization, Finance, People, Documents, Tools, Accelerator.

Tabs should be compact, left-aligned, and content-sized.

Do not distribute them across the full width.

The expand/collapse button must be vertically centered.

Remove any logo, profile avatar, product name, or subtitle from this bar.

No back-to-start, phase navigation, zoom controls, percentage indicator, or additional top toolbar.

### Expanded states

The same container expands upward.

Support:

- Collapsed
- Half-open
- Fully expanded

Users may change states using the expand button or by dragging the handle.

The navigation and chat composer remain integrated into the same parent component.

The content inspector occupies the expandable region.

### Selection behavior

Clicking a Particle automatically opens the inspector at half-height and displays that Particle.

Clicking a calendar entry opens the specific entry.

The inspector includes:

- Title
- Description
- Relevant details
- Content
- Contextual actions
- Edit and copy controls

Do not include a **Next steps** section or generic inspector header labeled “Node details.”

Avoid duplicating information already clearly visible.

### Chat composer

OpenAI-style input:

- Plus icon on the left
- Multiline input
- Up-arrow submit on the right

Support explicit operations such as creating, updating, and linking Particles.

Connect to the application's existing AI infrastructure if one exists.

If AI generation is not available, implement a real command/action interface rather than pretending freeform text was interpreted by AI.

Never create arbitrary Particles from unmatched input without a clearly defined fallback or user confirmation.

---

## 13. State Management & Persistence

Reuse the existing workspace persistence system.

If the application already uses Supabase, workspace tables, realtime subscriptions, or a collaboration layer, integrate with those rather than creating a parallel data system.

Persist:

- Particle records and type-specific payloads
- Connections
- Positions
- Calendar entries
- Workflow steps and statuses
- Decision selections
- Workspace-level preferences

Suggested conceptual entities:

```text
workspaces
particles
particle_connections
particle_calendar_entries
particle_workflow_steps
```

These are conceptual boundaries, not mandatory new database tables.

Inspect the current schema before choosing relational tables versus validated JSONB payloads.

### Rules

- Workspace- and organization-scoped authorization
- Stable UUIDs
- Runtime validation
- Optimistic updates where appropriate
- Debounced position persistence
- Clear loading and error states
- Transactional multi-record changes
- Safe deletion and connection cleanup
- No loss of existing workspace data

If multiplayer editing already exists, preserve it and integrate changes into its shared state.

Handle concurrent edits consistently rather than implementing a second competing source of truth.

---

## 14. Recommended Component Structure

Adapt to the existing repository conventions.

```text
components/
  workspace/
    particle-canvas/
      particle-canvas.tsx
      particle-registry.ts
      particle-types.ts
      particle-schema.ts

      particles/
        particle-frame.tsx
        particle-header.tsx
        particle-body.tsx
        particle-footer.tsx
        particle-status.tsx
        particle-progress.tsx
        particle-list-item.tsx

        objective-particle.tsx
        activity-particle.tsx
        calendar-particle.tsx
        people-particle.tsx
        decision-particle.tsx
        metric-particle.tsx
        workflow-particle.tsx
        finance-particle.tsx

      graph/
        graph-adapters.ts
        graph-validation.ts
        graph-layout.ts
        particle-edges.tsx

      inspector/
        particle-inspector.tsx

      floating-dock/
        workspace-dock.tsx
        workspace-tabs.tsx
        workspace-composer.tsx

      hooks/
        use-particle-graph.ts
        use-particle-selection.ts
        use-workspace-layout.ts

      lib/
        particle-defaults.ts
        particle-actions.ts
```

This is a proposed module boundary, not an instruction to duplicate existing utilities or create unnecessary files.

Keep components small and cohesive.

Avoid a single massive canvas component containing every renderer, interaction handler, database operation, and schema.

---

## 15. Performance

This will eventually be used with large, AI-generated decision trees and multiplayer workspaces.

Implement for scalability from the beginning.

Requirements:

- Memoize Particle components where meaningful.
- Keep `nodeTypes` and `edgeTypes` references stable.
- Avoid unnecessary global rerenders.
- Subscribe to narrowly scoped state.
- Update only the changed Particle where possible.
- Debounce drag-position persistence.
- Avoid running ELK layout on every keystroke.
- Recalculate layout when needed following structural changes or explicit user action.
- Recalculate affected handles when dynamic content changes.
- Avoid expensive chart rendering for every offscreen Particle.
- Support collapsed previews for large collections.
- Preserve smooth pan, zoom, selection, and drag interactions.

Prefer Zustand if it fits the existing application's state architecture; do not add a competing store simply for this feature.

Use Next.js Server Components for data loading where appropriate and Client Components for the interactive canvas.

Prevent hydration inconsistencies.

Keep React Flow browser-only behavior in the correct client boundary.

---

## 16. Accessibility

- Keyboard-accessible Particle selection
- Keyboard-accessible checklist actions
- Accessible labels for navigation and controls
- Visible focus styles for keyboard interaction
- Avoid persistent focus rings after ordinary pointer clicks
- Proper button semantics inside custom React Flow Particles
- Readable status indicators that do not rely on color alone
- Light/dark contrast compliance
- Reduced-motion support
- Accessible dialog/inspector focus behavior

Use `nodrag` and `nopan` classes where appropriate so interacting with inputs and buttons does not accidentally drag the canvas.

---

## 17. Initial Demonstration Workflow

Use the existing Chicago nonprofit event-series plan as **seed/demo content only**.

Do not hardcode Good Company into the component system.

The example graph should demonstrate:

```text
Objective
  ├── Content Calendar
  │     ├── LinkedIn
  │     ├── Email
  │     └── Articles
  │
  ├── People / Intake
  │
  └── Activity: Event #01
          │
       Decision
       /      \
     Ready    Not yet
       |         |
     Event    Refine guests
       |
     Metrics + Follow-up
       |
     Event #02
       |
     Sponsorship decision
       /          \
      Yes         Not yet
       |             |
     Workflow      Repeat
       |
     Finance
       |
     Event #03
```

The first two events are unsponsored.

Attendance of 50–100 represents a target, not verified results.

The sponsorship packages are proposed examples, not actual signed deals.

The seed data demonstrates real Particle functionality, including nested calendar records, decision outcomes, checklists, and financial targets.

Use deterministic seeded IDs and repeatable fixture loading.

---

## 18. Testing & Acceptance Criteria

The feature is complete when:

- [ ] All eight Particle types render using the shared frame.
- [ ] Each type has a validated schema and correct renderer.
- [ ] Particle previews resemble the supplied design reference.
- [ ] Light and dark mode work across all components.
- [ ] Status indicators and progress reflect actual data.
- [ ] Calendar Particles group posts and emails in one chronological list.
- [ ] Calendar records open individually in the inspector.
- [ ] Checklist interactions update progress and persist.
- [ ] Decision selections persist and highlight the appropriate branch.
- [ ] Charts render real or clearly labeled demo data.
- [ ] React Flow supports pan, zoom, drag, selection and connections.
- [ ] ELKjs creates a coherent, non-overlapping decision-tree layout.
- [ ] Manual positions survive reload and ordinary data edits.
- [ ] Feedback-loop connections do not break layout.
- [ ] The floating dock is one expandable component.
- [ ] Dock navigation is compact, with a centered expand button.
- [ ] Selecting a Particle opens the inspector.
- [ ] Closing the inspector returns to the compact dock.
- [ ] The chat composer remains accessible.
- [ ] Changes persist without corrupting existing workspace state.
- [ ] Keyboard interaction and accessible states work.
- [ ] Existing workspace features continue functioning.
- [ ] Type checking, linting, and relevant automated tests pass.

Add unit tests for Particle schemas, state transitions, layout adapters, and connection validation.

Add component tests for calendars, workflows, and inspector behavior.

Add end-to-end coverage for Particle selection, editing, persistence, theme switching, and dock resizing using the test infrastructure already present in the repo.

---

## 19. Implementation Order

**Phase 1 — Audit**

Inspect the current workspace, React Flow implementation, dependencies, theme, state management, database, and multiplayer architecture.

**Phase 2 — Foundation**

Establish Particle contracts, registry, shared frame, status, and common UI components.

**Phase 3 — Specialized Components**

Implement and validate all eight Particle renderers.

**Phase 4 — Graph**

Integrate typed connections, selection, dragging, persistence, and ELKjs hierarchical layout.

**Phase 5 — Floating Workspace**

Refine the existing dock, tabs, chat composer, inspector, and resize interactions.

**Phase 6 — Persistence**

Integrate changes into the existing workspace data layer and collaboration model.

**Phase 7 — Verification**

Test both themes, variable Particle heights, large calendars, decision branches, reload persistence, and mobile behavior.

---

## 20. Definition of Done

Deliver a working, reusable, production-quality Particle System integrated into Coach House.

The result must feel like one coherent product rather than a collection of individually designed cards.

**Design quality:** shadcn precision, clear hierarchy, compact spacing, restrained visual language.

**Interaction quality:** fluid React Flow canvas, persistent editable Particles, cohesive floating workspace.

**Engineering quality:** strictly typed data, reusable components, deterministic graph layout, validated persistence, and testable state transitions.

**Product quality:** users interact with real underlying data and decisions rather than decorative mockups.

### Final Codex instructions

Before making changes, inspect the repository and identify which existing components can be reused.

Then implement the feature directly.

Do not introduce unnecessary abstractions, parallel data stores, duplicate canvas implementations, or placeholder UI.

When finished, report:

1. Files created and modified.
2. Architectural decisions.
3. Any database changes.
4. Features implemented.
5. Tests performed and results.
6. Remaining limitations or follow-up work.

**Do not consider the task complete until the Particle components and graph behavior are functional in the existing workspace.**
