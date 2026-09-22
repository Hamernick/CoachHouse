import type { MarketplaceResource } from "../marketplace-types"
import { PLATFORM_RESOURCE_DEFAULTS } from "./marketplace-platform-defaults"

export const PUBLISHING_RESOURCES: MarketplaceResource[] = [
  {
    ...PLATFORM_RESOURCE_DEFAULTS,
    id: "stripe-nonprofits",
    name: "Stripe for nonprofits",
    provider: "Stripe",
    functions: ["finance", "fundraising", "technology"],
    description:
      "Accept online payments and donations, with discounted processing available to eligible donation-focused nonprofits.",
    headerDescription: "Take payments and check nonprofit processing rates.",
    useWhen:
      "Connect a donation or payment workflow to your organization's bank account and financial reporting.",
    costModel: "discount-eligible",
    costNote:
      "Processing fees apply. Eligible nonprofits can request reduced fees from Stripe; availability depends on region and account use.",
    eligibility:
      "Nonprofit status and a Stripe account used primarily for donations, rather than product or ticket sales. Stripe approval is required.",
    geography:
      "Supported Stripe regions; nonprofit pricing is available only in select regions.",
    accountRequirement:
      "An organizational Stripe account, identity and business verification, and a supported payout bank account.",
    url: "https://stripe.com/",
    sourceLabel: "Stripe payments platform",
    whyIncluded:
      "A widely used payment processor with a documented nonprofit discount application route.",
    relatedGuide: {
      title: "Fundraising plan",
      href: "/documentation/best-practices/fundraising#sandbox",
    },
  },
  {
    ...PLATFORM_RESOURCE_DEFAULTS,
    id: "substack",
    name: "Substack newsletters",
    provider: "Substack",
    functions: ["communications"],
    description:
      "Publish an email newsletter and web archive for your community, with free publishing and optional paid subscriptions.",
    headerDescription:
      "Send your nonprofit's newsletter and publish an archive.",
    useWhen:
      "Share regular stories, program updates, and ways to get involved with people who choose to subscribe.",
    costModel: "free-public",
    costNote:
      "Publishing free newsletters is free. Paid subscriptions incur Substack's 10% platform fee plus payment-processing fees; optional extras may cost more.",
    eligibility:
      "A publisher account that follows Substack's content and platform requirements; no nonprofit status is required.",
    geography:
      "Online; paid subscription availability depends on supported payment regions.",
    accountRequirement:
      "A publisher account and publication. Paid subscriptions require payment setup.",
    url: "https://substack.com/",
    sourceLabel: "Substack publishing platform",
    whyIncluded:
      "A practical way to start an opt-in newsletter without a separate website or email platform.",
    relatedGuide: {
      title: "Marketing plan",
      href: "/documentation/best-practices/marketing#sandbox",
    },
  },
  {
    ...PLATFORM_RESOURCE_DEFAULTS,
    id: "squarespace",
    name: "Squarespace websites",
    provider: "Squarespace",
    functions: ["communications", "technology"],
    description:
      "Build and host a nonprofit website with editable templates, program pages, forms, and options for accepting donations.",
    headerDescription: "Build and host your organization's website.",
    useWhen:
      "Your team needs a public website it can maintain without managing a web server.",
    costModel: "paid-or-varies",
    costNote:
      "A paid website plan is required after the trial. Squarespace lists code NONPROFIT for 10% off the first payment; renewal and add-on costs are separate.",
    eligibility:
      "A website account and suitable paid plan. Confirm the current NONPROFIT offer at checkout.",
    geography:
      "Online; payment features, currencies, and services vary by country.",
    accountRequirement:
      "A Squarespace account; a paid plan to publish beyond the trial, plus domain setup if needed.",
    url: "https://www.squarespace.com/",
    sourceLabel: "Squarespace website platform",
    whyIncluded:
      "Combines website editing and hosting with a documented nonprofit setup guide.",
    relatedGuide: {
      title: "Brand identity",
      href: "/documentation/tools/brand-identity",
    },
  },
]
