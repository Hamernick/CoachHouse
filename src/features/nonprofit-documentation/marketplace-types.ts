import type { DocumentationStageId } from "./types"

export type MarketplaceResourceType =
  | "coaching"
  | "software"
  | "discount"
  | "funding"
  | "learning"
  | "people"
  | "professional-support"
  | "resource-bank"

export type MarketplaceFunction =
  | "formation"
  | "governance"
  | "fundraising"
  | "finance"
  | "people"
  | "communications"
  | "technology"
  | "data"

export type MarketplaceCostModel =
  | "free-public"
  | "free-eligible"
  | "discount-eligible"
  | "paid-or-varies"
  | "account-based"

export type MarketplaceResource = {
  id: string
  name: string
  provider: string
  type: MarketplaceResourceType
  functions: MarketplaceFunction[]
  stages: DocumentationStageId[]
  description: string
  headerDescription: string
  artworkKind?: "logo"
  useWhen: string
  costModel: MarketplaceCostModel
  costNote: string
  eligibility: string
  geography: string
  delivery: string
  languages: string
  accessibility: string
  accountRequirement: string
  url: string
  sourceLabel: string
  reviewedDate: string
  reviewByDate: string
  whyIncluded: string
  relatedGuide?: { title: string; href: string }
  referralOffer?: {
    label: string
    href: string
    description: string
  }
}

export type MarketplaceFilters = {
  query: string
  type: MarketplaceResourceType | "all"
  function: MarketplaceFunction | "all"
  stage: DocumentationStageId | "all"
  cost: MarketplaceCostModel | "all"
}

export type MarketplaceResourceGuide = {
  outcome: string
  preparation: string[]
  steps: Array<{
    title: string
    description: string
    href?: string
    linkLabel?: string
  }>
  examples?: Array<{ title: string; description: string }>
  watchFor: string[]
  sources: Array<{ title: string; href: string }>
}

export type MarketplaceCommunityProfile = {
  id: string
  name: string
  slug: string
  summary: string
  location: string
  delivery: "Online" | "Local or hybrid"
  group: string
  programCount: number
}
