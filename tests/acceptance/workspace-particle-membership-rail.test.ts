import { describe, expect, it } from "vitest"
import { createLibraryDocumentParticle } from "@/features/workspace-particles/lib/particle-library-document"
import { createParticle } from "@/features/workspace-particles/lib/particle-registry"
import { particleMembershipResponsibilities, membershipResponsibilityOperation, hasParticleMembership } from "@/features/workspace-particles/lib/particle-membership-responsibility"
import { prepareAuthorizedParticleMutation } from "@/features/workspace-particles/lib/authorized-mutation"
import { reconcileParticleNode, particleResizeChanges } from "@/features/workspace-particles/lib/particle-node-state"
import { particleFamilyDimensions } from "@/features/workspace-particles/lib/particle-size"
import { particlePlacementBounds } from "@/features/workspace-particles/lib/particle-creation-placement"
import { createImageParticle } from "@/features/workspace-particles/lib/particle-image"
import { graph, batch, ID, WORKSPACE, NOW } from "./fixtures/particle-fixtures"

const actor = { userId: ID(500), isOrganizationOwner: true }
const value = { version: 1 as const, ownerId: ID(701), contributorIds: [ID(702)] }
function setup() {
  const state = graph()
  const work = createParticle("activity", { id: ID(1), workspaceId: WORKSPACE, title: "Shared work", now: NOW })
  state.particles = [work, ...[2, 3].map(n => {
    const item = createParticle("objective", { id: ID(n), workspaceId: WORKSPACE, title: `Objective ${n}`, now: NOW })
    if (item.type !== "objective") throw new Error("Expected objective")
    item.data.planning = { plans: [{ id: ID(10), revision: 0, title: "Plan", particleIds: [work.id] }], proposals: n === 2 ? [{ id: ID(11), planId: ID(10), baseRevision: 0, title: "Alternative", particleIds: [work.id], status: "pending", authorId: ID(501), createdAt: NOW }] : [] }
    return item
  })]
  return state
}

describe("Canvas membership responsibility", () => {
  it("separates identical plan IDs under different objectives and pending proposals", () => {
    const scopes = particleMembershipResponsibilities(setup(), actor).get(ID(1))!
    expect(scopes).toHaveLength(3)
    expect(new Set(scopes.map(item => item.key)).size).toBe(3)
    expect(scopes.map(item => item.label)).toEqual(["Objective 2 / Plan", "Objective 2 / Alternative · Proposed", "Objective 3 / Plan"])
  })

  it.each([false, true])("writes only the selected membership through the authorized writer (source-backed: %s)", async sourceBacked => {
    const before = setup()
    if (sourceBacked) before.particles[0] = createLibraryDocumentParticle(WORKSPACE, { name: "Source", mimeType: "text/plain", source: { kind: "drive", id: ID(601), webViewLink: "https://docs.google.com/document/d/source/edit" } }, ID(1), NOW)
    const scope = particleMembershipResponsibilities(before, actor).get(ID(1))![2]
    const operation = membershipResponsibilityOperation(before, ID(1), scope, value, actor)!
    expect(operation.kind).toBe("change_plan")
    const prepared = await prepareAuthorizedParticleMutation({ input: batch(90, [operation], before.revision), workspaceId: WORKSPACE, canEdit: true, now: NOW, planningActor: actor })
    if (!prepared.ok) throw new Error(prepared.error)
    const after = prepared.value(before).graph
    expect(after.particles[0]).toEqual(before.particles[0])
    expect(after.particles[1]).toEqual(before.particles[1])
    const objective = after.particles[2]
    if (objective.type !== "objective") throw new Error("Expected objective")
    expect(objective.data.planning?.plans[0]).toMatchObject({ revision: 1, assignments: [{ particleId: ID(1), responsibility: value }] })
    expect(membershipResponsibilityOperation(after, ID(1), scope, value, actor)).toBeNull()
  })

  it("allows proposal authors only their pending proposal, preserving the accepted plan", async () => {
    const before = setup(), author = { userId: ID(501), isOrganizationOwner: false }
    const scopes = particleMembershipResponsibilities(before, author).get(ID(1))!
    expect(scopes.map(item => item.editable)).toEqual([false, true, false])
    expect(membershipResponsibilityOperation(before, ID(1), scopes[0], value, author)).toBeNull()
    const op = membershipResponsibilityOperation(before, ID(1), scopes[1], value, author)!
    const prepared = await prepareAuthorizedParticleMutation({ input: batch(91, [op], before.revision), workspaceId: WORKSPACE, canEdit: true, now: NOW, planningActor: author })
    if (!prepared.ok) throw new Error(prepared.error)
    const after = prepared.value(before).graph.particles[1]
    if (after.type !== "objective" || before.particles[1].type !== "objective") throw new Error("Expected objective")
    expect(after.data.planning?.plans).toEqual(before.particles[1].data.planning?.plans)
    expect(after.data.planning?.proposals[0].assignments).toEqual([{ particleId: ID(1), responsibility: value }])
    expect(membershipResponsibilityOperation(before, ID(1), scopes[1], value, { userId: ID(599), isOrganizationOwner: false })).toBeNull()
  })

  it("fails closed on stale, missing, foreign, locked and invalid contexts", () => {
    const before = setup(), scope = particleMembershipResponsibilities(before, actor).get(ID(1))![0]
    expect(membershipResponsibilityOperation(before, ID(1), { ...scope, revision: 99 }, value, actor)).toBeNull()
    expect(membershipResponsibilityOperation(before, ID(1), { ...scope, workspaceId: ID(998) }, value, actor)).toBeNull()
    expect(membershipResponsibilityOperation(before, ID(99), scope, value, actor)).toBeNull()
    expect(membershipResponsibilityOperation(before, ID(1), scope, { ...value, contributorIds: [value.ownerId] }, actor)).toBeNull()
    before.particles[1].locked = true
    expect(membershipResponsibilityOperation(before, ID(1), scope, value, actor)).toBeNull()
    before.particles.splice(1, 1)
    expect(membershipResponsibilityOperation(before, ID(1), scope, value, actor)).toBeNull()
    expect(particleMembershipResponsibilities(before).get(ID(1))?.every(item => !item.editable)).toBe(true)
  })

  it("includes full shared-step rail in measurements while keeping card handles and source dimensions", () => {
    const state = setup(), particle = state.particles[0]
    const memberships = particleMembershipResponsibilities(state, actor).get(particle.id)
    const node = reconcileParticleNode({ particle, selectedId: null, movable: true, resizing: false, keepPosition: false,
      data: { particle, editable: true, memberships, onOpen() {}, onEdit() {} } })
    const card = particleFamilyDimensions(particle, particle.size!)
    expect(node.initialHeight).toBe(card.height + 52)
    expect(node.handles?.[0].y).toBe(card.height / 2)
    expect(particlePlacementBounds(particle, hasParticleMembership(state, particle.id)).height).toBe(card.height + 52)
    const image = createImageParticle(WORKSPACE, "Photo", { kind: "image", fileId: ID(60), width: 1600, height: 900, alt: "" }, { x: 0, y: 0 }, ID(1), NOW)
    const changes = particleResizeChanges([{ type: "dimensions", id: image.id, dimensions: { width: 400, height: 300 }, setAttributes: true }], new Map([[image.id, image]]), new Set([image.id]))
    expect(changes[0]).toMatchObject({ dimensions: { width: 400, height: particleFamilyDimensions(image, "large").height + 52 } })
  })
})
