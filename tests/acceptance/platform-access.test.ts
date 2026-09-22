import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

import {
  hasPlatformCapability,
  isCoachRestrictedPath,
  isPlatformAccessLevel,
} from "@/features/platform-access"

describe("platform access", () => {
  const migration = readFileSync(
    "supabase/migrations/20260721121500_add_platform_staff_access.sql",
    "utf8"
  )
  const proxy = readFileSync("src/proxy.ts", "utf8")
  it("gives developers every internal capability", () => {
    expect(hasPlatformCapability("developer", "workspace")).toBe(true)
    expect(hasPlatformCapability("developer", "find")).toBe(true)
    expect(hasPlatformCapability("developer", "organizations")).toBe(true)
    expect(hasPlatformCapability("developer", "tasks")).toBe(true)
    expect(hasPlatformCapability("developer", "email")).toBe(true)
    expect(hasPlatformCapability("developer", "platform")).toBe(true)
    expect(hasPlatformCapability("developer", "platform-lab")).toBe(true)
    expect(hasPlatformCapability("developer", "prototypes")).toBe(true)
  })

  it("grants coaches dashboard work access but not platform administration", () => {
    expect(hasPlatformCapability("coach", "workspace")).toBe(true)
    expect(hasPlatformCapability("coach", "find")).toBe(true)
    expect(hasPlatformCapability("coach", "organizations")).toBe(true)
    expect(hasPlatformCapability("coach", "tasks")).toBe(true)
    expect(hasPlatformCapability("coach", "email")).toBe(false)
    expect(hasPlatformCapability("coach", "platform")).toBe(false)
    expect(hasPlatformCapability("coach", "platform-lab")).toBe(false)
    expect(hasPlatformCapability("coach", "prototypes")).toBe(false)
  })

  it("keeps regular users outside internal capabilities", () => {
    expect(hasPlatformCapability(null, "organizations")).toBe(false)
    expect(isPlatformAccessLevel("member")).toBe(false)
  })

  it("redirects coaches away from every other authenticated tool", () => {
    expect(isCoachRestrictedPath("/workspace")).toBe(false)
    expect(isCoachRestrictedPath("/find/example")).toBe(false)
    expect(isCoachRestrictedPath("/organizations/project-id")).toBe(false)
    expect(isCoachRestrictedPath("/tasks")).toBe(false)
    expect(isCoachRestrictedPath("/projects/example")).toBe(false)
    expect(isCoachRestrictedPath("/admin/dashboard")).toBe(false)
    expect(isCoachRestrictedPath("/admin/dashboard-other")).toBe(true)
    expect(isCoachRestrictedPath("/email")).toBe(true)
    expect(isCoachRestrictedPath("/admin/platform")).toBe(true)
    expect(isCoachRestrictedPath("/internal/platform-lab")).toBe(true)
    expect(isCoachRestrictedPath("/organization/documents")).toBe(true)
  })

  it("keeps broad RLS access developer-only and seeds verified staff", () => {
    expect(migration).toContain("access_level in ('developer', 'coach')")
    expect(migration).toContain("select access_level = 'developer'")
    expect(migration).toContain(
      "alter table public.platform_staff_members force row level security"
    )
    expect(migration).toContain(
      "grant select, insert, update, delete\n  on table public.platform_staff_members\n  to authenticated"
    )
    expect(migration).toContain("paula@coachhousesolutions.org")
    expect(migration).toContain("fs@coachhousesolutions.org")
    expect(migration).toContain("joel@amorejustchicago.org")
  })

  it("enforces coach route restrictions before protected pages render", () => {
    expect(proxy).toContain("isCoachRestrictedPath(pathname)")
    expect(proxy).toContain('.from("platform_staff_members")')
    expect(proxy).toContain('platformStaff?.access_level === "coach"')
    expect(proxy).toContain('new URL("/organizations", request.url)')
  })
})
