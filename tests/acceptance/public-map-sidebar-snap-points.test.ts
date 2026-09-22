import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { PublicMapDrawerResizeControl } from "@/components/public/public-map-index/drawer-resize-control"
import {
  buildPublicMapDrawerSnapPoints,
  resolveNextPublicMapDrawerSnapPointIndex,
  resolvePublicMapDrawerSnapPointIndex,
  resolvePublicMapDrawerVisibleHeight,
} from "@/components/public/public-map-index/sidebar-snap-points"

describe("buildPublicMapDrawerSnapPoints", () => {
  it("collapses the combined mobile panel to its handle and navigation", () => {
    expect(buildPublicMapDrawerSnapPoints(844, true)).toEqual(["86px", "473px", 1])
    expect(buildPublicMapDrawerSnapPoints(0, true)).toEqual(["86px", "336px", 1])
  })
  it("derives pixel snap points from the measured canvas height", () => {
    expect(buildPublicMapDrawerSnapPoints(520)).toEqual(["168px", "336px", 1])
  })

  it("keeps tall canvases collapsed below the result list", () => {
    expect(buildPublicMapDrawerSnapPoints(980)).toEqual(["168px", "549px", 1])
  })

  it("returns stable fallback pixel snaps before measurement", () => {
    expect(buildPublicMapDrawerSnapPoints(0)).toEqual(["168px", "336px", 1])
  })

  it("resolves the drawer height covering the map at each snap", () => {
    expect(
      resolvePublicMapDrawerVisibleHeight({
        snapPoint: "549px",
        surfaceHeight: 980,
      })
    ).toBe(549)
    expect(
      resolvePublicMapDrawerVisibleHeight({
        snapPoint: 1,
        surfaceHeight: 980,
      })
    ).toBe(980)
    expect(
      resolvePublicMapDrawerVisibleHeight({
        snapPoint: "1200px",
        surfaceHeight: 980,
      })
    ).toBe(980)
    expect(
      resolvePublicMapDrawerVisibleHeight({
        snapPoint: "invalid",
        surfaceHeight: 980,
      })
    ).toBe(0)
  })

  it("cycles compact to middle to full and returns full to middle", () => {
    expect(resolveNextPublicMapDrawerSnapPointIndex(0)).toBe(1)
    expect(resolveNextPublicMapDrawerSnapPointIndex(1)).toBe(2)
    expect(resolveNextPublicMapDrawerSnapPointIndex(2)).toBe(1)
  })

  it("keeps the original handle geometry and adds no hover treatment", () => {
    const markup = renderToStaticMarkup(
      React.createElement(PublicMapDrawerResizeControl, {
        activeSnapIndex: 1,
        onSnapIndexChange: () => undefined,
      })
    )

    expect(markup).toContain("h-auto")
    expect(markup).toContain("px-4 pt-3 pb-2")
    expect(markup).toContain("hover:bg-transparent")
    expect(markup).toContain("hover:text-inherit")
    expect(markup).not.toContain("h-11")
    expect(markup).not.toContain("hover:bg-accent")
    expect(markup).not.toContain("transition-all")
  })

  it("resolves snap values after the measured height shifts", () => {
    const snapPoints = buildPublicMapDrawerSnapPoints(980)

    expect(
      resolvePublicMapDrawerSnapPointIndex({
        snapPoint: "982px",
        snapPoints,
        surfaceHeight: 980,
      })
    ).toBe(2)
    expect(
      resolvePublicMapDrawerSnapPointIndex({
        snapPoint: "550px",
        snapPoints,
        surfaceHeight: 980,
      })
    ).toBe(1)
    expect(
      resolvePublicMapDrawerSnapPointIndex({
        snapPoint: 1,
        snapPoints,
        surfaceHeight: 980,
      })
    ).toBe(2)
  })

  it("ignores missing or invalid snap values", () => {
    const snapPoints = buildPublicMapDrawerSnapPoints(980)

    expect(
      resolvePublicMapDrawerSnapPointIndex({
        snapPoint: null,
        snapPoints,
        surfaceHeight: 980,
      })
    ).toBeNull()
    expect(
      resolvePublicMapDrawerSnapPointIndex({
        snapPoint: "invalid",
        snapPoints,
        surfaceHeight: 980,
      })
    ).toBeNull()
  })
})
