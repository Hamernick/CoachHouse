import { describe, expect, it } from "vitest"
import EarthIcon from "lucide-react/dist/esm/icons/earth"

import { RESOURCE_NAV, buildMainNav } from "@/components/app-sidebar/nav-data"

describe("app sidebar nav data", () => {
  it("groups internal platform navigation only for true platform admins", () => {
    const adminNav = buildMainNav({
      isAdmin: true,
      showOrgAdmin: true,
      canAccessOrgAdmin: true,
    })

    expect(adminNav.map((item) => item.title)).toContain("Admin Dashboard")
    expect(
      adminNav
        .find((item) => item.title === "Admin Dashboard")
        ?.children?.map((item) => item.title)
    ).toContain("Platform")
    expect(adminNav.map((item) => item.title)).not.toContain("User Journeys")

    expect(
      buildMainNav({
        isAdmin: false,
        showOrgAdmin: true,
        canAccessOrgAdmin: true,
      }).map((item) => item.title)
    ).not.toContain("Admin Dashboard")
    expect(
      buildMainNav({
        isAdmin: false,
        showOrgAdmin: true,
        canAccessOrgAdmin: true,
      }).map((item) => item.title)
    ).not.toContain("User Journeys")
  })

  it("shows Platform Lab only when explicitly enabled for platform admins", () => {
    const enabledNav = buildMainNav({
      isAdmin: true,
      showOrgAdmin: true,
      canAccessOrgAdmin: true,
      showPlatformLab: true,
    })
    const disabledNav = buildMainNav({
      isAdmin: true,
      showOrgAdmin: true,
      canAccessOrgAdmin: true,
      showPlatformLab: false,
    })

    expect(
      enabledNav
        .find((item) => item.title === "Admin Dashboard")
        ?.children?.map((item) => item.title)
    ).toContain("Platform Lab")
    expect(
      disabledNav
        .find((item) => item.title === "Admin Dashboard")
        ?.children?.map((item) => item.title)
    ).not.toContain("Platform Lab")
  })

  it("hides project and task nav from regular member workspace users", () => {
    const nav = buildMainNav({
      isAdmin: false,
      showOrgAdmin: false,
      canAccessOrgAdmin: false,
      showMemberWorkspace: true,
      hasMemberWorkspaceAccess: true,
    })

    expect(nav.map((item) => item.title)).toEqual(["Workspace", "Find"])
    expect(nav.find((item) => item.title === "Find")?.href).toBe("/")
    expect(nav.find((item) => item.title === "Find")?.icon).toBe(EarthIcon)
    expect(nav.find((item) => item.title === "Organizations")).toBeUndefined()
    expect(nav.find((item) => item.title === "Projects")).toBeUndefined()
    expect(nav.find((item) => item.title === "Tasks")).toBeUndefined()
    expect(nav.find((item) => item.title === "Email")).toBeUndefined()
    expect(nav.find((item) => item.title === "People")).toBeUndefined()
    expect(nav.find((item) => item.title === "Documents")).toBeUndefined()
  })

  it("keeps org admin out of the main sidebar nav even when available", () => {
    const nav = buildMainNav({
      isAdmin: false,
      showOrgAdmin: true,
      canAccessOrgAdmin: true,
      showMemberWorkspace: true,
      hasMemberWorkspaceAccess: true,
    })

    expect(nav.find((item) => item.title === "Admin Dashboard")).toBeUndefined()
  })

  it("includes member workspace routes alongside platform routes for platform admins", () => {
    const nav = buildMainNav({
      isAdmin: true,
      showOrgAdmin: true,
      canAccessOrgAdmin: true,
      showMemberWorkspace: true,
      hasMemberWorkspaceAccess: true,
      showPlatformLab: true,
    })

    expect(nav.map((item) => item.title)).toEqual([
      "Workspace",
      "Find",
      "Admin Dashboard",
    ])
    const adminItems = nav.find((item) => item.title === "Admin Dashboard")?.children
    expect(adminItems?.map((item) => item.title)).toEqual([
      "Organizations",
      "Projects",
      "Tasks",
      "Email",
      "Platform",
      "Platform Lab",
      "Prototypes",
    ])
    expect(
      adminItems?.find((item) => item.title === "Organizations")?.href
    ).toBe("/organizations")
    expect(
      adminItems?.find((item) => item.title === "Prototypes")?.tree
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "user-journeys",
          label: "User Journeys",
        }),
      ])
    )
  })

  it("shows coaches a linked Admin dashboard with work navigation", () => {
    const nav = buildMainNav({
      isAdmin: false,
      platformAccessLevel: "coach",
      showOrgAdmin: false,
      canAccessOrgAdmin: false,
      showMemberWorkspace: true,
      hasMemberWorkspaceAccess: true,
    })

    expect(nav.map((item) => item.title)).toEqual(["Workspace", "Find", "Admin Dashboard"])
    const admin = nav.find((item) => item.title === "Admin Dashboard")
    expect(admin?.href).toBe("/admin/dashboard")
    expect(admin?.children?.map((item) => item.title)).toEqual(["Organizations", "Projects", "Tasks"])

  })

  it("shows Find only for free self-only member accounts", () => {
    const nav = buildMainNav({
      isAdmin: false,
      showOrgAdmin: false,
      canAccessOrgAdmin: false,
      showMemberWorkspace: false,
      hasMemberWorkspaceAccess: false,
    })

    expect(nav.map((item) => item.title)).toEqual(["Find"])
    expect(nav.find((item) => item.title === "Workspace")).toBeUndefined()
    expect(nav.find((item) => item.title === "Find")?.href).toBe("/")
    expect(nav.find((item) => item.title === "Organizations")).toBeUndefined()
    expect(nav.find((item) => item.title === "Projects")).toBeUndefined()
    expect(nav.find((item) => item.title === "Tasks")).toBeUndefined()
    expect(nav.find((item) => item.title === "Email")).toBeUndefined()
    expect(nav.find((item) => item.title === "People")).toBeUndefined()
    expect(nav.find((item) => item.title === "Documents")).toBeUndefined()
  })

  it("omits project and task nav instead of rendering upgrade badges without access", () => {
    const nav = buildMainNav({
      isAdmin: false,
      showOrgAdmin: false,
      canAccessOrgAdmin: false,
      showMemberWorkspace: true,
      hasMemberWorkspaceAccess: false,
    })

    expect(nav.find((item) => item.title === "Find")?.href).toBe("/")
    expect(nav.find((item) => item.title === "Find")?.icon).toBe(EarthIcon)
    expect(nav.find((item) => item.title === "Find")?.locked).not.toBe(true)
    expect(nav.find((item) => item.title === "Organizations")).toBeUndefined()
    expect(nav.find((item) => item.title === "Projects")).toBeUndefined()
    expect(nav.find((item) => item.title === "Tasks")).toBeUndefined()
    expect(nav.find((item) => item.title === "Email")).toBeUndefined()
    expect(nav.map((item) => item.badge)).not.toContain("Upgrade")
  })

  it("omits locked admin upgrade rows when org admin is unavailable", () => {
    const nav = buildMainNav({
      isAdmin: false,
      showOrgAdmin: true,
      canAccessOrgAdmin: false,
      showMemberWorkspace: false,
      hasMemberWorkspaceAccess: false,
    })

    expect(nav.map((item) => item.title)).toEqual(["Find"])
    expect(nav.find((item) => item.title === "Admin Dashboard")).toBeUndefined()
    expect(nav.map((item) => item.badge)).not.toContain("Upgrade")
  })

  it("keeps Documentation and Community in the sidebar resource nav", () => {
    expect(RESOURCE_NAV.map((item) => item.name)).toEqual([
      "Documentation",
      "Community",
    ])
    expect(
      RESOURCE_NAV.find((item) => item.name === "Find organizations")
    ).toBeUndefined()
    expect(RESOURCE_NAV.find((item) => item.url === "/find")).toBeUndefined()
  })
})
