import type { DocumentationNavItem, DocumentationNavSection } from "../types"

export const DOCUMENTATION_PATH = "/documentation"

export const DOCUMENTATION_NAVIGATION: DocumentationNavSection[] = [
  {
    id: "get-started",
    title: "Get started",
    items: [
      {
        title: "Quickstart",
        description: "Choose the next step for your nonprofit stage.",
        href: `${DOCUMENTATION_PATH}/quickstart`,
        status: "live",
      },
      {
        title: "Key concepts",
        description: "Learn the terms that shape nonprofit decisions.",
        href: `${DOCUMENTATION_PATH}/key-concepts`,
        status: "live",
      },
    ],
  },
  {
    id: "best-practices",
    title: "Best practices",
    items: [
      {
        title: "Mission",
        description: "Write a mission that guides decisions and programs.",
        href: `${DOCUMENTATION_PATH}/best-practices/mission`,
        status: "live",
      },
      {
        title: "Compliance",
        description: "Build a reliable federal and state compliance rhythm.",
        href: `${DOCUMENTATION_PATH}/best-practices/compliance`,
        status: "live",
      },
      {
        title: "Fundraising",
        description: "Develop ethical, durable sources of support.",
        href: `${DOCUMENTATION_PATH}/best-practices/fundraising`,
        status: "live",
      },
      {
        title: "Marketing",
        description: "Reach the people your work is designed to serve.",
        href: `${DOCUMENTATION_PATH}/best-practices/marketing`,
        status: "live",
      },
      {
        title: "Frameworks",
        description: "Choose a useful model and test its assumptions.",
        href: `${DOCUMENTATION_PATH}/best-practices/frameworks`,
        status: "live",
      },
      {
        title: "Measuring impact",
        description: "Connect activities, outcomes, and evidence.",
        href: `${DOCUMENTATION_PATH}/best-practices/measuring-impact`,
        status: "live",
      },
      {
        title: "Sustainability",
        description: "Balance mission, people, money, and capacity.",
        href: `${DOCUMENTATION_PATH}/best-practices/sustainability`,
        status: "live",
      },
      {
        title: "Partnerships",
        description: "Build relationships with clear shared value.",
        href: `${DOCUMENTATION_PATH}/best-practices/partnerships`,
        status: "live",
      },
    ],
  },
  {
    id: "fund-your-project",
    title: "Fund your project",
    items: [
      {
        title: "Fiscal sponsorship",
        description: "Review project requirements and the application process.",
        href: "/documentation/fiscal-sponsorship",
        status: "live",
        isNew: true,
      },
    ],
  },
  {
    id: "tools",
    title: "Tools",
    items: [
      {
        title: "Brand identity",
        description: "Create a usable nonprofit brand system.",
        href: `${DOCUMENTATION_PATH}/tools/brand-identity`,
        status: "live",
        isNew: true,
      },
      {
        title: "Social media",
        description: "Plan channels, content, and governance.",
        href: `${DOCUMENTATION_PATH}/tools/social-media`,
        status: "live",
      },
      {
        title: "Networking",
        description: "Build a relationship system around the mission.",
        href: `${DOCUMENTATION_PATH}/tools/networking`,
        status: "live",
      },
      {
        title: "HR",
        description: "Support staff and volunteers responsibly.",
        href: `${DOCUMENTATION_PATH}/tools/hr`,
        status: "live",
      },
      {
        title: "Finance",
        description: "Build budgets, controls, and reporting habits.",
        href: `${DOCUMENTATION_PATH}/tools/finance`,
        status: "live",
      },
      {
        title: "Legal",
        description: "Understand common legal decisions and referrals.",
        href: `${DOCUMENTATION_PATH}/tools/legal`,
        status: "live",
      },
      {
        title: "Campaigns",
        description: "Plan focused, measurable public efforts.",
        href: `${DOCUMENTATION_PATH}/tools/campaigns`,
        status: "live",
      },
      {
        title: "CRM",
        description: "Choose and maintain a useful relationship record.",
        href: `${DOCUMENTATION_PATH}/tools/crm`,
        status: "live",
      },
    ],
  },
  {
    id: "resources",
    title: "Resources",
    items: [
      {
        title: "Map",
        description: "Explore nonprofit organizations and services.",
        href: "/resources",
        status: "live",
      },
      {
        title: "Marketplace",
        description: "Compare source-backed tools, discounts, and support.",
        href: `${DOCUMENTATION_PATH}/marketplace`,
        status: "live",
      },
    ],
  },
]

export function getDocumentationNavItem(pathname: string) {
  for (const section of DOCUMENTATION_NAVIGATION) {
    const item = section.items.find(({ href }) => href === pathname)
    if (item) return item
  }
  return null
}

export function listLiveDocumentationItems(): DocumentationNavItem[] {
  return DOCUMENTATION_NAVIGATION.flatMap((section) => section.items).filter(
    (item) => item.status === "live"
  )
}
