import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  buildUserJourneyAtlasInput,
  parseUserJourneyAtlasMermaid,
  UserJourneyAtlasPanel,
} from "@/features/user-journey-atlas"

const MERMAID_PATH =
  "src/features/user-journey-atlas/lib/user-journey-atlas.mmd"

function readMermaidSource() {
  return readFileSync(MERMAID_PATH, "utf8")
}

function buildTestInput() {
  return buildUserJourneyAtlasInput({
    mermaidPath: MERMAID_PATH,
    mermaidSource: readMermaidSource(),
  })
}

describe("user-journey-atlas feature contract", () => {
  it("parses a Mermaid graph backed by actual repository files", () => {
    const graph = parseUserJourneyAtlasMermaid(readMermaidSource())

    expect(graph.lanes.map((lane) => lane.id)).toEqual(
      expect.arrayContaining([
        "public",
        "auth",
        "emails",
        "billing",
        "onboarding",
        "workspace",
        "intake",
        "find",
        "upgrade",
        "invites",
        "operations",
        "prototype",
      ])
    )
    expect(graph.nodes.map((node) => node.file)).toEqual(
      expect.arrayContaining([
        "src/app/(public)/page.tsx",
        "src/app/(auth)/sign-up/page.tsx",
        "src/app/api/stripe/checkout/route.ts",
        "src/lib/email/resend.ts",
        "src/app/actions/module-notes.ts",
        "src/app/api/modules/[id]/assignment-submission/route.ts",
        "src/app/(dashboard)/workspace/page.tsx",
        "src/app/layout.tsx",
        "src/app/api/meetings/schedule/route.ts",
        "src/lib/homework/assist.ts",
        "src/features/user-journey-atlas/lib/user-journey-atlas.mmd",
      ])
    )
    for (const node of graph.nodes) {
      expect(existsSync(join(process.cwd(), node.file))).toBe(true)
    }
  })

  it("translates Mermaid nodes into workspace-canvas-style tiles", () => {
    const input = buildTestInput()
    const source = readFileSync(
      "src/features/user-journey-atlas/components/user-journey-atlas-panel.tsx",
      "utf8"
    )
    const nodeCardSource = readFileSync(
      "src/features/user-journey-atlas/components/user-journey-atlas-node-card.tsx",
      "utf8"
    )
    const nodeCardBodySource = readFileSync(
      "src/features/user-journey-atlas/components/user-journey-atlas-node-card-bodies.tsx",
      "utf8"
    )
    const outlineSource = readFileSync(
      "src/features/user-journey-atlas/components/user-journey-atlas-outline.tsx",
      "utf8"
    )
    const markup = renderToStaticMarkup(
      createElement(UserJourneyAtlasPanel, {
        input,
      })
    )

    expect(markup).toContain("User journey atlas")
    expect(markup).not.toContain("Workspace canvas graph")
    // v12 SSR includes graph cards; a Mermaid-source card is legitimate data.
    expect(markup).toContain('aria-label="User journey atlas"')
    expect(markup).not.toMatch(/<h[1-6][^>]*>Mermaid source<\/h[1-6]>/)
    expect(input.nodes.map((node) => node.file)).toEqual(
      expect.arrayContaining([
        "src/app/(public)/page.tsx",
        "src/app/api/stripe/checkout/route.ts",
      ])
    )
    expect(input.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoryLabel: "Public entry files",
          dataFields: expect.arrayContaining(["auth callback params"]),
          file: "src/app/(public)/page.tsx",
          fileKindLabel: "Route page",
          healthStatus: "live",
          healthStatusLabel: "Working path",
          nextStepLabels: expect.arrayContaining([
            "composes -> Find route composition",
          ]),
          surfaceKind: "route",
          surfaceKindLabel: "Route",
        }),
        expect.objectContaining({
          categoryLabel: "Auth and confirmation files",
          dataFields: expect.arrayContaining(["token_hash", "type"]),
          file: "src/app/auth/confirm/page.tsx",
          fileKindLabel: "Route page",
          healthStatus: "recovery-gap",
          healthStatusLabel: "Recovery gap",
          surfaceKind: "auth",
          surfaceKindLabel: "Auth",
        }),
        expect.objectContaining({
          categoryLabel: "Billing and pricing return files",
          dataFields: expect.arrayContaining(["plan tier", "source"]),
          file: "src/app/api/stripe/checkout/route.ts",
          fileKindLabel: "API route",
          healthStatus: "recovery-gap",
          surfaceKind: "payment",
          surfaceKindLabel: "Payment",
        }),
        expect.objectContaining({
          categoryLabel: "Workspace data intake files",
          dataFields: expect.arrayContaining([
            "answers JSON",
            "submission status",
          ]),
          file: "src/app/api/modules/[id]/assignment-submission/route.ts",
          fileKindLabel: "API route",
          healthStatus: "activation-gap",
          surfaceKind: "data",
          surfaceKindLabel: "Data write",
        }),
        expect.objectContaining({
          categoryLabel: "Workspace data intake files",
          file: "src/components/training/module-detail/assignment-form.tsx",
          surfaceKind: "form",
          surfaceKindLabel: "Form",
        }),
        expect.objectContaining({
          categoryLabel: "Email and notification files",
          dataFields: expect.arrayContaining(["from", "to", "subject"]),
          file: "src/lib/email/resend.ts",
          fileKindLabel: "Library",
          surfaceKind: "email",
          surfaceKindLabel: "Email",
        }),
        expect.objectContaining({
          categoryLabel: "Journey operations files",
          dataFields: expect.arrayContaining(["CTA clicked", "signup started"]),
          file: "src/app/layout.tsx",
          healthStatus: "telemetry-gap",
          healthStatusLabel: "Telemetry gap",
          surfaceKind: "telemetry",
          surfaceKindLabel: "Telemetry",
        }),
        expect.objectContaining({
          categoryLabel: "Journey operations files",
          dataFields: expect.arrayContaining(["active org", "coaching tier"]),
          file: "src/app/api/meetings/schedule/route.ts",
          healthStatus: "integration-gap",
          healthStatusLabel: "Integration gap",
          surfaceKind: "coaching",
          surfaceKindLabel: "Coaching",
        }),
        expect.objectContaining({
          categoryLabel: "Journey operations files",
          dataFields: expect.arrayContaining([
            "profile completed",
            "first homework submitted",
          ]),
          file: "src/features/workspace-canvas-tutorial/lib/index.ts",
          healthStatus: "activation-gap",
          healthStatusLabel: "Activation gap",
          surfaceKind: "outcome",
          surfaceKindLabel: "Outcome",
        }),
        expect.objectContaining({
          categoryLabel: "Journey operations files",
          file: "src/lib/homework/assist.ts",
          healthStatus: "ai-stub",
          healthStatusLabel: "AI stub",
          surfaceKind: "ai",
          surfaceKindLabel: "AI assist",
        }),
      ])
    )
    expect(input.nodes.map((node) => node.title)).toContain(
      "Workspace invite sheet"
    )
    const connectedNodeIds = new Set(
      input.edges.flatMap((edge) => [edge.from, edge.to])
    )
    expect(input.nodes.every((node) => connectedNodeIds.has(node.id))).toBe(
      true
    )
    expect(markup).toContain('aria-label="Zoom out"')
    expect(markup).toContain('aria-label="Zoom in"')
    expect(markup).toContain('aria-label="Fit view"')
    expect(markup).toContain('data-user-journey-atlas-flow="react-flow"')
    expect(source).toContain("ReactFlow")
    expect(source).toContain('import "@xyflow/react/dist/style.css"')
    expect(source).toContain("buildUserJourneyOutlineNodes")
    expect(source).toContain("buildUserJourneyOutlineEdges")
    expect(source).toContain("userJourneyOutline")
    expect(outlineSource).toContain("data-user-journey-outline-node")
    expect(outlineSource).toContain("Login page")
    expect(outlineSource).toContain("Need account? Sign up")
    expect(outlineSource).toContain("/sign-up route")
    expect(outlineSource).toContain("outline-login-signup")
    expect(outlineSource).toContain("outline-signup-route")
    expect(outlineSource).toContain("Free journey")
    expect(outlineSource).toContain("$20 journey")
    expect(outlineSource).toContain("$58 journey")
    expect(outlineSource).toContain("Pricing")
    expect(outlineSource).toContain("Pick path")
    expect(outlineSource).toContain("Stripe checkout")
    expect(source).toContain("zoomOnScroll")
    expect(source).toContain("panOnDrag")
    expect(source).toContain("nodesDraggable")
    expect(source).toContain("draggable: true")
    expect(source).toContain("useNodesState")
    expect(source).toContain("fitViewOptions")
    expect(source).toContain(
      "min-h-0 flex-1 touch-none overflow-hidden overscroll-contain"
    )
    expect(source).toContain("MIN_ZOOM = 0.08")
    expect(source).toContain("padding: 0.24")
    expect(source).toContain("UserJourneyAtlasNodeCard")
    expect(source).toContain("border border-border bg-card p-1")
    expect(source).not.toContain("backdrop-blur")
    expect(source).toContain("edgeColor")
    expect(source).toContain("getUserJourneyHealthStatusStyle")
    expect(source).toContain("strokeDasharray")
    expect(nodeCardSource).toContain("USER_JOURNEY_SURFACE_KIND_STYLES")
    expect(nodeCardSource).toContain("USER_JOURNEY_HEALTH_STATUS_STYLES")
    expect(nodeCardSource).toContain("UserJourneyHealthStatusPanel")
    expect(nodeCardBodySource).toContain("UserJourneyEmailCardBody")
    expect(nodeCardBodySource).toContain("UserJourneyFormCardBody")
    expect(nodeCardBodySource).toContain("UserJourneyPaymentCardBody")
    expect(nodeCardBodySource).toContain("UserJourneyDataCardBody")
    expect(nodeCardBodySource).toContain("UserJourneyAccessCardBody")
    expect(nodeCardBodySource).toContain("UserJourneyCheckpointCardBody")
    expect(nodeCardBodySource).toContain("UserJourneyTelemetryCardBody")
    expect(nodeCardBodySource).toContain("UserJourneyCoachingCardBody")
    expect(nodeCardBodySource).toContain("UserJourneyAiCardBody")
    expect(nodeCardBodySource).toContain("UserJourneyOutcomeCardBody")
    expect(nodeCardBodySource).toContain("Email payload")
    expect(nodeCardBodySource).toContain("Fields")
    expect(nodeCardBodySource).toContain("Billing handoff")
    expect(nodeCardSource).toContain("Stored data")
    expect(nodeCardBodySource).toContain("Access decision")
    expect(nodeCardBodySource).toContain("Screen state")
    expect(nodeCardBodySource).toContain("Event coverage")
    expect(nodeCardBodySource).toContain("Booking handoff")
    expect(nodeCardBodySource).toContain("Assistant inputs")
    expect(nodeCardBodySource).toContain("Value loop")
    expect(nodeCardBodySource).toContain("data-user-journey-card-kind")
    expect(nodeCardSource).toContain("data-user-journey-health-status")
    expect(nodeCardBodySource).toContain("h-[7.25rem] shrink-0 overflow-hidden")
    expect(nodeCardSource).toContain('cardClassName: "border-border bg-card"')
    expect(nodeCardSource).not.toMatch(/bg-[A-Za-z0-9_-]+\/\d/)
    expect(nodeCardBodySource).not.toMatch(/bg-[A-Za-z0-9_-]+\/\d/)
    expect(source).not.toMatch(/bg-[A-Za-z0-9_-]+\/\d/)
    expect(nodeCardBodySource).toContain("node.dataFields")
    expect(nodeCardSource).toContain("node.systemEvents")
    expect(nodeCardSource).toContain("node.nextStepLabels")
    expect(nodeCardSource).toContain("node.surfaceKindLabel")
    expect(nodeCardSource).toContain("node.healthStatus")
    expect(nodeCardSource).toContain("node.healthStatusLabel")
    expect(nodeCardSource).toContain("node.healthSummary")
    expect(nodeCardSource).toContain("node.categoryLabel")
    expect(nodeCardSource).toContain("node.fileKindLabel")
    expect(source).not.toContain("UserJourneyAtlasNodePreview")
    expect(nodeCardSource).not.toContain("UserJourneyAtlasNodePreview")
    expect(source).not.toContain('from "next/image"')
    expect(nodeCardSource).not.toContain('from "next/image"')
    expect(source).not.toContain("/user-journey-atlas/previews")
    expect(nodeCardSource).not.toContain("/user-journey-atlas/previews")
    expect(source).not.toContain("rounded-md border border-primary/15")
    expect(source).toContain("passive: false")
    expect(source).toContain('addEventListener("wheel"')
    expect(source).toContain('addEventListener("touchmove"')
    expect(source).toContain('addEventListener("gesturestart"')
    expect(source).not.toContain("labelBgStyle")
    expect(source).not.toContain("labelStyle")
    expect(source).not.toContain("label: edge.label")
    expect(source).not.toContain("userJourneyLane")
    expect(source).not.toContain("border-x px-4 py-6")
    expect(source).not.toContain("PointerEvent")
    expect(source).not.toContain("type WheelEvent")
    expect(source).not.toContain("onWheel")
    expect(source).not.toContain("min-h-[calc(100vh-3.5rem)]")
    expect(input.nodes.length).toBeGreaterThan(60)
    expect(input.edges.length).toBeGreaterThan(70)
  })

  it("keeps the admin prototype page protected by platform admin auth", () => {
    const source = readFileSync(
      "src/app/(admin)/admin/platform/prototypes/page.tsx",
      "utf8"
    )

    expect(source).toContain("await requireAdmin()")
    expect(source).toContain("getUserJourneyAtlasPageInput")
  })

  it("redirects the direct admin route into the Prototypes entry", () => {
    const source = readFileSync(
      "src/app/(admin)/admin/platform/user-journeys/page.tsx",
      "utf8"
    )

    expect(source).toContain("await requireAdmin()")
    expect(source).toContain(
      'redirect("/admin/platform/prototypes?entry=user-journey-atlas")'
    )
  })
})
