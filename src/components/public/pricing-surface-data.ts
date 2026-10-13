export type PricingTier = {
  id: string
  eyebrow: string
  title: string
  subtitle: string
  priceLine: string
  priceNote?: string
  ctaLabel: string
  ctaHref: string
  featured?: boolean
  badge?: string
  featureHeading: string
  features: Array<string | TierFeature>
}

export type TierFeature = {
  label: string
  badge?: string
  detail?: string
}

const TIERS: PricingTier[] = [
  {
    id: "formation",
    eyebrow: "The Platform (Free)",
    title: "Individual",
    subtitle:
      "Create your organization profile and manage fiscal sponsorship applications. Workspace is available on paid plans.",
    priceLine: "Free",
    ctaLabel: "Create free profile",
    ctaHref: "/sign-up?intent=build&plan=free",
    featureHeading: "Includes",
    features: [
      "1 Admin Seat (founder only)",
      "Organization Profile",
      "Connect your tools",
      "Link files from your Google Drive",
      "Discord + WhatsApp Community access",
    ],
  },
  {
    id: "organization",
    eyebrow: "The Platform (Growth)",
    title: "Organization",
    subtitle:
      "For staff and board members bringing their plans, documents, and work together.",
    priceLine: "$20",
    priceNote: "per month",
    ctaLabel: "Choose Organization",
    ctaHref: "/sign-up?intent=build&plan=organization",
    featured: true,
    badge: "Recommended",
    featureHeading: "Everything in Individual, plus",
    features: [
      "Shared Workspace for staff and board",
      "Projects, tasks, and documents",
      "Accelerator Access",
      "Strategic roadmap editing",
      "Coach House document storage",
      "Electives & additional learning",
      "Staff and board invitations",
    ],
  },
  {
    id: "operations",
    eyebrow: "The Platform (Support)",
    title: "Operations Support",
    subtitle:
      "For nonprofits that need coaching, fiscal sponsorship opportunities, and shared operations support.",
    priceLine: "$58",
    priceNote: "per month",
    ctaLabel: "Choose Operations Support",
    ctaHref: "/sign-up?intent=build&plan=operations_support",
    featureHeading: "Everything in Organization, plus",
    features: [
      "Fiscal sponsorship support",
      "Monthly 1:1 Coaching",
      "Access expert network (bookkeeping, grant writing, accounting)",
      "Expanded delivery and operations support",
      "Discounted coaching",
    ],
  },
]

export const PLATFORM_TIERS = TIERS

export type FeatureState = "included" | "not-included" | "na"
export type FeatureRow = {
  label: string
  labelBadge?: string
  tier1: FeatureState
  tier2: FeatureState
  tier3: FeatureState
}
export type FeatureGroup = {
  title: string
  rows: FeatureRow[]
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: "Platform foundations",
    rows: [
      {
        label: "Guided 501(c)(3) formation",
        tier1: "not-included",
        tier2: "included",
        tier3: "included",
      },
      {
        label: "Strategic roadmap",
        tier1: "not-included",
        tier2: "included",
        tier3: "included",
      },
      {
        label: "Organization profile",
        tier1: "included",
        tier2: "included",
        tier3: "included",
      },
      {
        label: "Organizational profile",
        labelBadge: "Private",
        tier1: "included",
        tier2: "included",
        tier3: "included",
      },
      {
        label: "Organizational profile",
        labelBadge: "Public",
        tier1: "included",
        tier2: "included",
        tier3: "included",
      },
      {
        label: "Secure & centralized document storage",
        tier1: "not-included",
        tier2: "included",
        tier3: "included",
      },
    ],
  },
  {
    title: "Team + community",
    rows: [
      {
        label: "Profile owner",
        tier1: "included",
        tier2: "not-included",
        tier3: "not-included",
      },
      {
        label: "Shared Workspace for staff and board",
        tier1: "not-included",
        tier2: "included",
        tier3: "included",
      },
      {
        label: "Discord + WhatsApp community access",
        tier1: "not-included",
        tier2: "included",
        tier3: "included",
      },
      {
        label: "Weekly members only programming",
        tier1: "not-included",
        tier2: "included",
        tier3: "included",
      },
      {
        label: "Board Member Portal",
        tier1: "not-included",
        tier2: "included",
        tier3: "included",
      },
    ],
  },
  {
    title: "Learning + readiness",
    rows: [
      {
        label: "Accelerator access",
        tier1: "not-included",
        tier2: "included",
        tier3: "included",
      },
      {
        label: "Electives & additional learning",
        tier1: "not-included",
        tier2: "included",
        tier3: "included",
      },
      {
        label: "Fiscal sponsorship applications",
        tier1: "included",
        tier2: "included",
        tier3: "included",
      },
      {
        label: "Quantitative fundability readiness tracker",
        tier1: "not-included",
        tier2: "included",
        tier3: "included",
      },
      {
        label: "Qualitative through-line analysis",
        tier1: "not-included",
        tier2: "included",
        tier3: "included",
      },
    ],
  },
  {
    title: "Operations + delivery support",
    rows: [
      {
        label: "Fiscal sponsorship support",
        tier1: "not-included",
        tier2: "not-included",
        tier3: "included",
      },
      {
        label: "Monthly 1:1 Coaching",
        tier1: "not-included",
        tier2: "not-included",
        tier3: "included",
      },
      {
        label: "Access expert network (bookkeeping, grant writing, accounting)",
        tier1: "not-included",
        tier2: "not-included",
        tier3: "included",
      },
      {
        label: "Expanded delivery and operations support",
        tier1: "not-included",
        tier2: "not-included",
        tier3: "included",
      },
      {
        label: "Discounted coaching",
        tier1: "not-included",
        tier2: "not-included",
        tier3: "included",
      },
    ],
  },
]
