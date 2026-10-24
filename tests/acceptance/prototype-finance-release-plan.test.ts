import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  buildPrototypeLabInput,
  listPrototypeLabSidebarTree,
  resolvePrototypeLabSidebarOpenFolderIds,
} from "@/features/prototype-lab"
import { FINANCE_RELEASE_PLAN_NODE_IDS } from "@/features/prototype-lab/components/finance/finance-release-plan-data"
import { FINANCE_RELEASE_PLAN_BATCHES } from "@/features/prototype-lab/components/finance/finance-release-plan-batches"
import { FINANCE_RELEASE_PLAN_GATES } from "@/features/prototype-lab/components/finance/finance-release-plan-gates"
import { FINANCE_RELEASE_PLAN_RESEARCH } from "@/features/prototype-lab/components/finance/finance-release-plan-research"
import { FINANCE_RELEASE_PLAN_SUPPORT_NODES } from "@/features/prototype-lab/components/finance/finance-release-plan-support"
import {
  buildFinanceReleasePlanEdges,
  buildFinanceReleasePlanNodes,
  FINANCE_RELEASE_PLAN_COUNTS,
  FINANCE_RELEASE_PLAN_NAVIGATION,
  getFinanceReleasePlanNodeColor,
} from "@/features/prototype-lab/components/finance/finance-release-plan-model"
import { FINANCE_PLAN_CURRENT_FOCUS } from "@/features/prototype-lab/components/finance/finance-plan-current-focus"
import { getFinancePlanNodeStatusTone } from "@/features/prototype-lab/components/finance/finance-plan-status"
import {
  FINANCE_PLANNING_VIEW_COUNT,
  FINANCE_PLANNING_VIEWS,
} from "@/features/prototype-lab/components/finance/finance-plan-views"
import {
  FINANCE_PRD_SECTION_COVERAGE,
  FINANCE_PRD_SECTION_COVERAGE_COUNT,
} from "@/features/prototype-lab/components/finance/finance-plan-prd-coverage"
import {
  applyFinancePlanningLocationToParams,
  applyFinancePlanningViewToParams,
  buildFinancePlanningLocationHref,
  buildFinancePlanningViewHref,
  FINANCE_PLANNING_NODE_QUERY_PARAM,
  FINANCE_PLANNING_VIEW_QUERY_PARAM,
  readFinancePlanningLocationFromParams,
  readFinancePlanningViewFromParams,
} from "@/features/prototype-lab/components/finance/finance-plan-url-state"
import {
  FINANCE_PLAN_SEARCH_ENTRIES,
  FINANCE_PLAN_SEARCH_ENTRY_COUNT,
  searchFinancePlanNodes,
} from "@/features/prototype-lab/components/finance/finance-plan-search"
import {
  FINANCE_PRD_COVERAGE_INDEX,
  FINANCE_PRD_COVERAGE_INDEX_COUNT,
  FINANCE_PRD_COVERAGE_NODE_REFERENCE_COUNT,
  searchFinancePrdCoverage,
} from "@/features/prototype-lab/components/finance/finance-plan-prd-index"
import {
  FINANCE_PLAN_OPEN_DECISIONS,
  FINANCE_PLAN_OPEN_INPUT_COUNTS,
  FINANCE_PLAN_OPEN_INPUTS,
  FINANCE_PLAN_OPEN_RESEARCH,
} from "@/features/prototype-lab/components/finance/finance-plan-open-inputs"
import {
  buildFinancePlanBatchProgress,
  FINANCE_PLAN_BATCH_PROGRESS,
  FINANCE_PLAN_BATCH_WORK_COUNTS,
} from "@/features/prototype-lab/components/finance/finance-plan-batch-progress"
import {
  buildFinancePlanDecisionProgress,
  FINANCE_PLAN_DECISION_ITEM_COUNTS,
  FINANCE_PLAN_DECISION_PROGRESS,
} from "@/features/prototype-lab/components/finance/finance-plan-decision-progress"
import {
  buildFinancePlanCutover,
  FINANCE_PLAN_CUTOVER,
  FINANCE_PLAN_CUTOVER_COUNTS,
} from "@/features/prototype-lab/components/finance/finance-plan-cutover"
import {
  buildFinancePlanFailureStates,
  FINANCE_PLAN_FAILURE_STATES,
  FINANCE_PLAN_FAILURE_STATE_COUNTS,
} from "@/features/prototype-lab/components/finance/finance-plan-failure-states"
import {
  buildFinancePlanTestMatrix,
  FINANCE_PLAN_TEST_MATRIX,
  FINANCE_PLAN_TEST_MATRIX_COUNTS,
} from "@/features/prototype-lab/components/finance/finance-plan-test-matrix"
import {
  buildFinancePlanSecurityControls,
  FINANCE_PLAN_SECURITY_CONTROLS,
  FINANCE_PLAN_SECURITY_CONTROL_COUNTS,
} from "@/features/prototype-lab/components/finance/finance-plan-security-controls"
import {
  buildFinancePlanCompletion,
  FINANCE_PLAN_COMPLETION,
  FINANCE_PLAN_COMPLETION_COUNTS,
} from "@/features/prototype-lab/components/finance/finance-plan-completion"
import {
  buildFinancePlanResearchProgress,
  FINANCE_PLAN_RESEARCH_ITEM_COUNTS,
  FINANCE_PLAN_RESEARCH_PROGRESS,
} from "@/features/prototype-lab/components/finance/finance-plan-research-progress"
import {
  buildFinancePlanBatchReadiness,
  buildFinancePlanGateReadiness,
  FINANCE_PLAN_BATCH_READINESS,
  FINANCE_PLAN_BATCH_READINESS_COUNTS,
  FINANCE_PLAN_GATE_EVIDENCE_COUNTS,
  FINANCE_PLAN_GATE_READINESS,
  FINANCE_PLAN_GATE_READINESS_COUNTS,
} from "@/features/prototype-lab/components/finance/finance-plan-readiness"
import {
  FINANCE_PLAN_DIAGRAM_INDEX,
  FINANCE_PLAN_DIAGRAM_INDEX_COUNT,
  searchFinancePlanDiagrams,
} from "@/features/prototype-lab/components/finance/finance-plan-diagram-index"
import {
  FINANCE_PLAN_DIAGRAM_TRACEABILITY,
  FINANCE_PLAN_DIAGRAM_TRACEABILITY_COUNT,
} from "@/features/prototype-lab/components/finance/finance-plan-diagram-traceability"
import {
  FINANCE_PLAN_OBJECTIVE_INDEX,
  FINANCE_PLAN_OBJECTIVE_INDEX_COUNT,
  FINANCE_PLAN_OBJECTIVE_NODE_REFERENCE_COUNT,
  searchFinancePlanObjectives,
} from "@/features/prototype-lab/components/finance/finance-plan-objective-index"
import {
  FINANCE_PLAN_OBJECTIVE_TRACEABILITY,
  FINANCE_PLAN_OBJECTIVE_TRACEABILITY_COUNT,
} from "@/features/prototype-lab/components/finance/finance-plan-objective-traceability"
import {
  FINANCE_PLAN_COMPLETION_PERCENTAGE,
  FINANCE_PLAN_CURRENT_WAVE,
  FINANCE_PLAN_NEXT_CRITERION,
  FINANCE_PLAN_WAVE_COUNTS,
  FINANCE_PLAN_WAVES,
  FINANCE_PLAN_WAVE_STATUS_COUNTS,
} from "@/features/prototype-lab/components/finance/finance-plan-wave-progress"

const FINANCE_COMPONENT_ROOT = "src/features/prototype-lab/components/finance"
const FINANCE_PRD_PATH =
  "docs/plans/2026-08-04-finance-fundraising-find-release-design.md"
const FISCAL_POLICY_PACKET_PATH =
  "docs/plans/2026-08-06-fiscal-sponsorship-policy-approval-packet.md"
const RESOURCE_MAP_INVENTORY_BASELINE_PATH =
  "docs/plans/2026-08-06-resource-map-inventory-baseline.md"
const PUBLIC_MAP_PERFORMANCE_BUDGET_PATH =
  "docs/plans/2026-08-06-public-map-performance-budget.md"
const PUBLIC_MAP_CONTACT_THREAT_MODEL_PATH =
  "docs/plans/2026-08-06-public-map-contact-auth-threat-model.md"
const PUBLIC_MAP_LOCATION_WEATHER_CONTRACT_PATH =
  "docs/plans/2026-08-06-public-map-location-weather-contract.md"
const PUBLIC_MAP_WEATHER_FIXTURE_PATH =
  "tests/fixtures/public-map-weather/nws-weather-contract.json"
const STRIPE_CONNECT_CONTRACT_PATH =
  "docs/plans/2026-08-06-stripe-connect-contract-and-environments.md"
const STRIPE_CONNECT_FIXTURE_PATH =
  "tests/fixtures/stripe-connect/research-contract.json"

function readFinanceSource(fileName: string) {
  return readFileSync(`${FINANCE_COMPONENT_ROOT}/${fileName}`, "utf8")
}

function normalizeGateRequirement(requirement: string) {
  return requirement
    .replace(/^- /, "")
    .replace(/\n\s+/g, " ")
    .replace(/`/g, "")
    .replace(/[.;]$/, "")
    .toLowerCase()
}

function readPrdBatchScopeItems() {
  const prd = readFileSync(FINANCE_PRD_PATH, "utf8")
  const batches = [
    ...prd.matchAll(
      /### Batch (\d+):[^\n]+\n\nScope:\n\n([\s\S]*?)\n\nGates:/gu
    ),
  ]

  return batches.map((batch) =>
    batch[2]
      .trim()
      .split(/\n- /gu)
      .map((item) => normalizeGateRequirement(item))
  )
}

function readPrdCurrentWaveCriteria() {
  const prd = readFileSync(FINANCE_PRD_PATH, "utf8")
  const section = prd.match(
    /^#### Current-wave completion checklist\n\n[\s\S]*?\n\n([\s\S]*?)\n\n#### Wave 1 current evidence/m
  )?.[1]
  const stateByLabel = {
    Complete: "complete",
    "In progress": "in_progress",
    "Not started": "not_started",
  } as const

  return [
    ...(section ?? "").matchAll(
      /^- \[([ x])\] `([^`]+)` \*\*(Complete|In progress|Not started):\*\* (.*?)(?: — Evidence: .*)?$/gm
    ),
  ].map((match) => ({
    checked: match[1] === "x",
    id: match[2],
    state: stateByLabel[match[3] as keyof typeof stateByLabel],
    title: normalizeGateRequirement(match[4]),
  }))
}

function readFinancePrdGateRequirements() {
  const prd = readFileSync(FINANCE_PRD_PATH, "utf8")
  return [
    ...prd.matchAll(
      /^### Batch (\d):[\s\S]*?^Gates:\n\n([\s\S]*?)\n\n^Rollback:/gm
    ),
  ].map((match) => ({
    sequence: Number(match[1]),
    requirements: match[2].split(/\n(?=- )/).map(normalizeGateRequirement),
  }))
}

function readFinancePrdDefinitionOfDone() {
  const prd = readFileSync(FINANCE_PRD_PATH, "utf8")
  const match = prd.match(
    /^## Definition Of Done\n\n([\s\S]*?)\n\n^## Decision Log/m
  )

  return (match?.[1] ?? "")
    .split(/\n(?=- )/)
    .filter(Boolean)
    .map(normalizeGateRequirement)
}

function readFinancePrdCutoverRules() {
  const prd = readFileSync(FINANCE_PRD_PATH, "utf8")
  const match = prd.match(
    /^## Production Cutover Rules\n\n([\s\S]*?)\n\n^## Objective Traceability/m
  )

  return (match?.[1] ?? "")
    .split(/\n(?=- )/)
    .filter(Boolean)
    .map(normalizeGateRequirement)
}

function readFinancePrdTestMatrix() {
  const prd = readFileSync(FINANCE_PRD_PATH, "utf8")
  const match = prd.match(
    /^## Test And Edge-Case Matrix\n\n([\s\S]*?)\n\nTests cover/m
  )

  return (match?.[1] ?? "")
    .split("\n")
    .slice(2)
    .filter((line) => line.startsWith("|"))
    .map((line) => {
      const [area, requiredCases] = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim())

      return { area, requiredCases }
    })
}

function readFinancePrdSecurityControls() {
  const prd = readFileSync(FINANCE_PRD_PATH, "utf8")
  const match = prd.match(
    /^## Security, Privacy, And RLS\n\n([\s\S]*?)\n\n^## Public Signup And Contact Flow/m
  )

  return (match?.[1] ?? "")
    .split(/\n(?=- )/)
    .filter(Boolean)
    .map(normalizeGateRequirement)
}

function readFinancePrdFailureStates() {
  const prd = readFileSync(FINANCE_PRD_PATH, "utf8")
  const match = prd.match(
    /^## Failure And Empty States\n\n([\s\S]*?)\n\n^## Accessibility And Responsive Behavior/m
  )

  return (match?.[1] ?? "")
    .split(/\n(?=- )/)
    .filter(Boolean)
    .map(normalizeGateRequirement)
}

describe("finance release planning graph", () => {
  it("registers the graph under Finance roadmaps", () => {
    const input = buildPrototypeLabInput({
      selectedEntryId: "finance-release-plan",
    })
    const tree = listPrototypeLabSidebarTree()
    const financeFolder = tree.find((node) => node.id === "finance")
    const roadmapsFolder =
      financeFolder?.kind === "folder"
        ? financeFolder.children.find((node) => node.id === "finance:roadmaps")
        : null
    const planEntry =
      roadmapsFolder?.kind === "folder"
        ? roadmapsFolder.children.find(
            (node) => node.id === "finance-release-plan"
          )
        : null

    expect(input.selectedEntry).toMatchObject({
      id: "finance-release-plan",
      projectId: "finance",
      title: "Finance release plan",
    })
    expect(planEntry?.kind === "entry" ? planEntry.href : null).toBe(
      "/admin/platform/prototypes?entry=finance-release-plan"
    )
    expect(
      resolvePrototypeLabSidebarOpenFolderIds("finance-release-plan")
    ).toEqual(["finance", "finance:roadmaps"])
  })

  it("models exactly seven ordered merge batches and seven gates", () => {
    expect(FINANCE_RELEASE_PLAN_COUNTS).toMatchObject({
      approvals: 4,
      batches: 7,
      gates: 7,
      researchTracks: 7,
    })
    expect(FINANCE_RELEASE_PLAN_BATCHES.map((batch) => batch.sequence)).toEqual(
      [1, 2, 3, 4, 5, 6, 7]
    )
    expect(FINANCE_RELEASE_PLAN_GATES).toHaveLength(7)
    expect(FINANCE_RELEASE_PLAN_RESEARCH).toHaveLength(7)
  })

  it("keeps all 36 proof requirements in exact source order", () => {
    const sourceGates = readFinancePrdGateRequirements()
    const graphEvidence = FINANCE_RELEASE_PLAN_GATES.map((gate) =>
      (gate.gateEvidence ?? []).map((item) =>
        normalizeGateRequirement(item.title)
      )
    )
    const evidenceIds = FINANCE_RELEASE_PLAN_GATES.flatMap((gate) =>
      (gate.gateEvidence ?? []).map((item) => item.id)
    )

    expect(sourceGates.map((gate) => gate.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ])
    expect(sourceGates.map((gate) => gate.requirements.length)).toEqual([
      5, 3, 5, 5, 4, 6, 8,
    ])
    expect(graphEvidence).toEqual(sourceGates.map((gate) => gate.requirements))
    expect(evidenceIds).toHaveLength(36)
    expect(new Set(evidenceIds).size).toBe(evidenceIds.length)
    expect(
      FINANCE_RELEASE_PLAN_GATES.every(
        (gate) =>
          gate.sections[0]?.label === "Proof required" &&
          gate.sections[0]?.items.length === gate.gateEvidence?.length
      )
    ).toBe(true)
  })

  it("tracks all 12 definition-of-done criteria against valid graph evidence", () => {
    const sourceCriteria = readFinancePrdDefinitionOfDone()
    const criterionIds = FINANCE_PLAN_COMPLETION.map(
      (criterion) => criterion.id
    )
    const definitionCoverage = FINANCE_PRD_SECTION_COVERAGE.find(
      (entry) => entry.section === "Definition Of Done"
    )
    const coveredTargets = new Set(
      definitionCoverage?.evidence.flatMap((group) =>
        group.nodeIds.map((nodeId) => `${group.viewId}:${nodeId}`)
      )
    )

    expect(sourceCriteria).toHaveLength(12)
    expect(
      FINANCE_PLAN_COMPLETION.map((criterion) =>
        normalizeGateRequirement(criterion.title)
      )
    ).toEqual(sourceCriteria)
    expect(new Set(criterionIds).size).toBe(criterionIds.length)
    expect(FINANCE_PLAN_COMPLETION_COUNTS).toEqual({
      collecting: 0,
      notStarted: 12,
      total: 12,
      verified: 0,
    })

    for (const criterion of FINANCE_PLAN_COMPLETION) {
      const view = FINANCE_PLANNING_VIEWS.find(
        (candidate) => candidate.id === criterion.target.viewId
      )
      expect(view, criterion.id).toBeDefined()
      expect(
        view?.buildNodes().some((node) => node.id === criterion.target.nodeId),
        criterion.id
      ).toBe(true)
      expect(
        coveredTargets.has(
          `${criterion.target.viewId}:${criterion.target.nodeId}`
        ),
        criterion.id
      ).toBe(true)
    }

    expect(
      buildFinancePlanCompletion({
        [criterionIds[0]]: "collecting",
        [criterionIds[1]]: "verified",
      }).slice(0, 2)
    ).toMatchObject([{ state: "collecting" }, { state: "verified" }])
  })

  it("tracks all 16 test-matrix areas against valid graph evidence", () => {
    const sourceAreas = readFinancePrdTestMatrix()
    const areaIds = FINANCE_PLAN_TEST_MATRIX.map((area) => area.id)

    expect(sourceAreas).toHaveLength(16)
    expect(
      FINANCE_PLAN_TEST_MATRIX.map(({ area, requiredCases }) => ({
        area,
        requiredCases,
      }))
    ).toEqual(sourceAreas)
    expect(new Set(areaIds).size).toBe(areaIds.length)
    expect(FINANCE_PLAN_TEST_MATRIX_COUNTS).toEqual({
      collecting: 0,
      notStarted: 16,
      total: 16,
      verified: 0,
    })

    for (const area of FINANCE_PLAN_TEST_MATRIX) {
      const view = FINANCE_PLANNING_VIEWS.find(
        (candidate) => candidate.id === area.target.viewId
      )
      expect(view, area.id).toBeDefined()
      expect(
        view?.buildNodes().some((node) => node.id === area.target.nodeId),
        area.id
      ).toBe(true)
    }

    expect(
      buildFinancePlanTestMatrix({ [areaIds[0]]: "collecting" })[0]
    ).toMatchObject({ state: "collecting" })

    const verifiedTestAreaStates = Object.fromEntries(
      areaIds.map((areaId) => [areaId, "verified" as const])
    )
    expect(
      buildFinancePlanCompletion(
        { "completion-clean-canary": "verified" },
        {},
        verifiedTestAreaStates
      ).find((criterion) => criterion.id === "completion-clean-canary")
    ).toMatchObject({ state: "collecting" })
  })

  it("tracks all 18 security and privacy controls against valid graph evidence", () => {
    const sourceControls = readFinancePrdSecurityControls()
    const controlIds = FINANCE_PLAN_SECURITY_CONTROLS.map(
      (control) => control.id
    )

    expect(sourceControls).toHaveLength(18)
    expect(
      FINANCE_PLAN_SECURITY_CONTROLS.map((control) =>
        normalizeGateRequirement(control.title)
      )
    ).toEqual(sourceControls)
    expect(new Set(controlIds).size).toBe(controlIds.length)
    expect(FINANCE_PLAN_SECURITY_CONTROL_COUNTS).toEqual({
      collecting: 0,
      notStarted: 18,
      total: 18,
      verified: 0,
    })

    for (const control of FINANCE_PLAN_SECURITY_CONTROLS) {
      const view = FINANCE_PLANNING_VIEWS.find(
        (candidate) => candidate.id === control.target.viewId
      )
      expect(view, control.id).toBeDefined()
      expect(
        view?.buildNodes().some((node) => node.id === control.target.nodeId),
        control.id
      ).toBe(true)
    }

    expect(
      buildFinancePlanSecurityControls({ [controlIds[0]]: "collecting" })[0]
    ).toMatchObject({ state: "collecting" })

    const verifiedCutoverStates = Object.fromEntries(
      FINANCE_PLAN_CUTOVER.map((rule) => [rule.id, "verified" as const])
    )
    const verifiedTestAreaStates = Object.fromEntries(
      FINANCE_PLAN_TEST_MATRIX.map((area) => [area.id, "verified" as const])
    )
    const verifiedFailureStateStates = Object.fromEntries(
      FINANCE_PLAN_FAILURE_STATES.map((failureState) => [
        failureState.id,
        "verified" as const,
      ])
    )
    expect(
      buildFinancePlanCompletion(
        { "completion-clean-canary": "verified" },
        verifiedCutoverStates,
        verifiedTestAreaStates,
        {},
        verifiedFailureStateStates
      ).find((criterion) => criterion.id === "completion-clean-canary")
    ).toMatchObject({ state: "collecting" })
  })

  it("tracks all 15 failure and empty states against valid graph evidence", () => {
    const sourceFailureStates = readFinancePrdFailureStates()
    const failureStateIds = FINANCE_PLAN_FAILURE_STATES.map(
      (failureState) => failureState.id
    )

    expect(sourceFailureStates).toHaveLength(15)
    expect(
      FINANCE_PLAN_FAILURE_STATES.map((failureState) =>
        normalizeGateRequirement(failureState.title)
      )
    ).toEqual(sourceFailureStates)
    expect(new Set(failureStateIds).size).toBe(failureStateIds.length)
    expect(FINANCE_PLAN_FAILURE_STATE_COUNTS).toEqual({
      collecting: 0,
      notStarted: 15,
      total: 15,
      verified: 0,
    })

    for (const failureState of FINANCE_PLAN_FAILURE_STATES) {
      const view = FINANCE_PLANNING_VIEWS.find(
        (candidate) => candidate.id === failureState.target.viewId
      )
      expect(view, failureState.id).toBeDefined()
      expect(
        view
          ?.buildNodes()
          .some((node) => node.id === failureState.target.nodeId),
        failureState.id
      ).toBe(true)
    }

    expect(
      buildFinancePlanFailureStates({
        [failureStateIds[0]]: "collecting",
      })[0]
    ).toMatchObject({ state: "collecting" })

    const verifiedCutoverStates = Object.fromEntries(
      FINANCE_PLAN_CUTOVER.map((rule) => [rule.id, "verified" as const])
    )
    const verifiedTestAreaStates = Object.fromEntries(
      FINANCE_PLAN_TEST_MATRIX.map((area) => [area.id, "verified" as const])
    )
    const verifiedSecurityControlStates = Object.fromEntries(
      FINANCE_PLAN_SECURITY_CONTROLS.map((control) => [
        control.id,
        "verified" as const,
      ])
    )
    expect(
      buildFinancePlanCompletion(
        { "completion-clean-canary": "verified" },
        verifiedCutoverStates,
        verifiedTestAreaStates,
        verifiedSecurityControlStates
      ).find((criterion) => criterion.id === "completion-clean-canary")
    ).toMatchObject({ state: "collecting" })
  })

  it("tracks all nine production cutover rules and blocks premature completion", () => {
    const sourceRules = readFinancePrdCutoverRules()
    const ruleIds = FINANCE_PLAN_CUTOVER.map((rule) => rule.id)

    expect(sourceRules).toHaveLength(9)
    expect(
      FINANCE_PLAN_CUTOVER.map((rule) => normalizeGateRequirement(rule.title))
    ).toEqual(sourceRules)
    expect(new Set(ruleIds).size).toBe(ruleIds.length)
    expect(FINANCE_PLAN_CUTOVER_COUNTS).toEqual({
      collecting: 0,
      notStarted: 9,
      total: 9,
      verified: 0,
    })

    for (const rule of FINANCE_PLAN_CUTOVER) {
      const view = FINANCE_PLANNING_VIEWS.find(
        (candidate) => candidate.id === rule.target.viewId
      )
      expect(view, rule.id).toBeDefined()
      expect(
        view?.buildNodes().some((node) => node.id === rule.target.nodeId),
        rule.id
      ).toBe(true)
    }

    expect(
      buildFinancePlanCutover({ [ruleIds[0]]: "collecting" })[0]
    ).toMatchObject({ state: "collecting" })

    const finalCriterionId = "completion-clean-canary"
    expect(
      buildFinancePlanCompletion({ [finalCriterionId]: "verified" }).find(
        (criterion) => criterion.id === finalCriterionId
      )
    ).toMatchObject({ state: "collecting" })

    const verifiedCutoverStates = Object.fromEntries(
      ruleIds.map((ruleId) => [ruleId, "verified" as const])
    )
    const verifiedTestAreaStates = Object.fromEntries(
      FINANCE_PLAN_TEST_MATRIX.map((area) => [area.id, "verified" as const])
    )
    const verifiedSecurityControlStates = Object.fromEntries(
      FINANCE_PLAN_SECURITY_CONTROLS.map((control) => [
        control.id,
        "verified" as const,
      ])
    )
    const verifiedFailureStateStates = Object.fromEntries(
      FINANCE_PLAN_FAILURE_STATES.map((failureState) => [
        failureState.id,
        "verified" as const,
      ])
    )
    expect(
      buildFinancePlanCompletion(
        { [finalCriterionId]: "verified" },
        verifiedCutoverStates,
        verifiedTestAreaStates,
        verifiedSecurityControlStates,
        verifiedFailureStateStates
      ).find((criterion) => criterion.id === finalCriterionId)
    ).toMatchObject({ state: "verified" })
  })

  it("connects the unsafe starting point through every merge gate to production", () => {
    const edges = buildFinanceReleasePlanEdges()

    expect(edges).toContainEqual(
      expect.objectContaining({
        source: FINANCE_RELEASE_PLAN_NODE_IDS.start,
        target: FINANCE_RELEASE_PLAN_NODE_IDS.batch1,
      })
    )
    expect(edges).toContainEqual(
      expect.objectContaining({
        source: FINANCE_RELEASE_PLAN_NODE_IDS.gate7,
        target: FINANCE_RELEASE_PLAN_NODE_IDS.finish,
      })
    )
    expect(edges).toHaveLength(31)
    expect(edges).toContainEqual(
      expect.objectContaining({
        source: FINANCE_RELEASE_PLAN_NODE_IDS.approvalFiscal,
        target: FINANCE_RELEASE_PLAN_NODE_IDS.batch7,
      })
    )
  })

  it("derives every batch approval and research path from structured inputs", () => {
    const nodes = buildFinanceReleasePlanNodes()
    const edges = buildFinanceReleasePlanEdges()
    const nodeKinds = new Map(nodes.map((node) => [node.id, node.data.kind]))
    const batchInputs = FINANCE_RELEASE_PLAN_BATCHES.flatMap((batch) =>
      (batch.inputNodeIds ?? []).map((source) => ({
        source,
        target: batch.id,
      }))
    )
    const researchInputs = batchInputs.filter(
      ({ source }) => nodeKinds.get(source) === "research"
    )
    const approvalInputs = batchInputs.filter(
      ({ source }) => nodeKinds.get(source) === "decision"
    )

    for (const batch of FINANCE_RELEASE_PLAN_BATCHES) {
      expect(batch.inputNodeIds?.length, batch.title).toBeGreaterThan(0)
      expect(new Set(batch.inputNodeIds).size, batch.title).toBe(
        batch.inputNodeIds?.length
      )
    }

    for (const input of batchInputs) {
      expect(nodeKinds.has(input.source), input.source).toBe(true)
      expect(["decision", "research"], input.source).toContain(
        nodeKinds.get(input.source)
      )
      expect(edges).toContainEqual(expect.objectContaining(input))
    }

    expect(researchInputs).toHaveLength(8)
    expect(approvalInputs).toHaveLength(7)
    expect(new Set(researchInputs.map(({ source }) => source))).toEqual(
      new Set(FINANCE_RELEASE_PLAN_RESEARCH.map(({ id }) => id))
    )
    expect(new Set(approvalInputs.map(({ source }) => source))).toEqual(
      new Set([
        FINANCE_RELEASE_PLAN_NODE_IDS.approvalRelease,
        FINANCE_RELEASE_PLAN_NODE_IDS.approvalFiscal,
        FINANCE_RELEASE_PLAN_NODE_IDS.approvalFinance,
        FINANCE_RELEASE_PLAN_NODE_IDS.approvalVisual,
      ])
    )
    expect(edges).toContainEqual(
      expect.objectContaining({
        source: FINANCE_RELEASE_PLAN_NODE_IDS.approvalFinance,
        target: FINANCE_RELEASE_PLAN_NODE_IDS.batch2,
      })
    )
    expect(edges).toContainEqual(
      expect.objectContaining({
        source: FINANCE_RELEASE_PLAN_NODE_IDS.research3,
        target: FINANCE_RELEASE_PLAN_NODE_IDS.batch7,
      })
    )
  })

  it("exposes all four open decisions as a roadmap navigation target", () => {
    const decisions = FINANCE_RELEASE_PLAN_NAVIGATION.find(
      (target) => target.label === "Decisions"
    )

    expect(decisions?.nodeIds).toEqual([
      FINANCE_RELEASE_PLAN_NODE_IDS.approvalRelease,
      FINANCE_RELEASE_PLAN_NODE_IDS.approvalFiscal,
      FINANCE_RELEASE_PLAN_NODE_IDS.approvalFinance,
      FINANCE_RELEASE_PLAN_NODE_IDS.approvalVisual,
    ])
  })

  it("derives one actionable queue from every open roadmap input", () => {
    const batchIds = new Set(FINANCE_RELEASE_PLAN_BATCHES.map(({ id }) => id))
    const openInputIds = FINANCE_PLAN_OPEN_INPUTS.map(({ nodeId }) => nodeId)

    expect(FINANCE_PLAN_OPEN_INPUT_COUNTS).toEqual({
      decisions: 0,
      research: 2,
      total: 2,
    })
    expect(FINANCE_PLAN_OPEN_DECISIONS).toHaveLength(0)
    expect(FINANCE_PLAN_OPEN_RESEARCH).toHaveLength(2)
    expect(FINANCE_PLAN_DECISION_ITEM_COUNTS).toEqual({
      approved: 13,
      changesRequired: 0,
      pending: 0,
      total: 13,
    })
    expect(FINANCE_PLAN_RESEARCH_ITEM_COUNTS).toEqual({
      collecting: 2,
      notStarted: 2,
      total: 28,
      verified: 24,
    })
    expect(
      FINANCE_PLAN_OPEN_RESEARCH.map(
        (research) => research.researchItemCounts?.total
      )
    ).toEqual(Array(2).fill(4))
    expect(new Set(openInputIds).size).toBe(openInputIds.length)

    for (const input of FINANCE_PLAN_OPEN_INPUTS) {
      expect(input.batchIds.length, input.title).toBeGreaterThan(0)
      expect(input.batchLabels).toHaveLength(input.batchIds.length)
      expect(
        input.batchIds.every((batchId) => batchIds.has(batchId)),
        input.title
      ).toBe(true)
    }

    expect(FINANCE_PLAN_OPEN_RESEARCH.map(({ nodeId }) => nodeId)).toEqual([
      FINANCE_RELEASE_PLAN_NODE_IDS.research6,
      FINANCE_RELEASE_PLAN_NODE_IDS.research7,
    ])
  })

  it("derives all four human decisions from 13 explicit approval criteria", () => {
    const expectedCriteria = [
      [
        "Approve seven sequential branches from current main",
        "Confirm there will be no giant snapshot commit or direct hard push",
        "Decide whether Batch 1 may ship early as an onboarding incident hotfix",
      ],
      [
        "Retain the counsel-approved fiscal sponsorship document as the canonical legal source",
        "Keep all money movement in external bank and accounting systems",
        "Use the application only for signatures, records, requests, approvals, external-payment evidence, and reporting",
        "Store no bank credentials and provide no payment, transfer, refund, or automated disbursement controls",
      ],
      [
        "Create Finance as its own card without reusing economic-engine",
        "Keep Overview, Opportunities, Fundraising, and Reporting as the Finance drawer views for now",
        "Keep reconciled records, sponsored-project records, drafts, and legacy estimates visibly separate without letting storage dictate UI",
      ],
      [
        "Use the existing Coach House design system and shadcn patterns as the implementation baseline",
        "Build records-only Finance UI without payment, bank-setup, transfer, refund, or disbursement controls",
        "Require desktop/mobile, empty/draft/review/reconciled/error, light/dark, and reduced-motion browser proof before release",
      ],
    ]
    const decisionItems = FINANCE_PLAN_DECISION_PROGRESS.flatMap(
      (decision) => decision.items
    )

    expect(FINANCE_PLAN_DECISION_PROGRESS).toHaveLength(4)
    expect(
      FINANCE_PLAN_DECISION_PROGRESS.map((decision) =>
        decision.items.map((item) => item.title)
      )
    ).toEqual(expectedCriteria)
    expect(decisionItems).toHaveLength(13)
    expect(new Set(decisionItems.map((item) => item.id)).size).toBe(13)
    expect(decisionItems.map((item) => item.state)).toEqual(
      Array(13).fill("approved")
    )
    expect(
      FINANCE_PLAN_DECISION_PROGRESS.map((decision) => decision.inputState)
    ).toEqual(Array(4).fill("resolved"))

    const firstDecisionIds = FINANCE_PLAN_DECISION_PROGRESS[0].items.map(
      (item) => item.id
    )
    expect(
      buildFinancePlanDecisionProgress({
        [firstDecisionIds[0]]: "changes_required",
      })[0]
    ).toMatchObject({
      decisionState: "changes_required",
      inputState: "open",
      itemCounts: {
        approved: 2,
        changesRequired: 1,
        pending: 0,
        total: 3,
      },
    })
    expect(
      buildFinancePlanDecisionProgress(
        Object.fromEntries(
          firstDecisionIds.map((itemId) => [itemId, "approved" as const])
        )
      )[0]
    ).toMatchObject({
      decisionState: "approved",
      inputState: "resolved",
      itemCounts: {
        approved: 3,
        changesRequired: 0,
        pending: 0,
        total: 3,
      },
    })
  })

  it("derives all seven research tracks from 28 stateful questions and evidence items", () => {
    const researchItems = FINANCE_RELEASE_PLAN_RESEARCH.flatMap(
      (research) => research.researchItems ?? []
    )
    const itemIds = researchItems.map((item) => item.id)

    expect(researchItems).toHaveLength(28)
    expect(new Set(itemIds).size).toBe(itemIds.length)
    expect(
      researchItems.filter((item) => item.kind === "question")
    ).toHaveLength(14)
    expect(
      researchItems.filter((item) => item.kind === "evidence")
    ).toHaveLength(14)
    expect(
      FINANCE_PLAN_RESEARCH_PROGRESS.map(
        (research) => research.itemCounts.total
      )
    ).toEqual(Array(7).fill(4))

    expect(
      FINANCE_RELEASE_PLAN_RESEARCH.map((research) => research.inputState)
    ).toEqual([
      "resolved",
      "resolved",
      "resolved",
      "resolved",
      "resolved",
      "open",
      "open",
    ])

    for (const research of FINANCE_RELEASE_PLAN_RESEARCH) {
      expect(research.sections.flatMap((section) => section.items)).toEqual(
        research.researchItems?.map((item) => item.title)
      )
    }

    const firstTrackIds = FINANCE_PLAN_RESEARCH_PROGRESS[0].items.map(
      (item) => item.id
    )
    expect(
      buildFinancePlanResearchProgress({
        [firstTrackIds[0]]: "collecting",
      })[0]
    ).toMatchObject({
      inputState: "open",
      itemCounts: {
        collecting: 1,
        notStarted: 0,
        total: 4,
        verified: 3,
      },
    })
    expect(
      buildFinancePlanResearchProgress(
        Object.fromEntries(
          firstTrackIds.map((itemId) => [itemId, "verified" as const])
        )
      )[0]
    ).toMatchObject({
      inputState: "resolved",
      itemCounts: {
        collecting: 0,
        notStarted: 0,
        total: 4,
        verified: 4,
      },
    })
  })

  it("keeps the approved fiscal document boundary source-backed and explicit", () => {
    const packet = readFileSync(FISCAL_POLICY_PACKET_PATH, "utf8")

    expect(packet).toContain("Status: superseded as a release blocker")
    expect(packet).toContain("counsel-approved document remains")
    expect(packet).toContain(
      "The application does not receive, hold, transfer, refund, or disburse money"
    )
    expect(packet).toContain(
      "The 7% fee applies only to a fiscally sponsored grant allocation."
    )
    expect(packet).toContain("Agreement section 7")
    expect(packet).toContain("Charges 7% of all cash and in-kind contributions")
    expect(packet).toContain("IRS Revenue Ruling 68-489")
    expect(packet).toContain("National Network of Fiscal Sponsors")
    expect(packet).toContain("## Draft Replacement Copy")
    expect(packet).toContain("## Sign-Off Record")
    expect(packet).toContain("Approved; metadata pending")
    expect(packet).toContain(
      "Any future in-app payment feature requires a separate product plan and approval"
    )
  })

  it("records an exact resource-map inventory without mixing local and production snapshots", () => {
    const baseline = readFileSync(RESOURCE_MAP_INVENTORY_BASELINE_PATH, "utf8")

    expect(baseline).toMatch(
      /\| Local engine\s+\| Discovered intake records\s+\| 4,249 \|/u
    )
    expect(baseline).toMatch(
      /\| Local engine\s+\| Contract-complete\s+\|\s+741 \|/u
    )
    expect(baseline).toMatch(
      /\| Production\s+\| Staged import records\s+\| 2,184 \|/u
    )
    expect(baseline).toMatch(
      /\| Production\s+\| Contract-verified with approved verification ledger\s+\|\s+853 \|/u
    )
    expect(baseline).toContain(
      "verified = approved = promoted = public = `853`"
    )
    expect(baseline).toContain(
      "The local data engine and production database are different snapshots"
    )
    expect(baseline).toMatch(
      /No source was fetched, imported, reviewed,\s+promoted, unpublished, or otherwise changed\./u
    )
  })

  it("locks public-map scale budgets to measured payload and parity evidence", () => {
    const budget = readFileSync(PUBLIC_MAP_PERFORMANCE_BUDGET_PATH, "utf8")

    expect(budget).toContain("5,046")
    expect(budget).toContain("9,210,384 B")
    expect(budget).toContain("4,722")
    expect(budget).toContain("500 of 853")
    expect(budget).toContain("Current bbox plus overscan only")
    expect(budget).toContain("Cursor-based; 50 results maximum")
    expect(budget).toContain("at or below 16 ms per update")
    expect(budget).toContain("Do not switch to vector tiles solely")
    expect(budget).toContain("Screenshots are still required")
    expect(budget).toContain("does not implement Batch 4")
  })

  it("locks public-map contact visibility, auth replay, and shared rate limits", () => {
    const threatModel = readFileSync(
      PUBLIC_MAP_CONTACT_THREAT_MODEL_PATH,
      "utf8"
    )

    expect(threatModel).toMatch(/Public resource contacts\s+\|\s+897/u)
    expect(threatModel).toMatch(/Private resource contacts\s+\|\s+166/u)
    expect(threatModel).toContain("public_service_access")
    expect(threatModel).toContain("authenticated_representative")
    expect(threatModel).toContain("Unclassified contacts default to `private`")
    expect(threatModel).toContain("10-minute expiry")
    expect(threatModel).toContain("20 / 10 min")
    expect(threatModel).toContain("HMAC-derived, rotating IP-risk hash")
    expect(threatModel).toContain("no process-memory limiter and no hCaptcha")
    expect(threatModel).toContain(
      "location, NWS, and cooling-center research completes separately"
    )
  })

  it("locks location privacy, NWS thresholds, cache TTLs, and cooling eligibility", () => {
    const contract = readFileSync(
      PUBLIC_MAP_LOCATION_WEATHER_CONTRACT_PATH,
      "utf8"
    )
    const fixture = JSON.parse(
      readFileSync(PUBLIC_MAP_WEATHER_FIXTURE_PATH, "utf8")
    ) as {
      cacheSeconds: Record<string, number>
      cases: Array<{ id: string }>
      currentHeatAlertEvents: string[]
      threshold: {
        minimumCelsius: number
        minimumConsecutiveHours: number
        windowHours: number
      }
    }

    expect(contract).toContain("Status: Research 5 complete")
    expect(contract).toMatch(
      /current `next\.config\.ts` no\s+longer contains that Permissions-Policy header/u
    )
    expect(contract).toContain("spins the globe before the user acts")
    expect(contract).toContain("0.05-degree latitude/longitude cell")
    expect(contract).toMatch(/Production public cooling-center rows\s+\|\s+0/u)
    expect(contract).toMatch(/Current local cooling candidates\s+\|\s+3,542/u)
    expect(contract).toMatch(/Candidates with `lastVerifiedAt`\s+\|\s+0/u)
    expect(contract).toContain("CoachHouseFind/1.0 (https://coachhouse.app)")
    expect(contract).toContain("Heat Advisory`, `Extreme Heat Watch`")
    expect(contract).toContain("37.78°C")
    expect(contract).toContain("standing/year-round site")
    expect(contract).toContain("event-activated or seasonal site")
    expect(contract).toContain("screenshots are supplied")

    expect(fixture.currentHeatAlertEvents).toEqual([
      "Heat Advisory",
      "Extreme Heat Watch",
      "Extreme Heat Warning",
    ])
    expect(fixture.threshold).toEqual({
      metrics: ["heatIndex", "apparentTemperature", "temperature"],
      minimumCelsius: 37.78,
      minimumConsecutiveHours: 2,
      windowHours: 24,
    })
    expect(fixture.cacheSeconds).toMatchObject({
      alertsFresh: 120,
      alertsStaleIfError: 900,
      forecastFresh: 1800,
      forecastStaleIfError: 21600,
      pointFresh: 86400,
      pointStaleIfError: 604800,
    })
    expect(fixture.cases).toHaveLength(14)
    expect(new Set(fixture.cases.map(({ id }) => id)).size).toBe(14)
  })

  it("locks the Stripe Connect account, event, and environment contract", () => {
    const contract = readFileSync(STRIPE_CONNECT_CONTRACT_PATH, "utf8")
    const fixture = JSON.parse(
      readFileSync(STRIPE_CONNECT_FIXTURE_PATH, "utf8")
    ) as {
      account: {
        controller: Record<string, unknown>
        forbiddenFields: string[]
      }
      cases: Array<{ id: string }>
      currentStable: {
        apiVersion: string
        stripeCli: string
        stripeNode: string
      }
      eventDestination: {
        canonicalGrossEvent: string
        events: string[]
        payloadStyle: string
        source: string
      }
      installed: {
        apiVersion: string
        stripeCli: string
        stripeNode: string
      }
      paymentLink: {
        forbiddenFields: string[]
        requestContext: string
      }
      secrets: string[]
    }

    expect(contract).toContain("Status: Research 6 complete")
    expect(contract).toContain("Use the Accounts v1 API")
    expect(contract).toContain('fees: { payer: "account" }')
    expect(contract).toContain('losses: { payments: "stripe" }')
    expect(contract).toContain('stripe_dashboard: { type: "full" }')
    expect(contract).toContain(
      "The repository has no approved target-country list"
    )
    expect(contract).toContain("Production live fails closed")
    expect(contract).toContain("Only `payment_intent.succeeded` creates")

    expect(fixture.installed).toEqual({
      apiVersion: "2025-08-27.basil",
      stripeCli: "1.23.3",
      stripeNode: "18.5.0",
    })
    expect(fixture.currentStable).toEqual({
      apiVersion: "2026-07-29.dahlia",
      stripeCli: "1.45.1",
      stripeNode: "22.4.0",
    })
    expect(fixture.account.controller).toEqual({
      fees: { payer: "account" },
      losses: { payments: "stripe" },
      requirement_collection: "stripe",
      stripe_dashboard: { type: "full" },
    })
    expect(fixture.account.forbiddenFields).toContain("type")
    expect(fixture.paymentLink.forbiddenFields).toEqual(
      expect.arrayContaining([
        "application_fee_amount",
        "application_fee_percent",
        "on_behalf_of",
        "transfer_data",
      ])
    )
    expect(fixture.paymentLink.requestContext).toBe("stripeAccount")
    expect(fixture.eventDestination).toMatchObject({
      canonicalGrossEvent: "payment_intent.succeeded",
      payloadStyle: "snapshot",
      source: "connected_accounts",
    })
    expect(fixture.eventDestination.events).toHaveLength(24)
    expect(fixture.cases).toHaveLength(24)
    expect(fixture.secrets).toEqual([
      "STRIPE_CONNECT_WEBHOOK_SECRET",
      "STRIPE_TEST_CONNECT_WEBHOOK_SECRET",
    ])
  })

  it("derives one durable percentage from 35 current-wave criteria", () => {
    const sourceCriteria = readPrdCurrentWaveCriteria()
    const trackedCriteria = FINANCE_PLAN_WAVES.flatMap((wave) => wave.criteria)

    expect(FINANCE_PLAN_WAVES.map((wave) => wave.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ])
    expect(FINANCE_PLAN_WAVES.map((wave) => wave.criteria.length)).toEqual(
      Array(7).fill(5)
    )
    expect(FINANCE_PLAN_WAVES.map((wave) => wave.status)).toEqual([
      "production_verified",
      "active",
      "active",
      "production_verified",
      "active",
      "production_verified",
      "queued",
    ])
    expect(FINANCE_PLAN_WAVE_STATUS_COUNTS).toEqual({
      active: 3,
      codeComplete: 0,
      previewVerified: 0,
      productionVerified: 3,
      queued: 1,
      total: 7,
    })
    expect(FINANCE_PLAN_WAVE_COUNTS).toEqual({
      complete: 26,
      inProgress: 6,
      notStarted: 3,
      total: 35,
    })
    expect(FINANCE_PLAN_COMPLETION_PERCENTAGE).toBe(74)
    expect(sourceCriteria).toHaveLength(35)
    expect(sourceCriteria.map((criterion) => criterion.id)).toEqual(
      trackedCriteria.map((criterion) => criterion.id)
    )
    expect(sourceCriteria.map((criterion) => criterion.state)).toEqual(
      trackedCriteria.map((criterion) => criterion.state)
    )
    expect(sourceCriteria.map((criterion) => criterion.title)).toEqual(
      trackedCriteria.map((criterion) =>
        normalizeGateRequirement(criterion.title)
      )
    )
    expect(sourceCriteria.map((criterion) => criterion.checked)).toEqual(
      trackedCriteria.map((criterion) => criterion.state === "complete")
    )
    expect(FINANCE_PLAN_CURRENT_WAVE.id).toBe("wave-2-signup-legal")
    expect(FINANCE_PLAN_NEXT_CRITERION?.id).toBe("wave-2-criterion-3")
    expect(FINANCE_PLAN_WAVES[2].criteria[1]).toMatchObject({
      id: "wave-3-criterion-2",
      state: "in_progress",
    })
    expect(FINANCE_PLAN_WAVES[2].criteria[1].evidence.join(" ")).toContain(
      "PR #199"
    )
    expect(FINANCE_PLAN_WAVES[5].criteria[0].evidence.join(" ")).toContain(
      "1,309 held rows"
    )
    expect(FINANCE_PLAN_WAVES[5].criteria[2].evidence.join(" ")).toContain(
      "PR #200"
    )
  })

  it("preserves all seven historical batches and 37 scope items", () => {
    const prdBatchScopeItems = readPrdBatchScopeItems()
    const workItems = FINANCE_PLAN_BATCH_PROGRESS.flatMap(
      (batch) => batch.items
    )

    expect(prdBatchScopeItems).toHaveLength(7)
    expect(prdBatchScopeItems.map((items) => items.length)).toEqual([
      6, 4, 4, 4, 8, 5, 6,
    ])
    expect(workItems).toHaveLength(37)
    expect(new Set(workItems.map((item) => item.id)).size).toBe(37)
    expect(workItems.map((item) => item.state)).toEqual([
      ...Array(13).fill("complete"),
      "in_progress",
      ...Array(23).fill("not_started"),
    ])
    expect(FINANCE_PLAN_BATCH_WORK_COUNTS).toEqual({
      complete: 13,
      inProgress: 1,
      notStarted: 23,
      total: 37,
    })
    expect(
      FINANCE_PLAN_BATCH_PROGRESS.map((batch) =>
        batch.items.map((item) => normalizeGateRequirement(item.title))
      )
    ).toEqual(prdBatchScopeItems)

    const firstWorkId = FINANCE_PLAN_BATCH_PROGRESS[0].items[0].id
    expect(
      buildFinancePlanBatchProgress({ [firstWorkId]: "in_progress" })[0]
    ).toMatchObject({
      executionState: "in_progress",
      workItemCounts: {
        complete: 5,
        inProgress: 1,
        notStarted: 0,
        total: 6,
      },
    })

    const firstBatchCompleteStates = Object.fromEntries(
      FINANCE_PLAN_BATCH_PROGRESS[0].items.map((item) => [
        item.id,
        "complete" as const,
      ])
    )
    expect(
      buildFinancePlanBatchProgress(firstBatchCompleteStates, {
        [FINANCE_RELEASE_PLAN_NODE_IDS.batch1]: "merged",
      })[0]
    ).toMatchObject({
      executionState: "merged",
      workItemCounts: {
        complete: 6,
        inProgress: 0,
        notStarted: 0,
        total: 6,
      },
    })
  })

  it("shows the current work and uses one explicit status-color contract", () => {
    const roadmapNodes = buildFinanceReleasePlanNodes()
    const nodeData = (nodeId: string) =>
      roadmapNodes.find((node) => node.id === nodeId)?.data

    expect(FINANCE_PLAN_CURRENT_FOCUS).toMatchObject({
      complete: 26,
      percentage: 74,
      remaining: 9,
      total: 35,
      waveId: "wave-2-signup-legal",
      waveLabel: "Wave 2: Signup, recovery, and legal",
    })
    expect(FINANCE_PLAN_CURRENT_FOCUS.nextStep).toContain(
      "Verify direct and contextual signup"
    )
    expect(
      getFinancePlanNodeStatusTone(
        nodeData(FINANCE_RELEASE_PLAN_NODE_IDS.batch2)!
      )
    ).toBe("complete")
    expect(
      getFinancePlanNodeStatusTone(
        nodeData(FINANCE_RELEASE_PLAN_NODE_IDS.batch3)!
      )
    ).toBe("attention")
    expect(
      getFinancePlanNodeStatusTone(
        nodeData(FINANCE_RELEASE_PLAN_NODE_IDS.gate2)!
      )
    ).toBe("attention")
    expect(
      getFinanceReleasePlanNodeColor(
        nodeData(FINANCE_RELEASE_PLAN_NODE_IDS.batch2)!
      )
    ).toBe("#16a34a")
    expect(
      getFinanceReleasePlanNodeColor(
        nodeData(FINANCE_RELEASE_PLAN_NODE_IDS.batch3)!
      )
    ).toBe("#d97706")
    expect(
      getFinanceReleasePlanNodeColor(
        nodeData(FINANCE_RELEASE_PLAN_NODE_IDS.gate2)!
      )
    ).toBe("#d97706")

    const focusSource = readFinanceSource("finance-plan-current-focus.tsx")
    expect(focusSource).toContain("Complete")
    expect(focusSource).toContain("Needs info / in progress")
    expect(focusSource).toContain("Planned / reference")
    expect(focusSource).toContain("Risk / guardrail")
  })

  it("derives truthful ordered batch readiness from explicit source states", () => {
    const decisionNodes = FINANCE_RELEASE_PLAN_SUPPORT_NODES.filter(
      (node) => node.kind === "decision"
    )

    expect(
      FINANCE_RELEASE_PLAN_BATCHES.map((batch) => batch.executionState)
    ).toEqual([
      "merged",
      "merged",
      "in_progress",
      ...Array(4).fill("not_started"),
    ])
    expect(decisionNodes.map((node) => node.inputState)).toEqual(
      Array(4).fill("resolved")
    )
    expect(
      FINANCE_RELEASE_PLAN_RESEARCH.map((node) => node.inputState)
    ).toEqual([
      "resolved",
      "resolved",
      "resolved",
      "resolved",
      "resolved",
      "open",
      "open",
    ])
    expect(FINANCE_RELEASE_PLAN_GATES.map((gate) => gate.gateState)).toEqual([
      "proven",
      "collecting",
      "proven",
      ...Array(4).fill("not_started"),
    ])
    expect(FINANCE_PLAN_BATCH_READINESS_COUNTS).toEqual({
      blocked: 4,
      inProgress: 1,
      merged: 2,
      ready: 0,
      total: 7,
    })
    expect(
      FINANCE_PLAN_BATCH_READINESS.map((batch) => batch.readinessState)
    ).toEqual(["merged", "merged", "in_progress", ...Array(4).fill("blocked")])
    expect(FINANCE_PLAN_BATCH_READINESS[0]).toMatchObject({
      blockedByPredecessorBatch: false,
      blockedByPredecessorGate: false,
      openInputIds: [],
      predecessorBatchId: null,
      sequence: 1,
      workItemCounts: {
        complete: 6,
        inProgress: 0,
        notStarted: 0,
        total: 6,
      },
    })
    expect(FINANCE_PLAN_BATCH_READINESS[6]).toMatchObject({
      blockedByPredecessorBatch: true,
      blockedByPredecessorGate: true,
      openInputIds: [FINANCE_RELEASE_PLAN_NODE_IDS.research7],
      predecessorBatchId: FINANCE_RELEASE_PLAN_NODE_IDS.batch6,
      predecessorGateId: FINANCE_RELEASE_PLAN_NODE_IDS.gate6,
      sequence: 7,
    })
    expect(FINANCE_PLAN_GATE_READINESS_COUNTS).toEqual({
      collecting: 1,
      notStarted: 4,
      proven: 2,
      total: 7,
    })
    expect(FINANCE_PLAN_GATE_READINESS).toHaveLength(7)
    expect(FINANCE_PLAN_GATE_EVIDENCE_COUNTS).toEqual({
      collecting: 1,
      notStarted: 23,
      total: 36,
      verified: 12,
    })
    expect(
      FINANCE_PLAN_GATE_READINESS[0].evidence.map((item) => item.state)
    ).toEqual(Array(5).fill("verified"))
    expect(
      FINANCE_PLAN_GATE_READINESS.map((gate) => gate.evidenceCounts.total)
    ).toEqual([5, 3, 5, 5, 4, 6, 8])
    expect(FINANCE_PLAN_GATE_READINESS[1]).toMatchObject({
      evidenceCounts: {
        collecting: 1,
        notStarted: 0,
        total: 3,
        verified: 2,
      },
      gateState: "collecting",
    })
    expect(FINANCE_PLAN_GATE_READINESS[2]).toMatchObject({
      evidenceCounts: {
        collecting: 0,
        notStarted: 0,
        total: 5,
        verified: 5,
      },
      gateState: "proven",
    })

    const approvedDecisionItemStates = Object.fromEntries(
      FINANCE_PLAN_DECISION_PROGRESS.flatMap((decision) =>
        decision.items.map((item) => [item.id, "approved" as const])
      )
    )
    const verifiedResearchItemStates = Object.fromEntries(
      FINANCE_PLAN_RESEARCH_PROGRESS.flatMap((research) =>
        research.items.map((item) => [item.id, "verified" as const])
      )
    )
    const bypassedInputState = buildFinancePlanBatchReadiness({
      inputStates: Object.fromEntries(
        FINANCE_PLAN_OPEN_INPUTS.map((input) => [
          input.nodeId,
          "resolved" as const,
        ])
      ),
    })

    expect(bypassedInputState[1].openInputIds).not.toContain(
      FINANCE_RELEASE_PLAN_NODE_IDS.research2
    )
    expect(bypassedInputState[1].readinessState).toBe("merged")
    expect(bypassedInputState[2].openInputIds).not.toContain(
      FINANCE_RELEASE_PLAN_NODE_IDS.approvalFiscal
    )

    const mergedWithBaselineProof = buildFinancePlanBatchReadiness({
      executionStates: {
        [FINANCE_RELEASE_PLAN_NODE_IDS.batch1]: "merged",
      },
      decisionItemStates: approvedDecisionItemStates,
      researchItemStates: verifiedResearchItemStates,
    })

    expect(mergedWithBaselineProof[0]).toMatchObject({
      executionState: "merged",
      readinessState: "merged",
      workItemCounts: {
        complete: 6,
        inProgress: 0,
        notStarted: 0,
        total: 6,
      },
    })
    expect(mergedWithBaselineProof[1]).toMatchObject({
      blockedByPredecessorBatch: false,
      blockedByPredecessorGate: false,
      readinessState: "merged",
    })

    const gateOneEvidenceIds = FINANCE_PLAN_GATE_READINESS[0].evidence.map(
      (item) => item.id
    )
    const collectingGateState = buildFinancePlanGateReadiness({
      evidenceStates: {
        [gateOneEvidenceIds[0]]: "collecting",
      },
    })

    expect(collectingGateState[0]).toMatchObject({
      evidenceCounts: {
        collecting: 1,
        notStarted: 0,
        total: 5,
        verified: 4,
      },
      gateState: "collecting",
    })

    const verifiedGateOneEvidence = Object.fromEntries(
      gateOneEvidenceIds.map((evidenceId) => [evidenceId, "verified" as const])
    )
    const completedBatchOneWork = Object.fromEntries(
      FINANCE_PLAN_BATCH_PROGRESS[0].items.map((item) => [
        item.id,
        "complete" as const,
      ])
    )
    const provenNextState = buildFinancePlanBatchReadiness({
      evidenceStates: verifiedGateOneEvidence,
      executionStates: {
        [FINANCE_RELEASE_PLAN_NODE_IDS.batch1]: "merged",
      },
      decisionItemStates: approvedDecisionItemStates,
      researchItemStates: verifiedResearchItemStates,
      workItemStates: completedBatchOneWork,
    })

    expect(provenNextState[0]).toMatchObject({
      executionState: "merged",
      readinessState: "merged",
    })
    expect(provenNextState[1]).toMatchObject({
      blockedByPredecessorBatch: false,
      blockedByPredecessorGate: false,
      readinessState: "merged",
    })
    expect(provenNextState[2].readinessState).toBe("in_progress")

    const roadmapNodes = buildFinanceReleasePlanNodes()
    expect(
      roadmapNodes.find(
        (node) => node.id === FINANCE_RELEASE_PLAN_NODE_IDS.batch2
      )?.data
    ).toMatchObject({
      readinessDetails: ["4/4 work items complete"],
      readinessState: "merged",
      workItems: expect.arrayContaining([
        expect.objectContaining({ state: "complete" }),
      ]),
    })
    expect(
      roadmapNodes.find(
        (node) => node.id === FINANCE_RELEASE_PLAN_NODE_IDS.gate1
      )?.data
    ).toMatchObject({
      gateEvidence: expect.arrayContaining([
        expect.objectContaining({ state: "verified" }),
      ]),
      gateState: "proven",
      readinessDetails: ["5/5 proof items verified"],
    })
    expect(
      roadmapNodes.find(
        (node) => node.id === FINANCE_RELEASE_PLAN_NODE_IDS.research1
      )?.data
    ).toMatchObject({
      inputState: "resolved",
      readinessDetails: ["4/4 research items verified"],
      researchItems: expect.arrayContaining([
        expect.objectContaining({ state: "verified" }),
      ]),
    })
    expect(
      roadmapNodes.find(
        (node) => node.id === FINANCE_RELEASE_PLAN_NODE_IDS.approvalRelease
      )?.data
    ).toMatchObject({
      decisionItems: expect.arrayContaining([
        expect.objectContaining({ state: "approved" }),
      ]),
      inputState: "resolved",
      readinessDetails: ["3/3 approval criteria approved"],
    })
  })

  it("includes the additional research and approval evidence required by the PRD", () => {
    const researchText = FINANCE_RELEASE_PLAN_RESEARCH.map((research) =>
      JSON.stringify(research)
    ).join("\n")
    const allNodesText = buildFinanceReleasePlanNodes()
      .map((node) => JSON.stringify(node.data))
      .join("\n")

    expect(researchText).toContain(
      "Fiscal document and external-record workflow"
    )
    expect(researchText).toContain(
      "External finance record and import contract"
    )
    expect(researchText).toContain(
      "Map privacy, auth replay, location, and heat"
    )
    expect(researchText).toContain("Visual references, operations, and cutover")
    expect(allNodesText).toContain("UI direction approved; proof pending")
    expect(allNodesText).toContain("Never force-push main")
    expect(allNodesText).toContain("Verified gradual production release")
  })

  it("maps all seven PRD diagrams plus the roadmap and assurance path into selectable views", () => {
    const prdSource = readFileSync(FINANCE_PRD_PATH, "utf8")
    const mermaidBlocks = prdSource.match(/^```mermaid$/gmu) ?? []

    expect(mermaidBlocks).toHaveLength(7)
    expect(FINANCE_PLANNING_VIEW_COUNT).toBe(9)
    expect(FINANCE_PLANNING_VIEWS.map((view) => view.id)).toEqual([
      "roadmap",
      "dependencies",
      "system",
      "custody",
      "webhooks",
      "data",
      "signup",
      "weather",
      "assurance",
    ])

    for (const view of FINANCE_PLANNING_VIEWS) {
      const nodes = view.buildNodes()
      const edges = view.buildEdges()

      expect(nodes.length, `${view.id} nodes`).toBeGreaterThan(0)
      expect(edges.length, `${view.id} edges`).toBeGreaterThan(0)
      expect(new Set(nodes.map((node) => node.id)).size).toBe(nodes.length)
    }

    const dependencyView = FINANCE_PLANNING_VIEWS.find(
      (view) => view.id === "dependencies"
    )
    const dependencyEdges = dependencyView?.buildEdges() ?? []

    expect(dependencyEdges).toHaveLength(10)
    expect(dependencyEdges).toContainEqual(
      expect.objectContaining({
        source: "dependency-batch-1",
        target: "dependency-batch-6",
      })
    )

    const assuranceView = FINANCE_PLANNING_VIEWS.find(
      (view) => view.id === "assurance"
    )
    const assuranceNodes = assuranceView?.buildNodes() ?? []
    const assuranceEdges = assuranceView?.buildEdges() ?? []

    expect(assuranceNodes).toHaveLength(12)
    expect(assuranceEdges).toHaveLength(14)
    expect(assuranceView?.navigation.map((target) => target.label)).toEqual([
      "Boundaries",
      "Tests",
      "Release evidence",
      "Canaries",
      "Done",
    ])
    expect(assuranceEdges).toContainEqual(
      expect.objectContaining({
        source: "assurance-approval-record",
        target: "assurance-clean-artifact",
      })
    )
    expect(assuranceEdges).toContainEqual(
      expect.objectContaining({
        source: "assurance-organization-canary",
        target: "assurance-production-ready",
      })
    )
    expect(dependencyEdges).toContainEqual(
      expect.objectContaining({
        source: "dependency-batch-5",
        target: "dependency-batch-7",
      })
    )
  })

  it("keeps all seven React Flow diagrams in source-connection parity", () => {
    const prdSource = readFileSync(FINANCE_PRD_PATH, "utf8")
    const mermaidBlocks = Array.from(
      prdSource.matchAll(/^```mermaid\n([\s\S]*?)^```$/gmu),
      (match) => match[1]
    )
    const sourceConnectionCounts = mermaidBlocks.map((block) => {
      if (block.includes("sequenceDiagram")) {
        return block.match(/^\s*\w+-+>>\w+:/gmu)?.length ?? 0
      }
      if (block.includes("erDiagram")) {
        return block.match(/^\s*\w+\s+.+?\s+\w+\s+:/gmu)?.length ?? 0
      }
      return block.match(/-->/gu)?.length ?? 0
    })

    expect(FINANCE_PLAN_DIAGRAM_TRACEABILITY_COUNT).toBe(7)
    expect(FINANCE_PLAN_DIAGRAM_INDEX_COUNT).toBe(7)
    expect(
      FINANCE_PLAN_DIAGRAM_TRACEABILITY.map((entry) => entry.viewId)
    ).toEqual([
      "system",
      "custody",
      "webhooks",
      "data",
      "signup",
      "weather",
      "dependencies",
    ])
    expect(
      FINANCE_PLAN_DIAGRAM_TRACEABILITY.map(
        (entry) => entry.sourceConnectionCount
      )
    ).toEqual(sourceConnectionCounts)

    for (const entry of FINANCE_PLAN_DIAGRAM_INDEX) {
      const view = FINANCE_PLANNING_VIEWS.find(
        (candidate) => candidate.id === entry.viewId
      )

      expect(view, entry.label).toBeDefined()
      expect(entry.graphSourceStepCount, entry.label).toBe(
        entry.sourceConnectionCount
      )
      expect(entry.graphEdgeCount, entry.label).toBe(view?.buildEdges().length)
      expect(entry.evidence.length, entry.label).toBe(view?.buildNodes().length)
    }

    expect(searchFinancePlanDiagrams("")).toHaveLength(7)
    expect(searchFinancePlanDiagrams("record-to-report sequence")).toEqual([
      expect.objectContaining({ viewId: "webhooks" }),
    ])
    expect(searchFinancePlanDiagrams("missing impossible topic")).toEqual([])

    const webhookView = FINANCE_PLANNING_VIEWS.find(
      (view) => view.id === "webhooks"
    )
    const signupView = FINANCE_PLANNING_VIEWS.find(
      (view) => view.id === "signup"
    )
    expect(webhookView?.buildEdges()).toContainEqual(
      expect.objectContaining({
        source: "webhook-stripe",
        target: "webhook-link",
      })
    )
    expect(signupView?.buildEdges()).toContainEqual(
      expect.objectContaining({
        source: "signup-server",
        target: "signup-auth",
      })
    )
    expect(
      signupView?.buildEdges().find((edge) => edge.id === "auth-server")?.data
    ).toMatchObject({ sourceStepCount: 2 })
    expect(
      signupView?.buildEdges().find((edge) => edge.id === "intent-auth")?.data
    ).toMatchObject({ sourceStepCount: 0 })
  })

  it("keeps every top-level PRD section mapped to existing graph nodes", () => {
    const prdSource = readFileSync(FINANCE_PRD_PATH, "utf8")
    const prdSections = Array.from(
      prdSource.matchAll(/^## (.+)$/gmu),
      (match) => match[1]
    )
    const coverageSections = FINANCE_PRD_SECTION_COVERAGE.map(
      (entry) => entry.section
    )
    const viewNodes = new Map(
      FINANCE_PLANNING_VIEWS.map((view) => [
        view.id,
        new Set(view.buildNodes().map((node) => node.id)),
      ])
    )

    expect(FINANCE_PRD_SECTION_COVERAGE_COUNT).toBe(33)
    expect(coverageSections).toEqual(prdSections)

    for (const entry of FINANCE_PRD_SECTION_COVERAGE) {
      expect(entry.evidence.length, entry.section).toBeGreaterThan(0)
      for (const evidence of entry.evidence) {
        const nodeIds = viewNodes.get(evidence.viewId)
        expect(nodeIds, `${entry.section}: ${evidence.viewId}`).toBeDefined()
        for (const nodeId of evidence.nodeIds) {
          expect(
            nodeIds?.has(nodeId),
            `${entry.section}: ${evidence.viewId}/${nodeId}`
          ).toBe(true)
        }
      }
    }

    for (const section of [
      "Security, Privacy, And RLS",
      "Failure And Empty States",
      "Accessibility And Responsive Behavior",
      "Observability And Operations",
      "Test And Edge-Case Matrix",
      "Production Cutover Rules",
      "Definition Of Done",
    ]) {
      expect(
        FINANCE_PRD_SECTION_COVERAGE.find(
          (entry) => entry.section === section
        )?.evidence.some((evidence) => evidence.viewId === "assurance"),
        section
      ).toBe(true)
    }
  })

  it("maps every requested objective row to exact existing graph evidence", () => {
    const prdSource = readFileSync(FINANCE_PRD_PATH, "utf8")
    const objectiveSection = prdSource
      .split("## Objective Traceability")[1]
      ?.split("## Definition Of Done")[0]
    const sourceRows = Array.from(
      objectiveSection?.matchAll(/^\| (.+?)\s+\| (.+?)\s+\|$/gmu) ?? [],
      (match) => ({
        outcome: match[1].trim(),
        plannedEvidence: match[2].trim(),
      })
    ).filter(
      ({ outcome }) => outcome !== "Requested outcome" && !/^-+$/u.test(outcome)
    )
    const viewNodes = new Map(
      FINANCE_PLANNING_VIEWS.map((view) => [
        view.id,
        new Set(view.buildNodes().map((node) => node.id)),
      ])
    )

    expect(FINANCE_PLAN_OBJECTIVE_TRACEABILITY_COUNT).toBe(27)
    expect(
      FINANCE_PLAN_OBJECTIVE_TRACEABILITY.map(
        ({ outcome, plannedEvidence }) => ({ outcome, plannedEvidence })
      )
    ).toEqual(sourceRows)

    for (const entry of FINANCE_PLAN_OBJECTIVE_TRACEABILITY) {
      expect(entry.evidence.length, entry.outcome).toBeGreaterThan(0)
      for (const evidence of entry.evidence) {
        const nodeIds = viewNodes.get(evidence.viewId)
        expect(nodeIds, `${entry.outcome}: ${evidence.viewId}`).toBeDefined()
        for (const nodeId of evidence.nodeIds) {
          expect(
            nodeIds?.has(nodeId),
            `${entry.outcome}: ${evidence.viewId}/${nodeId}`
          ).toBe(true)
        }
      }
    }
  })

  it("builds a searchable objective index without dropping traceability", () => {
    const expectedReferenceCount = FINANCE_PLAN_OBJECTIVE_TRACEABILITY.reduce(
      (count, entry) =>
        count +
        entry.evidence.reduce(
          (evidenceCount, evidence) => evidenceCount + evidence.nodeIds.length,
          0
        ),
      0
    )

    expect(FINANCE_PLAN_OBJECTIVE_INDEX_COUNT).toBe(27)
    expect(FINANCE_PLAN_OBJECTIVE_INDEX_COUNT).toBe(
      FINANCE_PLAN_OBJECTIVE_TRACEABILITY_COUNT
    )
    expect(FINANCE_PLAN_OBJECTIVE_NODE_REFERENCE_COUNT).toBe(
      expectedReferenceCount
    )
    expect(FINANCE_PLAN_OBJECTIVE_INDEX.map((entry) => entry.outcome)).toEqual(
      FINANCE_PLAN_OBJECTIVE_TRACEABILITY.map((entry) => entry.outcome)
    )

    for (const entry of FINANCE_PLAN_OBJECTIVE_INDEX) {
      expect(entry.evidence.length, entry.outcome).toBeGreaterThan(0)
      expect(
        new Set(
          entry.evidence.map(
            (evidence) => `${evidence.viewId}:${evidence.nodeId}`
          )
        ).size,
        entry.outcome
      ).toBe(entry.evidence.length)
    }

    expect(searchFinancePlanObjectives("")).toHaveLength(27)
    expect(searchFinancePlanObjectives("circle profile")).toEqual([
      expect.objectContaining({
        outcome: "Circle profile button and map signup",
      }),
    ])
    expect(
      searchFinancePlanObjectives("formula neutralization").some(
        (entry) => entry.outcome === "Allocation tracking and coach/user CSV"
      )
    ).toBe(true)
    expect(searchFinancePlanObjectives("missing impossible topic")).toEqual([])

    const mermaidObjective = FINANCE_PLAN_OBJECTIVE_INDEX.find(
      (entry) => entry.outcome === "Shadcn-style Mermaid PRD"
    )
    expect(mermaidObjective?.evidence).toHaveLength(7)
    expect(
      new Set(mermaidObjective?.evidence.map((evidence) => evidence.viewId))
        .size
    ).toBe(7)
  })

  it("builds an inspectable PRD index from every validated coverage mapping", () => {
    const expectedReferenceCount = FINANCE_PRD_SECTION_COVERAGE.reduce(
      (count, entry) =>
        count +
        entry.evidence.reduce(
          (evidenceCount, evidence) => evidenceCount + evidence.nodeIds.length,
          0
        ),
      0
    )

    expect(FINANCE_PRD_COVERAGE_INDEX_COUNT).toBe(33)
    expect(FINANCE_PRD_COVERAGE_INDEX_COUNT).toBe(
      FINANCE_PRD_SECTION_COVERAGE_COUNT
    )
    expect(FINANCE_PRD_COVERAGE_NODE_REFERENCE_COUNT).toBe(
      expectedReferenceCount
    )
    expect(FINANCE_PRD_COVERAGE_INDEX.map((entry) => entry.section)).toEqual(
      FINANCE_PRD_SECTION_COVERAGE.map((entry) => entry.section)
    )

    for (const entry of FINANCE_PRD_COVERAGE_INDEX) {
      expect(entry.evidence.length, entry.section).toBeGreaterThan(0)
      expect(
        new Set(
          entry.evidence.map(
            (evidence) => `${evidence.viewId}:${evidence.nodeId}`
          )
        ).size,
        entry.section
      ).toBe(entry.evidence.length)
      expect(
        entry.evidence.every(
          (evidence) =>
            evidence.nodeTitle.length > 0 && evidence.viewLabel.length > 0
        ),
        entry.section
      ).toBe(true)
    }

    expect(searchFinancePrdCoverage("")).toHaveLength(33)
    expect(searchFinancePrdCoverage("Test And Edge-Case Matrix")).toEqual([
      expect.objectContaining({ section: "Test And Edge-Case Matrix" }),
    ])
    expect(
      searchFinancePrdCoverage("donor pii").some(
        (entry) => entry.section === "Security, Privacy, And RLS"
      )
    ).toBe(true)
    expect(searchFinancePrdCoverage("missing impossible topic")).toEqual([])
  })

  it("keeps planning views shareable and reload-stable in the URL", () => {
    const sourceParams = new URLSearchParams(
      "entry=finance-release-plan&planView=weather"
    )

    expect(FINANCE_PLANNING_VIEW_QUERY_PARAM).toBe("planView")
    expect(readFinancePlanningViewFromParams(sourceParams)).toBe("weather")
    expect(
      readFinancePlanningViewFromParams(
        new URLSearchParams("entry=finance-release-plan&planView=unknown")
      )
    ).toBe("roadmap")
    expect(
      buildFinancePlanningViewHref({
        hash: "#review",
        pathname: "/admin/platform/prototypes",
        searchParams: sourceParams,
        viewId: "custody",
      })
    ).toBe(
      "/admin/platform/prototypes?entry=finance-release-plan&planView=custody#review"
    )
    expect(
      applyFinancePlanningViewToParams(sourceParams, "roadmap").toString()
    ).toBe("entry=finance-release-plan")
    expect(sourceParams.get("planView")).toBe("weather")
  })

  it("finds exact nodes across every planning view with deterministic limits", () => {
    const searchableNodeCount = FINANCE_PLANNING_VIEWS.reduce(
      (count, view) =>
        count +
        view.buildNodes().filter((node) => node.data.kind !== "lane").length,
      0
    )
    const searchIdentities = FINANCE_PLAN_SEARCH_ENTRIES.map(
      (entry) => `${entry.viewId}:${entry.nodeId}`
    )

    expect(FINANCE_PLAN_SEARCH_ENTRY_COUNT).toBe(searchableNodeCount)
    expect(new Set(searchIdentities).size).toBe(searchIdentities.length)
    expect(searchFinancePlanNodes("")).toHaveLength(FINANCE_PLANNING_VIEW_COUNT)
    expect(
      new Set(searchFinancePlanNodes("").map((entry) => entry.viewId)).size
    ).toBe(FINANCE_PLANNING_VIEW_COUNT)
    expect(searchFinancePlanNodes("validation and review")[0]).toMatchObject({
      nodeId: "system-event-inbox",
      viewId: "system",
    })
    expect(
      searchFinancePlanNodes("review queue").some(
        (entry) => entry.viewId === "webhooks"
      )
    ).toBe(true)
    expect(
      searchFinancePlanNodes("cooling centers").some(
        (entry) => entry.viewId === "weather"
      )
    ).toBe(true)
    expect(searchFinancePlanNodes("finance", 3)).toHaveLength(3)
    expect(searchFinancePlanNodes("missing impossible topic")).toEqual([])
  })

  it("keeps exact node jumps shareable and validates node ownership", () => {
    const sourceParams = new URLSearchParams(
      "entry=finance-release-plan&planView=weather&planNode=weather-rule"
    )

    expect(FINANCE_PLANNING_NODE_QUERY_PARAM).toBe("planNode")
    expect(readFinancePlanningLocationFromParams(sourceParams)).toEqual({
      nodeId: "weather-rule",
      viewId: "weather",
    })
    expect(
      readFinancePlanningLocationFromParams(
        new URLSearchParams(
          "entry=finance-release-plan&planView=weather&planNode=webhook-inbox"
        )
      )
    ).toEqual({ nodeId: null, viewId: "weather" })
    expect(
      buildFinancePlanningLocationHref({
        hash: "#review",
        location: { nodeId: "webhook-inbox", viewId: "webhooks" },
        pathname: "/admin/platform/prototypes",
        searchParams: sourceParams,
      })
    ).toBe(
      "/admin/platform/prototypes?entry=finance-release-plan&planView=webhooks&planNode=webhook-inbox#review"
    )
    expect(
      applyFinancePlanningLocationToParams(sourceParams, {
        nodeId: "unsafe-tree-start",
        viewId: "roadmap",
      }).toString()
    ).toBe("entry=finance-release-plan&planNode=unsafe-tree-start")
    expect(
      applyFinancePlanningViewToParams(sourceParams, "data").toString()
    ).toBe("entry=finance-release-plan&planView=data")
  })

  it("keeps the PRD ownership, privacy, and safety boundaries visible", () => {
    const allViewsText = FINANCE_PLANNING_VIEWS.flatMap((view) =>
      view.buildNodes().map((node) => JSON.stringify(node.data))
    ).join("\n")

    expect(allViewsText).toContain("Bank or accounting source")
    expect(allViewsText).toContain("Validation and review")
    expect(allViewsText).toContain("Sponsored-project finance records")
    expect(allViewsText).toContain("Safe pending intent")
    expect(allViewsText).toContain("Elevate verified cooling centers")
    expect(allViewsText).toContain("No payment processing")
    expect(allViewsText).toContain("forbidden bank fields")
    expect(allViewsText).toContain("CSV formula neutralization")
    expect(allViewsText).toContain("no false zero")
    expect(allViewsText).toContain("Full pnpm check:quality")
    expect(allViewsText).toContain("Organization canary")
    expect(allViewsText).toContain("rollback evidence all pass")
  })

  it("renders the roadmap with React Flow, shared node frames, navigation, and a minimap", () => {
    const canvasSource = readFinanceSource("finance-release-plan-canvas.tsx")
    const toolbarSource = readFinanceSource("finance-plan-toolbar.tsx")
    const responseDockSource = readFinanceSource(
      "finance-plan-response-dock.tsx"
    )
    const responseActionsSource = readFinanceSource(
      "finance-plan-response-actions.tsx"
    )
    const responseContextSource = readFinanceSource(
      "finance-plan-response-context.tsx"
    )
    const responseTargetSource = readFinanceSource(
      "finance-plan-response-target-button.tsx"
    )
    const nodeSource = readFinanceSource("finance-release-plan-node.tsx")
    const panelSource = readFileSync(
      "src/features/prototype-lab/components/prototype-lab-panel.tsx",
      "utf8"
    )

    expect(canvasSource).toContain('from "@xyflow/react"')
    expect(canvasSource).toContain('import "@xyflow/react/dist/style.css"')
    expect(toolbarSource).toContain("activeView.navigation")
    expect(toolbarSource).toContain("FINANCE_PLANNING_VIEWS")
    expect(canvasSource).toContain("useFinancePlanningViewUrlState")
    expect(toolbarSource).toContain("FinancePlanFinder")
    expect(canvasSource).toContain("FinancePlanReadinessPanel")
    expect(canvasSource).toContain("flex-col overflow-hidden lg:flex-row")
    expect(toolbarSource).toContain("FinancePrdCoverageNavigator")
    expect(toolbarSource).toContain("FinancePlanCurrentFocusPill")
    expect(toolbarSource).toContain("<SelectTrigger")
    expect(toolbarSource).not.toContain("<Badge")
    expect(toolbarSource).not.toContain("max-h-[calc(100%")
    expect(canvasSource).toContain("data-finance-release-plan-node")
    expect(canvasSource).toContain("<MiniMap")
    expect(canvasSource).toContain("panOnScrollSpeed={TRACKPAD_PAN_SPEED}")
    expect(canvasSource).toContain("data-finance-release-plan-view")
    expect(canvasSource).toContain(
      'data-finance-release-plan-canvas="react-flow"'
    )
    expect(canvasSource).toContain("FinancePlanResponseDock")
    expect(canvasSource).toContain("FinancePlanResponseProvider")
    expect(responseContextSource).toContain("useFinancePlanResponses")
    expect(responseContextSource).toContain("setResponses")
    expect(responseDockSource).toContain("rounded-[1.75rem]")
    expect(responseDockSource).toContain("<Input")
    expect(responseDockSource).toContain("<ArrowUpIcon")
    expect(responseDockSource).toContain("onDrop={handleDrop}")
    expect(responseDockSource).toContain("buildFinancePlanResponseLinks")
    expect(responseDockSource).toContain("FinancePlanResponseActions")
    expect(responseActionsSource).toContain("Confirm")
    expect(responseActionsSource).toContain("Deny")
    expect(responseActionsSource).toContain("Agree")
    expect(responseActionsSource).toContain("Add note")
    expect(responseActionsSource).toContain("bg-emerald-600")
    expect(responseActionsSource).toContain("bg-amber-500")
    expect(responseDockSource).toContain("motion.div")
    expect(responseDockSource).toContain("FINANCE_PLAN_RESPONSE_ENABLED")
    expect(responseTargetSource).toContain("data-finance-plan-response-target")
    expect(responseTargetSource).toContain("In progress")
    expect(responseTargetSource).toContain("Confirmed")
    expect(responseTargetSource).toContain("Denied")
    expect(responseTargetSource).toContain("Agreed")
    expect(nodeSource).toContain("WorkspaceNodeFrameRoot")
    expect(nodeSource).toContain("WorkspaceNodeFrameSurface")
    expect(panelSource).toContain('entryId === "finance-release-plan"')

    const coverageNavigatorSource = readFinanceSource(
      "finance-prd-coverage-navigator.tsx"
    )
    expect(coverageNavigatorSource).toContain("FINANCE_PRD_COVERAGE_INDEX")
    expect(coverageNavigatorSource).toContain("<Dialog")
    expect(coverageNavigatorSource).toContain("<ScrollArea")
    expect(coverageNavigatorSource).toContain("Search PRD coverage")
    expect(coverageNavigatorSource).toContain("Objectives")
    expect(coverageNavigatorSource).toContain("Diagrams")
    expect(coverageNavigatorSource).toContain(
      "FINANCE_PLAN_DIAGRAM_INDEX_COUNT"
    )
    expect(coverageNavigatorSource).toContain(
      "FINANCE_PLAN_OBJECTIVE_INDEX_COUNT"
    )
    expect(coverageNavigatorSource).toContain(
      "data-finance-prd-coverage-trigger"
    )
    expect(coverageNavigatorSource).toContain("data-finance-prd-coverage-mode")

    const readinessNavigatorSource = readFinanceSource(
      "finance-plan-readiness-navigator.tsx"
    )
    const readinessCategorySource = readFinanceSource(
      "finance-plan-readiness-category-nav.tsx"
    )
    const readinessCompletionSource = readFinanceSource(
      "finance-plan-readiness-completion-list.tsx"
    )
    const readinessBatchSource = readFinanceSource(
      "finance-plan-readiness-batch-list.tsx"
    )
    const readinessCutoverSource = readFinanceSource(
      "finance-plan-readiness-cutover-list.tsx"
    )
    const readinessGateSource = readFinanceSource(
      "finance-plan-readiness-gate-list.tsx"
    )
    const readinessTestSource = readFinanceSource(
      "finance-plan-readiness-test-list.tsx"
    )
    const readinessSecuritySource = readFinanceSource(
      "finance-plan-readiness-security-list.tsx"
    )
    const readinessFailureSource = readFinanceSource(
      "finance-plan-readiness-failure-list.tsx"
    )
    const waveProgressSource = readFinanceSource(
      "finance-plan-wave-progress-list.tsx"
    )
    expect(readinessNavigatorSource).not.toContain("<Dialog")
    expect(readinessNavigatorSource).toContain("<aside")
    expect(readinessNavigatorSource).toContain("<ScrollArea")
    expect(readinessNavigatorSource).toContain("Current release progress")
    expect(readinessNavigatorSource).toContain("% complete")
    expect(readinessNavigatorSource).toContain("Need from you")
    expect(readinessNavigatorSource).toContain("Research before coding")
    expect(readinessCategorySource).toContain("Current waves")
    expect(readinessCategorySource).toContain("Historical batches")
    expect(readinessCategorySource).toContain("Gates")
    expect(readinessCategorySource).toContain("Tests")
    expect(readinessCategorySource).toContain("Security")
    expect(readinessCategorySource).toContain("Failures")
    expect(readinessCategorySource).toContain("Cutover")
    expect(readinessCategorySource).toContain("Done")
    expect(readinessNavigatorSource).toContain("FINANCE_PLAN_COMPLETION_COUNTS")
    expect(readinessNavigatorSource).toContain("FINANCE_PLAN_CUTOVER_COUNTS")
    expect(readinessNavigatorSource).toContain(
      "FINANCE_PLAN_TEST_MATRIX_COUNTS"
    )
    expect(readinessNavigatorSource).toContain(
      "FINANCE_PLAN_SECURITY_CONTROL_COUNTS"
    )
    expect(readinessNavigatorSource).toContain(
      "FINANCE_PLAN_FAILURE_STATE_COUNTS"
    )
    expect(readinessNavigatorSource).toContain(
      "FINANCE_PLAN_GATE_READINESS_COUNTS"
    )
    expect(readinessNavigatorSource).toContain(
      "FINANCE_PLAN_GATE_EVIDENCE_COUNTS"
    )
    expect(readinessNavigatorSource).not.toContain(
      "data-finance-readiness-trigger"
    )
    expect(readinessNavigatorSource).toContain("data-finance-readiness-panel")
    expect(readinessNavigatorSource).toContain(
      'useState<FinancePlanReadinessMode>("waves")'
    )
    expect(readinessCategorySource).toContain('from "@/components/ui/select"')
    expect(readinessCategorySource).toContain("<SelectTrigger")
    expect(readinessCategorySource).not.toContain(
      'from "@/components/ui/button"'
    )
    expect(readinessNavigatorSource).toContain("data-finance-readiness-mode")
    expect(waveProgressSource).toContain("data-finance-wave")
    expect(waveProgressSource).toContain("data-finance-wave-status")
    expect(waveProgressSource).toContain("data-finance-wave-criterion")
    expect(waveProgressSource).toContain("data-finance-wave-criterion-state")
    expect(readinessGateSource).toContain("data-finance-readiness-gate-state")
    expect(readinessGateSource).toContain(
      "data-finance-readiness-evidence-list"
    )
    expect(readinessGateSource).toContain(
      "data-finance-readiness-evidence-state"
    )
    expect(readinessGateSource).toContain("data-finance-readiness-gate-target")
    expect(readinessCutoverSource).toContain(
      "data-finance-readiness-cutover-state"
    )
    expect(readinessCutoverSource).toContain(
      "data-finance-readiness-cutover-target"
    )
    expect(readinessTestSource).toContain("data-finance-readiness-test-state")
    expect(readinessTestSource).toContain("data-finance-readiness-test-target")
    expect(readinessSecuritySource).toContain(
      "data-finance-readiness-security-state"
    )
    expect(readinessSecuritySource).toContain(
      "data-finance-readiness-security-target"
    )
    expect(readinessFailureSource).toContain(
      "data-finance-readiness-failure-state"
    )
    expect(readinessFailureSource).toContain(
      "data-finance-readiness-failure-target"
    )
    expect(readinessCompletionSource).toContain(
      "data-finance-readiness-completion-state"
    )
    expect(readinessCompletionSource).toContain(
      "data-finance-readiness-completion-target"
    )
    expect(readinessNavigatorSource).toContain(
      "FINANCE_PLAN_RESEARCH_ITEM_COUNTS"
    )
    expect(readinessNavigatorSource).toContain(
      "FINANCE_PLAN_DECISION_ITEM_COUNTS"
    )
    expect(readinessNavigatorSource).toContain(
      "data-finance-readiness-research-list"
    )
    expect(readinessNavigatorSource).toContain(
      "data-finance-readiness-research-state"
    )
    expect(readinessNavigatorSource).toContain(
      "data-finance-readiness-research-target"
    )
    expect(readinessNavigatorSource).toContain(
      "data-finance-readiness-decision-list"
    )
    expect(readinessNavigatorSource).toContain(
      "data-finance-readiness-decision-state"
    )
    expect(readinessNavigatorSource).toContain(
      "data-finance-readiness-decision-target"
    )
    expect(readinessBatchSource).toContain(
      "data-finance-readiness-batch-target"
    )
    expect(readinessBatchSource).toContain("data-finance-readiness-work-list")
    expect(readinessBatchSource).toContain("data-finance-readiness-work-state")
    expect(readinessBatchSource).toContain("FinancePlanResponseTargetButton")
    expect(readinessNavigatorSource).toContain(
      "FinancePlanResponseTargetButton"
    )
    expect(readinessNavigatorSource).toContain('item.state !== "approved"')
    expect(readinessNavigatorSource).toContain('viewId: "roadmap"')
    expect(nodeSource).toContain("Current state")
    expect(nodeSource).toContain("data-finance-release-plan-current-state")
  })

  it("removes the mistaken product UI prototype", () => {
    const source = [
      readFinanceSource("finance-release-plan-canvas.tsx"),
      readFinanceSource("finance-release-plan-node.tsx"),
      readFinanceSource("finance-release-plan-data.ts"),
    ].join("\n")

    expect(source).not.toContain("$0.00")
    expect(source).not.toContain("Stripe connected")
    expect(source).not.toContain("Sample public profile")
    expect(source).not.toContain("Preview donate")
    expect(source).not.toContain("bg-gradient")
    expect(source).not.toContain("linear-gradient")
    expect(source).not.toContain("transition-all")
  })
})
