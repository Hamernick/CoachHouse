import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LaunchProfileFields } from "@/features/organization-launch/components/launch-profile-fields"
import { OrganizationLaunchMap } from "@/features/organization-launch/components/organization-launch-map"
import { InstancedMesh, LineSegments, Matrix4, Mesh, PerspectiveCamera, Vector3 } from "three"
import { mountLaunchGlobe } from "@/features/organization-launch/components/organization-launch-globe-runtime"
import { createLaunchGlobeScene } from "@/features/organization-launch/components/organization-launch-globe-scene"
import { resolveLaunchGlobeLocation } from "@/features/organization-launch/lib/globe-location"
import { requestLaunchViewerLocation } from "@/features/organization-launch/lib/viewer-location"
import { scrollLaunchIntoView } from "@/features/organization-launch/lib/scroll-launch-into-view"
import { OrganizationLaunchPanel, resolveOrganizationLaunch, type OrganizationLaunchInput } from "@/features/organization-launch"

import { resolveWorkspaceOrganizationDrawerRequest } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer-tabs"

const globeRenderer = vi.hoisted(() => ({ render: vi.fn(), dispose: vi.fn() }))
vi.mock("three", async (importOriginal) => ({
  ...await importOriginal<typeof import("three")>(),
  WebGLRenderer: class {
    domElement = Object.assign(new EventTarget(), { style: {}, setAttribute: vi.fn(), remove: vi.fn() })
    setClearColor = vi.fn()
    setPixelRatio = vi.fn()
    setSize = vi.fn()
    render = globeRenderer.render
    dispose = globeRenderer.dispose
  },
}))

vi.mock("@/components/paywall/paywall-overlay", () => ({ PaywallOverlay: () => null }))

const saveProfile = vi.hoisted(() => vi.fn())
vi.mock("@/actions/organization", () => ({ updateOrganizationProfileAction: saveProfile }))

const draft: OrganizationLaunchInput = { programCount: 0, canEdit: true }

vi.mock("next/navigation", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/navigation")>(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe("organization launch", () => {
  it("keeps the free launch card visible without mounting editable forms", () => {
    const markup = renderToStaticMarkup(React.createElement(OrganizationLaunchPanel, {
      input: { ...draft, locationType: "online" }, hasAccess: false,
    }))
    expect(markup).toContain("Build your nfp")
    expect(markup).toContain('inert=""')
    expect(markup).toContain("Upgrade to edit")
    expect(markup).not.toContain('data-slot="accordion-trigger"')
    expect(markup).not.toContain("<input")
    expect(markup).not.toContain("<textarea")
    expect(markup).not.toContain("Continue setup")
    expect(markup).not.toContain("Use my location")
    expect(markup).not.toContain("Add location")
  })

  it("shows saved location directly without a switch and offers inline setup only when missing", () => {
    const known = renderToStaticMarkup(React.createElement(OrganizationLaunchMap, { location: { latitude: 41.88, longitude: -87.63 }, locationLabel: "Chicago, IL", onAddLocation: vi.fn() }))
    expect(known).toContain("Chicago, IL")
    expect(known).not.toContain('role="switch"')
    expect(known).not.toContain("Add location")
    const missing = renderToStaticMarkup(React.createElement(OrganizationLaunchMap, { onAddLocation: vi.fn() }))
    expect(missing).toContain("Add location")
    expect(missing).not.toContain('role="switch"')
    expect(renderToStaticMarkup(React.createElement(OrganizationLaunchMap))).not.toContain("Add location")
  })

  it("centers the actual geographic marker in the close camera crop", () => {
    const model = createLaunchGlobeScene()
    const marker = model.globe.children.at(-1) as Mesh
    const camera = new PerspectiveCamera(26, 16 / 9, 0.1, 20)
    camera.position.z = 2.7
    camera.updateMatrixWorld()
    for (const location of [{ latitude: 41.88, longitude: -87.63 }, { latitude: -33.87, longitude: 151.21 }, { latitude: 0, longitude: 0 }, { latitude: 90, longitude: 180 }]) {
      model.setLocation(location)
      const projected = marker.getWorldPosition(new Vector3()).project(camera)
      expect(projected.x).toBeCloseTo(0)
      expect(projected.y).toBeCloseTo(0)
      expect(projected.z).toBeGreaterThan(-1)
      expect(projected.z).toBeLessThan(1)
    }
    model.dispose()
  })

  it("uses only valid saved physical locations, including zero coordinates", () => {
    expect(resolveLaunchGlobeLocation({ latitude: 0, longitude: 0 })).toEqual({ latitude: 0, longitude: 0 })
    expect(resolveLaunchGlobeLocation({ latitude: 41.88, longitude: -87.63 })).toEqual({ latitude: 41.88, longitude: -87.63 })
    for (const input of [
      {}, { latitude: 41.88 }, { latitude: NaN, longitude: 0 },
      { latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 },
      { latitude: 0, longitude: Infinity },
      { latitude: 41.88, longitude: -87.63, locationType: "online" as const },
    ]) expect(resolveLaunchGlobeLocation(input)).toBeNull()
  })

  it("shows the location marker at geographic coordinates and can hide it", () => {
    const model = createLaunchGlobeScene()
    const marker = model.globe.children.at(-1) as Mesh
    expect(marker.visible).toBe(false)
    model.setLocation({ latitude: 0, longitude: 90 })
    expect(marker.visible).toBe(true)
    expect(marker.position.x).toBeCloseTo(1.015)
    expect(marker.position.y).toBeCloseTo(0)
    expect(marker.position.z).toBeCloseTo(0)
    model.setLocation({ latitude: 90, longitude: 0 })
    expect(marker.position.y).toBeCloseTo(1.015)
    model.setLocation(null)
    expect(marker.visible).toBe(false)
    model.dispose()
  })

  it("keeps globe land dots on the surface and releases GPU resources", () => {
    const model = createLaunchGlobeScene()
    const dots = model.globe.children.find((child) => child instanceof InstancedMesh) as InstancedMesh
    const matrix = new Matrix4()
    const point = new Vector3()
    expect(dots.count).toBeGreaterThan(1000)
    for (let index = 0; index < dots.count; index++) {
      dots.getMatrixAt(index, matrix)
      point.setFromMatrixPosition(matrix)
      expect(point.length()).toBeCloseTo(1.002, 5)
    }
    const disposed = vi.fn()
    let resources = 1
    dots.addEventListener("dispose", disposed)
    model.globe.traverse((object) => {
      if (!(object instanceof Mesh || object instanceof LineSegments)) return
      object.geometry.addEventListener("dispose", disposed)
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => material.addEventListener("dispose", disposed))
      resources += 1 + materials.length
    })
    model.dispose()
    expect(disposed).toHaveBeenCalledTimes(resources)
  })

  it("scrolls only the inner drawer viewport when returning to the launch card", () => {
    const scrollTo = vi.fn()
    const viewport = { scrollTop: 35, getBoundingClientRect: () => ({ top: 100 }), scrollTo }
    const closest = vi.fn<() => typeof viewport | null>(() => viewport)
    const card = { closest, getBoundingClientRect: () => ({ top: 220 }) } as unknown as HTMLElement
    scrollLaunchIntoView(card)
    expect(closest).toHaveBeenCalledWith('[data-workspace-accelerator-drawer-scroll="true"]')
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 155, behavior: "instant" })
    closest.mockReturnValueOnce(null)
    scrollLaunchIntoView(card)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it("starts with the first missing saved field, not optional enrichment", () => {
    const empty = resolveOrganizationLaunch(draft)
    expect(empty.completedCount).toBe(0)
    expect(empty.next.id).toBe("identity")
    const ready = resolveOrganizationLaunch({ ...draft, name: "Test organization", publicSlug: "test-organization", description: "Community meals" })
    expect(ready.completedCount).toBe(2)
    expect(ready.totalCount).toBe(3)
    expect(ready.next.id).toBe("publish")
    expect(ready.steps.filter((step) => step.optional).map((step) => step.id)).toEqual(["location", "program"])
    expect(ready.publicHref).toBeNull()
  })

  it("opens each setup action in the organization drawer with the intended focus", () => {
    const steps = resolveOrganizationLaunch(draft).steps
    for (const step of steps.filter((step) => step.id !== "publish")) {
      const request = resolveWorkspaceOrganizationDrawerRequest(step.href)
      expect(request?.tab).toBe("organization")
      expect(request?.organizationEditMode).toBe(true)
      const url = new URL(step.href, "https://workspace.local")
      expect(url.searchParams.get("from")).toBe("organization-launch")
      expect(url.searchParams.get("returnTo")).toBe("/workspace?drawer=accelerator&focus=organization-launch")
      expect(request?.organizationTab).toBe(step.id === "program" ? "programs" : "company")
    }
    expect(steps.find((step) => step.id === "publish")!.href).toBe("/workspace/profile-preview")
  })

  it("does not count empty rich text as a description or claim a public link for a draft", () => {
    const result = resolveOrganizationLaunch({ ...draft, name: "Test", publicSlug: "test", description: "<p><br></p>" })
    expect(result.next.id).toBe("story")
    expect(result.publicHref).toBeNull()
  })

  it("uses saved publication independently of curriculum and location", () => {
    const result = resolveOrganizationLaunch({ ...draft, name: "Test", publicSlug: "test", mission: "Provide meals", isPublic: true })
    expect(result.publicHref).toBe("/resources?organization=test")
    expect(result.completedCount).toBe(3)
    expect(result.steps.find((step) => step.id === "location")?.complete).toBe(false)
    expect(result.steps.find((step) => step.id === "program")?.complete).toBe(false)
  })

  it("separates an online destination from a physical address", () => {
    const result = resolveOrganizationLaunch({ ...draft, locationType: "online", address: "123 Main St" })
    expect(result.steps.find((step) => step.id === "location")?.complete).toBe(false)
    expect(result.locationLabel).toBe("Online organization")
    expect(resolveOrganizationLaunch({ ...draft, locationType: "online", locationUrl: "https://example.org/help" }).steps.find((step) => step.id === "location")?.complete).toBe(true)
  })

  it("does not expose editor actions to a read-only member", () => {
    const markup = renderToStaticMarkup(React.createElement(OrganizationLaunchPanel, { hasAccess: true, input: { ...draft, canEdit: false } }))
    expect(markup).toContain("An organization editor can update and publish")
    expect(markup).not.toContain("view=editor")
    expect(markup).not.toContain("Continue setup")
    expect(markup).toContain("View profile draft")
  })

  it("offers inline review without automatically publishing", () => {
    const markup = renderToStaticMarkup(React.createElement(OrganizationLaunchPanel, { hasAccess: true, input: { ...draft, name: "Test", publicSlug: "test", description: "Meals" } }))
    expect(markup).toContain("Review profile")
    expect(markup).toContain('data-launch-step="publish"')
    expect(markup).not.toContain('href="/workspace/profile-preview"')
    expect(markup).toContain("Profile visibility: Private")
    expect(markup).not.toContain("View public profile")
  })
})


it("shows saved public/private visibility independently of setup completion", () => {
  const privateMarkup = renderToStaticMarkup(React.createElement(OrganizationLaunchPanel, { hasAccess: true, input: { ...draft, name: "Test", publicSlug: "test", description: "Meals" } }))
  expect(privateMarkup).toContain('aria-label="Profile visibility: Private"')
  expect(privateMarkup).not.toContain("Org progress")
  expect(privateMarkup).toContain("Build your nfp")
  expect(privateMarkup).not.toContain("501c3")
  const publicMarkup = renderToStaticMarkup(React.createElement(OrganizationLaunchPanel, { hasAccess: true, input: { ...draft, isPublic: true, publicSlug: "test" } }))
  expect(publicMarkup).toContain('aria-label="Profile visibility: Public"')
  expect(publicMarkup).toContain("View public profile")
  expect(publicMarkup).toContain("aspect-video")
})


describe("inline launch profile editing", () => {
  beforeEach(() => {
    saveProfile.mockReset()
    saveProfile.mockResolvedValue({ ok: true, location: { latitude: 41, longitude: -87 } })
  })
  const save = (step: "identity" | "story" | "location", values: Record<string, string>) => LaunchProfileFields({ step, input: draft }).props.onSave(values)
  const address = { locationType: "in_person", locationUrl: "", addressStreet: "123 Main St", addressCity: "Chicago", addressState: "IL", addressPostal: "60601", addressCountry: "US" }
  it("renders expandable forms instead of navigation to another drawer", () => {
    const markup = renderToStaticMarkup(React.createElement(OrganizationLaunchPanel, { hasAccess: true, input: draft }))
    expect(markup).toContain('data-slot="accordion-trigger"')
    expect(markup).toContain('name="name"')
    expect(markup).toContain('name="addressCity"')
    expect(markup).not.toContain('view=editor')
  })
  it("saves only name and slug without changing visibility or unrelated fields", async () => {
    await save("identity", { name: " Community House ", publicSlug: "community-house" })
    expect(saveProfile).toHaveBeenCalledExactlyOnceWith({ name: "Community House", publicSlug: "community-house" })
  })
  it("keeps invalid identity values from reaching persistence", async () => {
    expect(await save("identity", { name: "  ", publicSlug: "community" })).toHaveProperty("error")
    expect(await save("identity", { name: "Community", publicSlug: "https://example.com" })).toHaveProperty("error")
    expect(saveProfile).not.toHaveBeenCalled()
  })
  it("saves description without overwriting mission or other narrative fields", async () => {
    await save("story", { description: " Weekly community meals " })
    expect(saveProfile).toHaveBeenCalledExactlyOnceWith({ description: "Weekly community meals" })
  })
  it("saves address through canonical geocoding and removes the old fallback address", async () => {
    expect(await save("location", address)).toHaveProperty("message", "Location saved. Your green dot is ready on the globe.")
    expect(saveProfile).toHaveBeenCalledExactlyOnceWith({ locationType: "in_person", address: "", addressStreet: "123 Main St", addressCity: "Chicago", addressState: "IL", addressPostal: "60601", addressCountry: "US" })
  })
  it("does not claim a marker for an address that could not be geocoded", async () => {
    saveProfile.mockResolvedValue({ ok: true, location: { latitude: null, longitude: null } })
    expect((await save("location", address)).message).toContain("couldn’t place it on the globe")
  })
  it("saves online destination without erasing stored physical address fields", async () => {
    await save("location", { ...address, locationType: "online", locationUrl: "https://example.org/help" })
    expect(saveProfile).toHaveBeenCalledExactlyOnceWith({ locationType: "online", locationUrl: "https://example.org/help" })
  })
  it("returns canonical save errors for inline display without claiming success", async () => {
    saveProfile.mockResolvedValue({ error: "This organization was updated elsewhere. Reload before saving." })
    expect(await save("location", address)).toEqual({ error: "This organization was updated elsewhere. Reload before saving." })
  })
})


it("stops scheduling frames while the globe is idle, with or without saved coordinates", () => {
  const frames = new Map<number, FrameRequestCallback>()
  let nextId = 0
  const documentStub = Object.assign(new EventTarget(), { visibilityState: "visible" })
  const media = Object.assign(new EventTarget(), { matches: false })
  const observer = class { observe() {} disconnect() {} }
  vi.stubGlobal("window", { devicePixelRatio: 1, matchMedia: () => media })
  vi.stubGlobal("document", documentStub)
  vi.stubGlobal("ResizeObserver", observer)
  vi.stubGlobal("IntersectionObserver", observer)
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++nextId, callback); return nextId })
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id))
  try {
    for (const location of [null, { latitude: 41.88, longitude: -87.63 }]) {
      const container = Object.assign(new EventTarget(), { getBoundingClientRect: () => ({ width: 400, height: 225 }), appendChild: vi.fn() }) as unknown as HTMLElement
      const runtime = mountLaunchGlobe(container, vi.fn(), location)
      try {
        expect(frames.size).toBe(1)
        const [id, tick] = [...frames][0]
        frames.delete(id)
        tick(performance.now() + 17)
        expect(frames.size).toBe(0)
        // Pointer/focus changes alone must not restart a perpetual render loop.
        container.dispatchEvent(new Event("blur"))
        expect(frames.size).toBe(0)
      } finally { runtime.dispose() }
    }
  } finally { vi.unstubAllGlobals() }
})

it("defaults to the central U.S. view without inventing a location marker", () => {
  const model = createLaunchGlobeScene()
  expect(model.globe.rotation.x).toBeCloseTo(39 * Math.PI / 180)
  expect(model.globe.rotation.y).toBeCloseTo(98 * Math.PI / 180)
  expect(model.globe.children.at(-1)?.visible).toBe(false)
  model.dispose()
})


describe("online resource viewer location", () => {
  it("offers device location instead of opening organization address setup", () => {
    const html = renderToStaticMarkup(React.createElement(OrganizationLaunchMap, { useViewerLocation: true, onAddLocation: vi.fn() }))
    expect(html).toContain("Use my location")
    expect(html).not.toContain("Add location")
  })

  it("returns valid device coordinates with a bounded, low-power request", async () => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((success) => {
      success({ coords: { latitude: 0, longitude: -87.63 } } as GeolocationPosition)
    })
    await expect(requestLaunchViewerLocation({ getCurrentPosition })).resolves.toEqual({ latitude: 0, longitude: -87.63 })
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000,
    })
  })

  it.each([
    [1, "Location access is blocked"],
    [2, "couldn’t be found"],
    [3, "took too long"],
  ])("explains geolocation failure %s without navigation", async (code, message) => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((_, error) => {
      error?.({ code } as GeolocationPositionError)
    })
    await expect(requestLaunchViewerLocation({ getCurrentPosition })).rejects.toThrow(message)
  })

  it("handles unavailable geolocation and rejects invalid coordinates", async () => {
    await expect(requestLaunchViewerLocation(undefined)).rejects.toThrow("isn’t available")
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((success) => {
      success({ coords: { latitude: NaN, longitude: 0 } } as GeolocationPosition)
    })
    await expect(requestLaunchViewerLocation({ getCurrentPosition })).rejects.toThrow("couldn’t be found")
  })
})
