import type { Edge } from "@xyflow/react"

import { type ViewPerson } from "./types"
import type {
  FlowNode,
  GraphLayout,
} from "./types"
import {
  CATEGORY_RANK,
  LEADERSHIP_TITLE_PATTERN,
  NODE_HEIGHT,
  NODE_HORIZONTAL_GAP,
  NODE_VERTICAL_GAP,
  NODE_WIDTH,
  ORG_CHART_PADDING,
  SIDE_ZONE_GAP,
  ZONE_VERTICAL_GAP,
} from "./constants"
import { isFinitePosition } from "./position-helpers"

export function initials(name?: string | null) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

function compareByName(a: ViewPerson, b: ViewPerson) {
  return a.name.localeCompare(b.name)
}

function byCategoryThenName(a: ViewPerson, b: ViewPerson) {
  const rankA = CATEGORY_RANK.get(a.category) ?? 99
  const rankB = CATEGORY_RANK.get(b.category) ?? 99
  if (rankA !== rankB) return rankA - rankB
  return a.name.localeCompare(b.name)
}

function hasLeadershipTitle(person: ViewPerson) {
  const title = person.title?.trim() ?? ""
  return LEADERSHIP_TITLE_PATTERN.test(title)
}

function resolveLeadPerson(people: ViewPerson[]) {
  const staff = people.filter((person) => person.category === "staff")
  const staffNoManager = staff.filter(
    (person) => !person.reportsToId || person.reportsToId === person.id,
  )
  return (
    staffNoManager.find(hasLeadershipTitle) ??
    staff.find(hasLeadershipTitle) ??
    staffNoManager[0] ??
    staff[0] ??
    people[0]
  )
}

function getValidManagerId(
  person: ViewPerson,
  peopleById: Map<string, ViewPerson>,
) {
  const parentId = person.reportsToId?.trim()
  if (!parentId || parentId === person.id) return null
  if (!peopleById.has(parentId)) return null
  return parentId
}

function chunkPeople(people: ViewPerson[], size: number) {
  if (people.length <= size) return [people]
  const chunks: ViewPerson[][] = []
  for (let index = 0; index < people.length; index += size) {
    chunks.push(people.slice(index, index + size))
  }
  return chunks
}

function getMaxRowWidth(groups: ViewPerson[][]) {
  if (groups.length === 0) return 0
  const maxCols = Math.max(...groups.map((group) => group.length))
  if (maxCols === 0) return 0
  return maxCols * NODE_WIDTH + Math.max(0, maxCols - 1) * NODE_HORIZONTAL_GAP
}

function toFlowNode(person: ViewPerson, x: number, y: number): FlowNode {
  return {
    id: person.id,
    type: "person",
    position: { x, y },
    data: {
      name: person.name,
      title: person.title ?? "",
      image: person.displayImage ?? person.image ?? null,
      category: person.category,
    },
  }
}

export function buildGraphLayout(people: ViewPerson[]): GraphLayout {
  if (people.length === 0) {
    return { defaultNodes: [], nodes: [], edges: [] }
  }

  const peopleById = new Map(people.map((person) => [person.id, person]))
  const lead = resolveLeadPerson(people)

  const managerByPersonId = new Map<string, string>()
  for (const person of people) {
    if (person.id === lead.id) continue
    const explicitManager = getValidManagerId(person, peopleById)
    if (explicitManager) {
      managerByPersonId.set(person.id, explicitManager)
      continue
    }
    if (person.category === "staff") {
      managerByPersonId.set(person.id, lead.id)
    }
  }

  const boardPeople = people
    .filter(
      (person) =>
        person.category === "governing_board" ||
        person.category === "advisory_board",
    )
    .sort(byCategoryThenName)
  const volunteerPeople = people
    .filter((person) => person.category === "volunteers")
    .sort(compareByName)
  const supporterPeople = people
    .filter((person) => person.category === "supporters")
    .sort(compareByName)
  let corePeople = people
    .filter(
      (person) =>
        person.category !== "governing_board" &&
        person.category !== "advisory_board" &&
        person.category !== "volunteers" &&
        person.category !== "supporters",
    )
    .sort(byCategoryThenName)

  if (corePeople.length === 0 && people.length > 0) {
    corePeople = [lead]
  }

  const coreLead =
    corePeople.find((person) => person.id === lead.id) ??
    corePeople.find((person) => person.category === "staff") ??
    corePeople[0] ??
    null

  const rowByCoreId = new Map<string, number>()
  if (coreLead) {
    const staffDepthByPersonId = new Map<string, number>([[coreLead.id, 0]])
    const queue: string[] = [coreLead.id]

    while (queue.length > 0) {
      const parentId = queue.shift()
      if (!parentId) continue
      const parentDepth = staffDepthByPersonId.get(parentId) ?? 0

      for (const person of corePeople) {
        if (person.category !== "staff") continue
        if (managerByPersonId.get(person.id) !== parentId) continue
        if (staffDepthByPersonId.has(person.id)) continue
        staffDepthByPersonId.set(person.id, parentDepth + 1)
        queue.push(person.id)
      }
    }

    let maxStaffDepth = 0
    for (const person of corePeople) {
      if (person.category !== "staff") continue
      const depth = staffDepthByPersonId.get(person.id) ?? 1
      rowByCoreId.set(person.id, depth)
      maxStaffDepth = Math.max(maxStaffDepth, depth)
    }

    for (const person of corePeople) {
      if (rowByCoreId.has(person.id)) continue
      rowByCoreId.set(person.id, Math.max(1, maxStaffDepth))
    }
  }

  const coreRows = new Map<number, ViewPerson[]>()
  for (const person of corePeople) {
    const row = rowByCoreId.get(person.id) ?? 0
    const existing = coreRows.get(row)
    if (existing) existing.push(person)
    else coreRows.set(row, [person])
  }

  const orderedCoreRows = Array.from(coreRows.keys()).sort((a, b) => a - b)
  const coreVisualGroups: ViewPerson[][] = []
  for (const row of orderedCoreRows) {
    const rowPeople = [...(coreRows.get(row) ?? [])]
    rowPeople.sort((left, right) => {
      const leftManager = managerByPersonId.get(left.id)
      const rightManager = managerByPersonId.get(right.id)
      if (leftManager !== rightManager) {
        return (leftManager ?? "").localeCompare(rightManager ?? "")
      }
      return byCategoryThenName(left, right)
    })

    const wrapSize = rowPeople.every((person) => person.category === "staff")
      ? 4
      : 3
    coreVisualGroups.push(...chunkPeople(rowPeople, wrapSize))
  }

  const volunteersPerRow =
    volunteerPeople.length > 12 ? 3 : volunteerPeople.length > 4 ? 2 : 1
  const supportersPerRow =
    supporterPeople.length > 15 ? 5 : supporterPeople.length > 6 ? 4 : 3
  const boardPerRow = boardPeople.length > 8 ? 5 : 4

  const volunteerGroups = chunkPeople(volunteerPeople, volunteersPerRow)
  const supporterGroups = chunkPeople(supporterPeople, supportersPerRow)
  const boardGroups = chunkPeople(boardPeople, boardPerRow)

  const coreWidth = getMaxRowWidth(coreVisualGroups)
  const volunteerWidth = getMaxRowWidth(volunteerGroups)
  const boardHeight = boardGroups.length > 0
    ? boardGroups.length * NODE_HEIGHT +
      Math.max(0, boardGroups.length - 1) * NODE_VERTICAL_GAP
    : 0

  const coreStartX =
    ORG_CHART_PADDING + (volunteerWidth > 0 ? volunteerWidth + SIDE_ZONE_GAP : 0)
  const coreCenterX = coreStartX + (coreWidth > 0 ? coreWidth / 2 : NODE_WIDTH / 2)
  const coreStartY =
    ORG_CHART_PADDING + (boardHeight > 0 ? boardHeight + ZONE_VERTICAL_GAP : 0)

  const nodes: FlowNode[] = []

  let visualRowIndex = 0
  for (const group of coreVisualGroups) {
    const rowWidth =
      group.length * NODE_WIDTH + Math.max(0, group.length - 1) * NODE_HORIZONTAL_GAP
    const startX = coreStartX + Math.max(0, Math.round((coreWidth - rowWidth) / 2))
    const y = coreStartY + visualRowIndex * (NODE_HEIGHT + NODE_VERTICAL_GAP)
    visualRowIndex += 1

    group.forEach((person, index) => {
      nodes.push(toFlowNode(person, startX + index * (NODE_WIDTH + NODE_HORIZONTAL_GAP), y))
    })
  }

  boardGroups.forEach((group, rowIndex) => {
    const rowWidth =
      group.length * NODE_WIDTH + Math.max(0, group.length - 1) * NODE_HORIZONTAL_GAP
    const startX = coreCenterX - rowWidth / 2
    const y = ORG_CHART_PADDING + rowIndex * (NODE_HEIGHT + NODE_VERTICAL_GAP)

    group.forEach((person, index) => {
      nodes.push(toFlowNode(person, startX + index * (NODE_WIDTH + NODE_HORIZONTAL_GAP), y))
    })
  })

  volunteerGroups.forEach((group, rowIndex) => {
    const rowWidth =
      group.length * NODE_WIDTH + Math.max(0, group.length - 1) * NODE_HORIZONTAL_GAP
    const leftZoneStart = ORG_CHART_PADDING
    const startX = leftZoneStart + Math.max(0, Math.round((volunteerWidth - rowWidth) / 2))
    const y = coreStartY + rowIndex * (NODE_HEIGHT + NODE_VERTICAL_GAP)

    group.forEach((person, index) => {
      nodes.push(toFlowNode(person, startX + index * (NODE_WIDTH + NODE_HORIZONTAL_GAP), y))
    })
  })

  const coreBottomY =
    coreStartY +
    Math.max(0, coreVisualGroups.length - 1) * (NODE_HEIGHT + NODE_VERTICAL_GAP) +
    (coreVisualGroups.length > 0 ? NODE_HEIGHT : 0)
  const volunteerBottomY =
    coreStartY +
    Math.max(0, volunteerGroups.length - 1) * (NODE_HEIGHT + NODE_VERTICAL_GAP) +
    (volunteerGroups.length > 0 ? NODE_HEIGHT : 0)
  const supportersStartY = Math.max(coreBottomY, volunteerBottomY) + ZONE_VERTICAL_GAP

  supporterGroups.forEach((group, rowIndex) => {
    const rowWidth =
      group.length * NODE_WIDTH + Math.max(0, group.length - 1) * NODE_HORIZONTAL_GAP
    const startX = coreCenterX - rowWidth / 2
    const y = supportersStartY + rowIndex * (NODE_HEIGHT + NODE_VERTICAL_GAP)

    group.forEach((person, index) => {
      nodes.push(toFlowNode(person, startX + index * (NODE_WIDTH + NODE_HORIZONTAL_GAP), y))
    })
  })

  const defaultNodes = nodes
  const withPersistedPositions = defaultNodes.map((node) => {
    const person = peopleById.get(node.id)
    if (!person || !isFinitePosition(person.pos)) return node
    return {
      ...node,
      position: { x: person.pos.x, y: person.pos.y },
    }
  })

  const nodeIds = new Set(defaultNodes.map((node) => node.id))
  const edges: Edge[] = []
  for (const [personId, managerId] of managerByPersonId.entries()) {
    if (!nodeIds.has(managerId) || !nodeIds.has(personId)) continue
    edges.push({
      id: `${managerId}-${personId}`,
      source: managerId,
      target: personId,
      type: "smoothstep",
      animated: false,
    })
  }

  return {
    defaultNodes,
    nodes: withPersistedPositions,
    edges,
  }
}
export {
  getPositionExtent,
  snapshotFromNodes,
  snapshotsEqual,
} from "./position-helpers"
