// IDs are scoped by organization. Stable preset IDs keep first-load navigation
// and concurrent first saves pointed at the same canvases before persistence.
const starterWorkspaces = [
  { id: "15ef1a52-7afd-4a82-8dfb-9dc90aa6d401", name: "Board" },
  { id: "15ef1a52-7afd-4a82-8dfb-9dc90aa6d402", name: "Communications" },
  { id: "15ef1a52-7afd-4a82-8dfb-9dc90aa6d403", name: "Finance" },
] as const

export function createStarterWorkspaceCatalog(now = new Date().toISOString()) {
  return {
    version: 1 as const,
    defaultName: "Build",
    defaultDeleted: false,
    entries: starterWorkspaces.map(({ id, name }) => ({
      id, name,
      state: { nodes: [], connections: [], visibility: { allCardsHiddenExplicitly: true, organizationHiddenExplicitly: true } },
      createdAt: now,
      updatedAt: now,
    })),
  }
}
