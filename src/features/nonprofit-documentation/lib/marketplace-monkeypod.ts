import type {
  MarketplaceResource,
  MarketplaceResourceGuide,
} from "../marketplace-types"

export const MONKEYPOD_RESOURCE: MarketplaceResource = {
  id: "monkeypod",
  name: "MonkeyPod",
  provider: "MonkeyPod",
  type: "software",
  functions: [
    "finance",
    "fundraising",
    "people",
    "communications",
    "technology",
  ],
  stages: ["forming", "operating", "growing"],
  description:
    "Nonprofit fund accounting, donor CRM, grant tracking, fundraising pages, and email outreach in one platform.",
  headerDescription: "Bring nonprofit finances and relationships together.",
  artworkKind: "logo",
  useWhen:
    "Your team wants to connect donor records, grants, and financial reporting while reducing duplicate entry across tools.",
  costModel: "paid-or-varies",
  costNote:
    "Paid subscriptions vary by plan and billing term. Launchpad offers a free first year and discounted following years for eligible new nonprofits; its years run from IRS approval.",
  eligibility:
    "Built for nonprofits. Launchpad applicants must have received their IRS 501(c)(3) determination letter within the past 12 months.",
  geography:
    "Online; confirm banking, payment, and accounting support for your country. Launchpad eligibility uses U.S. IRS determination dates.",
  delivery: "Online",
  languages: "English source; confirm other language support with MonkeyPod.",
  accessibility:
    "Test key accounting, contact, and fundraising workflows with your team's accessibility needs before adopting.",
  accountRequirement:
    "A MonkeyPod account is required. Compare plans or request a demo before migrating data.",
  url: "https://monkeypod.com/",
  sourceLabel: "MonkeyPod platform overview",
  reviewedDate: "2026-09-15",
  reviewByDate: "2026-12-15",
  whyIncluded:
    "Connects nonprofit financial operations and constituent relationships, with a specific access program for newly recognized nonprofits.",
  relatedGuide: {
    title: "Plan your CRM",
    href: "/documentation/tools/crm#sandbox",
  },
}

export const MONKEYPOD_GUIDE: MarketplaceResourceGuide = {
  outcome:
    "Decide whether a connected accounting and CRM platform fits your team, then plan a manageable migration.",
  preparation: [
    "List your current accounting, donor, grant, and email tools and who owns each workflow.",
    "Prepare a sample chart of accounts, contact fields, and grant reporting needs using fictional or de-identified records.",
    "For Launchpad, check the date on your IRS determination letter before applying.",
  ],
  steps: [
    {
      title: "Compare plans and eligibility",
      description:
        "Review current subscription options, included support, and migration fees. Budget beyond any introductory period.",
      href: "https://monkeypod.com/pricing",
      linkLabel: "Compare MonkeyPod plans",
    },
    {
      title: "Check Launchpad for a new nonprofit",
      description:
        "If your IRS determination letter is less than 12 months old, review Launchpad. Confirm the remaining first-year access and later costs directly with MonkeyPod.",
      href: "https://monkeypod.com/launchpad",
      linkLabel: "Review Launchpad eligibility",
    },
    {
      title: "Walk through one complete workflow",
      description:
        "In a demo, follow a sample donation from the contact record through acknowledgement, fund accounting, and reporting. Include the staff who will use each step.",
      href: "https://monkeypod.com/",
      linkLabel: "Explore MonkeyPod and request a demo",
    },
    {
      title: "Plan migration and verify the results",
      description:
        "Agree on field mapping, roles, opening balances, and a cutover date. Back up your existing data, check imported balances with your finance lead, and test export before retiring old tools.",
      href: "https://monkeypod.com/learn-about/switching",
      linkLabel: "Read the switching guide",
    },
  ],
  watchFor: [
    "Launchpad's program years start at IRS approval, not necessarily the day you sign up.",
    "Confirm migration scope, payment-processing costs, support, and any add-on charges for your selected plan.",
    "Assign an owner for data quality, permissions, and regular financial reconciliation.",
  ],
  sources: [
    { title: "MonkeyPod platform", href: "https://monkeypod.com/" },
    { title: "Plans and pricing", href: "https://monkeypod.com/pricing" },
    {
      title: "Launchpad terms and FAQ",
      href: "https://monkeypod.com/launchpad",
    },
    {
      title: "Migration and switching",
      href: "https://monkeypod.com/learn-about/switching",
    },
  ],
}
