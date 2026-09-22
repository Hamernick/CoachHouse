import type { MarketplaceResource } from "../marketplace-types"
import { MONKEYPOD_RESOURCE } from "./marketplace-monkeypod"
import { PUBLISHING_RESOURCES } from "./marketplace-publishing-resources"
import { SOCIAL_RESOURCES } from "./marketplace-social-resources"
import { FUNDRAISING_RESOURCES } from "./marketplace-fundraising-resources"

const ONLINE = {
  stages: ["forming", "operating", "growing"],
  delivery: "Online",
  languages: "English source; check the provider for other languages.",
  accessibility: "Try the relevant workflow with your team before adopting it.",
  reviewedDate: "2026-09-04",
  reviewByDate: "2026-12-04",
} satisfies Partial<MarketplaceResource>

export const MARKETPLACE_RESOURCE_ADDITIONS: MarketplaceResource[] = [
  MONKEYPOD_RESOURCE,
  ...PUBLISHING_RESOURCES,
  ...SOCIAL_RESOURCES,
  ...FUNDRAISING_RESOURCES,
  {
    ...ONLINE,
    id: "google-ad-grants",
    name: "Google Ad Grants",
    provider: "Google",
    type: "discount",
    functions: ["communications", "fundraising"],
    description:
      "Up to $10,000 USD each month in Search advertising for eligible nonprofits.",
    headerDescription: "Search advertising credit for eligible nonprofits.",
    useWhen:
      "Help people searching for your cause find a program, volunteer opportunity, or donation page.",
    costModel: "free-eligible",
    costNote:
      "In-kind Search ads, not cash. Unused credit does not roll over; spend and results are not guaranteed.",
    eligibility:
      "Approved Google for Nonprofits organization, eligible website, and ongoing Ad Grants policy compliance.",
    geography:
      "Available in supported countries; eligibility depends on registration country.",
    accountRequirement:
      "Google for Nonprofits approval and separate Ad Grants activation.",
    url: "https://www.google.com/grants/",
    sourceLabel: "Google Ad Grants program and FAQ",
    whyIncluded:
      "A substantial advertising offer with a clear application route and useful local campaign applications.",
    relatedGuide: {
      title: "Campaign planner",
      href: "/documentation/tools/campaigns?template=ad-grants#sandbox",
    },
  },
  {
    ...ONLINE,
    id: "google-workspace-nonprofits",
    name: "Google Workspace for Nonprofits",
    provider: "Google",
    type: "software",
    functions: ["technology", "communications"],
    description:
      "Organization email, shared files, documents, calendars, and video meetings on a $0 nonprofit plan.",
    headerDescription: "Email and teamwork for eligible nonprofits.",
    useWhen:
      "Move team work out of personal email accounts and into organization-managed accounts.",
    costModel: "free-eligible",
    costNote:
      "The nonprofit edition is $0 per user per month. Other Workspace editions are paid, even with a nonprofit discount.",
    eligibility:
      "Google for Nonprofits approval and Workspace activation requirements.",
    geography: "Supported Google for Nonprofits countries.",
    accountRequirement:
      "An organizational domain and an administrator who can verify ownership.",
    url: "https://www.google.com/nonprofits/offerings/workspace/",
    sourceLabel: "Google Workspace nonprofit plan comparison",
    referralOffer: {
      label: "Google Workspace referral offer",
      href: "https://referworkspace.app.goo.gl/n3FS",
      description:
        "For paid Workspace plans. Google sets eligibility and offer terms. Coach House may earn a referral reward.",
    },
    whyIncluded:
      "A practical starting point for a small team's communications and document ownership.",
  },
  {
    ...ONLINE,
    id: "design-gigs-for-good",
    name: "Design Gigs for Good",
    provider: "Design Gigs for Good",
    type: "people",
    functions: ["communications", "people"],
    stages: ["exploring", "forming", "operating", "growing"],
    description:
      "A community-run design and social-impact job board, with an international Slack community.",
    headerDescription: "Design jobs and a global community.",
    useWhen:
      "Find mission-aligned design opportunities, learn from designers, or prepare a clear creative hiring brief.",
    costModel: "free-public",
    costNote:
      "Free to browse. A free job board does not mean the people on it work for free.",
    eligibility: "Read community and posting rules before participating.",
    geography:
      "International community; each opportunity has its own location requirements.",
    accountRequirement:
      "Public job board; Google or Slack access may be needed to participate.",
    url: "https://groups.google.com/g/design-gigs-for-good",
    sourceLabel: "Design Gigs for Good website and public job board",
    whyIncluded:
      "A useful specialist community that is easy to miss in general nonprofit software lists.",
    relatedGuide: {
      title: "Brand identity",
      href: "/documentation/tools/brand-identity",
    },
  },
  {
    ...ONLINE,
    id: "taproot-plus",
    name: "Taproot Plus",
    provider: "Taproot Foundation",
    type: "professional-support",
    functions: ["communications", "finance", "people", "technology"],
    description:
      "Free skilled volunteer projects and one-hour consultations for nonprofit teams.",
    headerDescription: "Skilled volunteers for nonprofit projects.",
    useWhen:
      "You can name a bounded deliverable: a campaign brief, budget review, website wireframe, or operations process.",
    costModel: "free-eligible",
    costNote:
      "Free program; your team still needs time to prepare, collaborate, and review the work.",
    eligibility:
      "Nonprofits, public schools, and fiscally sponsored social-good organizations in supported regions.",
    geography:
      "United States, Canada, European Union, India, and United Kingdom.",
    accountRequirement: "Create an organizational profile to request support.",
    url: "https://taprootfoundation.org/taproot-plus",
    sourceLabel: "Taproot Plus overview and process",
    whyIncluded:
      "A practical route to professional help when a software discount cannot solve the problem.",
    relatedGuide: {
      title: "Partnership brief",
      href: "/documentation/best-practices/partnerships#sandbox",
    },
  },
  {
    ...ONLINE,
    id: "catchafire-resource-bank",
    name: "Catchafire resource bank",
    provider: "Catchafire",
    type: "resource-bank",
    functions: ["technology", "communications", "fundraising", "data"],
    stages: ["exploring", "forming", "operating", "growing"],
    description:
      "A public database of free and discounted nonprofit software, with related skilled-volunteer projects.",
    headerDescription: "Free and discounted nonprofit software.",
    useWhen:
      "Explore more options after you have identified a specific technology need.",
    costModel: "free-public",
    costNote:
      "The directory is public. Listed products and Catchafire project access have separate terms.",
    eligibility:
      "Browse publicly; check each provider's own eligibility rules.",
    geography: "Online directory; product availability varies by provider.",
    accountRequirement:
      "No Catchafire membership needed to read the resource page.",
    url: "https://www.catchafire.org/nonprofitresources/",
    sourceLabel: "Catchafire nonprofit resources",
    whyIncluded:
      "A deeper resource bank for discovery, with a useful bridge from choosing tools to getting implementation help.",
  },
  {
    ...ONLINE,
    id: "techsoup-digital-assessment",
    name: "TechSoup Digital Assessment",
    provider: "TechSoup",
    type: "learning",
    functions: ["technology", "data"],
    description:
      "A free assessment to identify technology gaps and plan improvements for your nonprofit.",
    headerDescription: "Assess technology gaps and plan improvements.",
    useWhen:
      "Your team has accumulated tools but needs a clear order for what to improve next.",
    costModel: "free-public",
    costNote:
      "Assessment access is free. Recommended products or services may cost money.",
    eligibility: "Designed for nonprofit organizations.",
    geography: "Online; local product and support availability varies.",
    accountRequirement: "Follow the assessment's current registration process.",
    url: "https://assessment.techsoup.org/",
    sourceLabel: "TechSoup Digital Assessment Tool",
    whyIncluded:
      "Helps a team choose its next technology investment before shopping for another product.",
  },
  {
    ...ONLINE,
    id: "adobe-express-nonprofits",
    name: "Adobe Express for Nonprofits",
    provider: "Adobe",
    type: "software",
    functions: ["communications"],
    description:
      "Free Express Premium access for eligible nonprofits creating social posts, flyers, videos, and presentations.",
    headerDescription: "Free Express Premium for eligible nonprofits.",
    useWhen:
      "Turn an existing brand and campaign message into reusable content templates.",
    costModel: "free-eligible",
    costNote:
      "The published offer is a one-year Express Premium subscription for up to 50 people. Check renewal terms.",
    eligibility: "Qualifying nonprofit status under Adobe's program criteria.",
    geography: "Check Adobe's current country and nonprofit eligibility terms.",
    accountRequirement: "Application and Adobe accounts required.",
    url: "https://www.adobe.com/nonprofits/express.html",
    sourceLabel: "Adobe Express for Nonprofits offer and FAQ",
    whyIncluded:
      "A specific creative-tool offer that small communications teams can use without a full design suite.",
    relatedGuide: {
      title: "Social media planner",
      href: "/documentation/tools/social-media#sandbox",
    },
  },
  {
    ...ONLINE,
    id: "asana-nonprofits",
    name: "Asana for Nonprofits",
    provider: "Asana",
    type: "software",
    functions: ["technology", "people"],
    description:
      "A 50% nonprofit discount on eligible Starter and Advanced project-management plans.",
    headerDescription: "50% off eligible Asana plans.",
    useWhen:
      "Coordinate a recurring program or campaign across owners, deadlines, and dependencies.",
    costModel: "discount-eligible",
    costNote:
      "A discount on a paid subscription; compare the free plan and total seat cost before upgrading.",
    eligibility:
      "Eligible registered nonprofits and public libraries; verification required.",
    geography:
      "U.S. 501(c)(3) organizations and qualifying international equivalents.",
    accountRequirement:
      "Apply for verification and follow Asana's subscription instructions.",
    url: "https://asana.com/industry/nonprofit",
    sourceLabel: "Asana nonprofit program",
    whyIncluded:
      "A useful paid option when a team has outgrown a shared task list.",
  },
  {
    ...ONLINE,
    id: "trustlaw",
    name: "TrustLaw",
    provider: "Thomson Reuters Foundation",
    type: "professional-support",
    functions: ["governance", "formation", "people"],
    description:
      "A global network connecting eligible organizations with free legal support and practical legal resources.",
    headerDescription: "Free legal support for eligible organizations.",
    useWhen:
      "Prepare a scoped organizational legal question for qualified counsel in the relevant jurisdiction.",
    costModel: "free-eligible",
    costNote:
      "TrustLaw's matching service is free. Confirm any external expenses and the scope with the legal team.",
    eligibility:
      "Registered organizations meeting TrustLaw's mission, governance, and operating criteria; membership approval required.",
    geography:
      "Global network; assistance depends on jurisdiction and available legal teams.",
    accountRequirement: "Apply for membership before requesting a legal match.",
    url: "https://www.trust.org/trustlaw/",
    sourceLabel: "TrustLaw service and eligibility criteria",
    whyIncluded:
      "A source of actual professional support beyond a general legal-information article.",
    relatedGuide: {
      title: "Legal preparation",
      href: "/documentation/tools/legal#sandbox",
    },
  },
]
