import { describe, expect, it } from "vitest"

import {
  buildSameLocationGroups,
  resolveSameLocationGroupKey,
  resolveSameLocationLabel,
} from "@/components/public/public-map-index/same-location-groups"

describe("same-location groups", () => {
  it("groups organizations that share the same exact coordinates", () => {
    const groups = buildSameLocationGroups([
      {
        id: "org-a",
        name: "Org A",
        latitude: 41.8781,
        longitude: -87.6298,
        address: "233 S Wacker Dr, Chicago, IL 60606",
        addressStreet: "233 S Wacker Dr",
        city: "Chicago",
        state: "IL",
        country: "United States",
      },
      {
        id: "org-b",
        name: "Org B",
        latitude: 41.8781,
        longitude: -87.6298,
        address: "233 S Wacker Dr, Chicago, IL 60606",
        addressStreet: "233 S Wacker Dr",
        city: "Chicago",
        state: "IL",
        country: "United States",
      },
      {
        id: "org-c",
        name: "Org C",
        latitude: 41.8782,
        longitude: -87.6298,
        address: null,
        addressStreet: "401 N Michigan Ave",
        city: "Chicago",
        state: "IL",
        country: "United States",
      },
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0]?.organizations.map((organization) => organization.id)).toEqual([
      "org-a",
      "org-b",
    ])
    expect(groups[1]?.organizations.map((organization) => organization.id)).toEqual([
      "org-c",
    ])
  })

  it("offers separate resources at the same street despite entrance coordinate differences", () => {
    const a = { id: "a", name: "Pantry", latitude: 41.9, longitude: -87.6, address: null, addressStreet: "123 North Main Street", city: "Chicago", state: "IL", country: "US" }
    const b = { ...a, id: "b", name: "Clinic", addressStreet: "123 N Main St., Chicago, IL 60601", latitude: 41.9005 }
    const groups = buildSameLocationGroups([b, a])
    expect(groups).toHaveLength(1)
    expect(groups[0].organizations.map(item => item.id)).toEqual(["a", "b"])
    expect(buildSameLocationGroups([a, { ...b, latitude: 42 }])).toHaveLength(2)
    expect(buildSameLocationGroups([a, { ...b, addressStreet: "125 N Main St" }])).toHaveLength(2)
    expect(buildSameLocationGroups([a, { ...b, addressStreet: "123 N Main St Suite 2" }])).toHaveLength(2)
  })

  it("uses a stable coordinate key for shared-location markers", () => {
    expect(
      resolveSameLocationGroupKey({
        longitude: -87.6298,
        latitude: 41.8781,
      }),
    ).toBe("-87.629800:41.878100")
  })

  it("prefers the full address before falling back to city-state-country labels", () => {
    expect(
      resolveSameLocationLabel({
        address: "233 S Wacker Dr, Chicago, IL 60606",
        addressStreet: "233 S Wacker Dr",
        city: "Chicago",
        state: "IL",
        country: "United States",
      }),
    ).toBe("233 S Wacker Dr, Chicago, IL 60606")

    expect(
      resolveSameLocationLabel({
        address: null,
        addressStreet: null,
        city: "Chicago",
        state: "IL",
        country: "United States",
      }),
    ).toBe("Chicago, IL, United States")
  })
})

it("does not duplicate a pin when a third item shares an alternate entrance coordinate", () => {
  const a = { id: "a", name: "Pantry", latitude: 41.9, longitude: -87.6, address: null, addressStreet: "123 Main St", city: "Chicago", state: "IL", country: "US" }
  const b = { ...a, id: "b", latitude: 41.9005 }
  const c = { ...b, id: "c", addressStreet: null }
  const groups = buildSameLocationGroups([c, b, a, a])
  expect(groups).toHaveLength(1)
  expect(groups[0].organizations.map(item=>item.id)).toEqual(["a", "b", "c"])
})


it("retains an address learned from an exact-coordinate collision", () => {
  const a = { id: "a", name: "Pantry", latitude: 41.9, longitude: -87.6, address: null, addressStreet: null, city: "Chicago", state: "IL", country: "US" }
  const b = { ...a, id: "b", addressStreet: "123 Main St" }
  const c = { ...b, id: "c", latitude: 41.9005 }
  expect(buildSameLocationGroups([a,b,c])).toHaveLength(1)
})
