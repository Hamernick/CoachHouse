import type { MarketplaceResource } from "../marketplace-types"

export const PLATFORM_RESOURCE_DEFAULTS = {
  type: "software",
  stages: ["forming", "operating", "growing"],
  artworkKind: "logo",
  delivery: "Online",
  languages: "Language support varies; check the provider for your team.",
  accessibility:
    "Test the relevant workflows with your team; use accessible text, links, images, and captions in published content.",
  reviewedDate: "2026-09-15",
  reviewByDate: "2026-12-15",
} satisfies Partial<MarketplaceResource>
