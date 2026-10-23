// Audited 2026-10-13 against the published Feeding Illinois records. Each pair
// has the same street/locality and contact; preserve both service schedules.
// Identity is deliberately scoped to these records, not fuzzy name matching.
const ALIASES: Record<string, { title: string; identity: string }> = {
  "resource_map:887e6a14-2367-4c97-bda6-10509e5b3f93": { title: "Iglesia Evangelical De Cristo", identity: "iglesia-evangelica-de-cristo-portage" },
  "resource_map:8903177f-5f18-48a7-9f5f-6e58b392e190": { title: "Iglesia Evangelica De Cristo", identity: "iglesia-evangelica-de-cristo-portage" },
  "resource_map:758a9108-48e4-4031-81d8-f695f7700097": { title: "Operation Blessing Evening Star", identity: "operation-blessing-evening-star" },
  "resource_map:7c60815a-b24f-41d7-8d4d-410ee500cef6": { title: "Evening Star MBC", identity: "operation-blessing-evening-star" },
}

export function auditedResourcePlaceIdentity(item: { id: string; title: string }) {
  const alias = ALIASES[item.id]
  return alias?.title === item.title ? alias.identity : null
}
