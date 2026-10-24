import type { Json } from "@/lib/supabase"
import { z } from "zod"
import type {
  ParticleConnection,
  ParticleGraph,
  ParticleResult,
} from "../types"
import { particleGraphSchema } from "./particle-schema"
import {
  isWorkspaceToolId,
  workspaceToolSourceHandleSchema,
  workspaceToolTargetHandleSchema,
} from "./workspace-tool-contract"
import { getParticleHandles } from "./particle-registry"

export function emptyParticleGraph(workspaceId: string): ParticleGraph {
  return particleGraphSchema.parse({
    schemaVersion: 1,
    workspaceId,
    revision: 0,
    minimumBaseRevision: 0,
    rootId: null,
    particles: [],
    connections: [],
    receipts: [],
  })
}
export function isParticleHierarchyEdge(edge: ParticleConnection) {
  return (
    edge.relationship !== "feedback" && edge.relationship !== "related_resource"
  )
}
export function validateParticleGraph(graph: ParticleGraph): string | null {
  const particles = new Map(
    graph.particles.map((particle) => [particle.id, particle])
  )
  if (particles.size !== graph.particles.length)
    return "Particle IDs must be unique."
  const placedPeople = graph.particles.flatMap((particle) =>
    particle.type === "people" && particle.data.presentation === "person"
      ? particle.data.personIds
      : []
  )
  if (new Set(placedPeople).size !== placedPeople.length)
    return "This person already has a board placement. Refresh before adding them again."
  if (
    new Set(graph.connections.map((edge) => edge.id)).size !==
    graph.connections.length
  )
    return "Connection IDs must be unique."
  if (graph.minimumBaseRevision > graph.revision)
    return "Invalid graph revision window."
  if (
    new Set(graph.receipts.map((receipt) => receipt.id)).size !==
      graph.receipts.length ||
    graph.receipts.some(
      (receipt, index) =>
        receipt.revision <=
          (graph.receipts[index - 1]?.revision ?? graph.minimumBaseRevision) ||
        receipt.revision > graph.revision
    )
  )
    return "Invalid operation receipt history."

  if (
    graph.particles.some(
      (particle) => particle.workspaceId !== graph.workspaceId
    )
  )
    return "Particle belongs to another workspace."
  if (
    graph.particles.some((particle) => particle.revision > graph.revision) ||
    graph.connections.some((edge) => edge.revision > graph.revision)
  )
    return "Entity revision exceeds graph revision."
  if (graph.rootId && particles.get(graph.rootId)?.type !== "objective")
    return "The primary root must reference an Objective."
  for (const particle of graph.particles) {
    if (particle.type !== "objective" || !particle.data.planning) continue
    for (const plan of [...particle.data.planning.plans,...particle.data.planning.proposals.filter(item=>item.status === "pending")]) {
      const links = plan.links ?? [], members = new Set(plan.particleIds)
      if (links.some(link=>link.source===link.target || !members.has(link.source) || !members.has(link.target))) return "Plan relationships must connect its members."
      const visiting = new Set<string>(), visited = new Set<string>()
      const cyclic = (id:string):boolean => {
        if(visiting.has(id)) return true
        if(visited.has(id)) return false
        visiting.add(id)
        if(links.some(link=>link.source===id && cyclic(link.target))) return true
        visiting.delete(id);visited.add(id);return false
      }
      if(plan.particleIds.some(cyclic)) return "Plan relationships cannot contain cycles."
    }
    for (const plan of particle.data.planning.plans) {
      if (plan.revision > graph.revision) return "Plan revision exceeds graph revision."
      if (plan.particleIds.some(id => particles.get(id)?.type === "objective" || !particles.has(id)))
        return "Remove this particle from its plan before deleting it."
    }
    for (const proposal of particle.data.planning.proposals.filter(item => item.status === "pending")) {
      if (proposal.particleIds.some(id => particles.get(id)?.type === "objective" || !particles.has(id)))
        return "A pending proposal references this particle. Review it before deleting."
    }
  }
  const adjacency = new Map<string, string[]>()
  const edgeKeys = new Set<string>()
  for (const edge of graph.connections) {
    const source = particles.get(edge.source)
    const target = particles.get(edge.target)
    const sourceTool = isWorkspaceToolId(edge.source)
    const targetTool = isWorkspaceToolId(edge.target)
    if ((!source && !sourceTool) || (!target && !targetTool))
      return "Connection references a missing Particle."
    if (sourceTool || targetTool) {
      if (sourceTool && targetTool)
        return "Workspace tool links belong to the existing board."
      if (
        edge.relationship !== "related_resource" ||
        edge.outcome !== undefined
      )
        return "Workspace tools support related-resource connections."
      if (
        sourceTool
          ? !workspaceToolSourceHandleSchema.safeParse(edge.sourceHandle)
              .success
          : edge.sourceHandle !== "out"
      )
        return "Unknown source handle."
      if (
        targetTool
          ? !workspaceToolTargetHandleSchema.safeParse(edge.targetHandle)
              .success
          : edge.targetHandle !== "in"
      )
        return "Unknown target handle."
    } else {
      if (!source || !target) return "Connection references a missing Particle."
      if (edge.targetHandle !== "in") return "Unknown target handle."
      if (edge.source === edge.target && edge.relationship !== "feedback")
        return "Only explicit feedback may connect a Particle to itself."
      if (!getParticleHandles(source).outputs.includes(edge.sourceHandle))
        return "Unknown source handle."
      if (edge.relationship === "decision_outcome") {
        if (
          source.type !== "decision" ||
          !source.data.outcomes.some(
            (outcome) => outcome.id === edge.outcome
          ) ||
          edge.sourceHandle !== `outcome:${edge.outcome}`
        )
          return "Decision connection must use a declared outcome and its handle."
      } else if (edge.outcome !== undefined || edge.sourceHandle !== "out")
        return "Only decision connections may use outcome handles."
    }
    const key = [
      edge.source,
      edge.target,
      edge.relationship,
      edge.sourceHandle,
      edge.targetHandle,
    ].join(":")
    if (edgeKeys.has(key)) return "Duplicate relationship."
    edgeKeys.add(key)
    if (isParticleHierarchyEdge(edge))
      adjacency.set(edge.source, [
        ...(adjacency.get(edge.source) ?? []),
        edge.target,
      ])
  }
  if (
    graph.rootId &&
    graph.connections.some(
      (edge) => edge.target === graph.rootId && isParticleHierarchyEdge(edge)
    )
  )
    return "The primary objective cannot have an incoming hierarchy connection."
  for (const particle of graph.particles) {
    const steps =
      particle.type === "activity" || particle.type === "workflow"
        ? particle.data.steps
        : particle.type === "decision"
          ? particle.data.criteria
          : []
    if (
      steps.some((step) => step.particleId && !particles.has(step.particleId))
    )
      return "Checklist references a missing Particle."
    if (
      particle.type === "calendar" &&
      particle.data.entries.some(
        (entry) =>
          entry.activityId &&
          particles.get(entry.activityId)?.type !== "activity"
      )
    )
      return "Calendar activity reference is invalid."
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  function cyclic(id: string): boolean {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    if ((adjacency.get(id) ?? []).some(cyclic)) return true
    visiting.delete(id)
    visited.add(id)
    return false
  }
  return graph.particles.some((particle) => cyclic(particle.id))
    ? "Hierarchy connections must not form a cycle. Use explicit feedback."
    : null
}
export function readParticleGraph(
  value: unknown,
  workspaceId: string
): ParticleResult<ParticleGraph> {
  if (value === undefined)
    return { ok: true, value: emptyParticleGraph(workspaceId) }
  const parsed = particleGraphSchema.safeParse(value)
  if (!parsed.success)
    return {
      ok: false,
      code: "unsupported",
      error:
        "This Particle graph is invalid or from a newer version. Its saved data has been preserved.",
    }
  if (parsed.data.workspaceId !== workspaceId)
    return {
      ok: false,
      code: "scope",
      error: "Particle graph belongs to another workspace.",
    }
  const error = validateParticleGraph(parsed.data)
  return error
    ? { ok: false, code: "invalid", error }
    : { ok: true, value: parsed.data }
}
// Opaque compatibility envelope only; never treat an unsupported graph as empty.
export function preserveParticleGraphJson(value: unknown): Json | undefined {
  if (value === undefined) return undefined
  const parsed = z.json().safeParse(value)
  return parsed.success ? parsed.data : undefined
}
