import type {
  DocumentationSearchDocument,
  DocumentationSearchSection,
} from "../search-types"
import type { BestPracticeArticle, FoundationGuide } from "../types"
import { BRAND_IDENTITY_SECTIONS } from "./brand-identity"
import { CAMPAIGNS_ARTICLE } from "./campaigns-article"
import { COMPLIANCE_ARTICLE } from "./compliance-article"
import { commonFederalFilingPath } from "./compliance-rhythm"
import { getDocumentationToolMetadata } from "./documentation-tools"
import { CRM_ARTICLE } from "./crm-article"
import { FINANCE_ARTICLE } from "./finance-article"
import { KEY_CONCEPTS_GUIDE, QUICKSTART_GUIDE } from "./foundation-guides"
import { FRAMEWORKS_ARTICLE } from "./frameworks-article"
import { FUNDRAISING_ARTICLE } from "./fundraising-article"
import { HR_ARTICLE } from "./hr-article"
import { LEGAL_ARTICLE } from "./legal-article"
import { MARKETING_ARTICLE } from "./marketing-article"
import { MARKETPLACE_RESOURCE_GUIDES } from "./marketplace-resource-guides"
import { MARKETPLACE_RESOURCES } from "./marketplace-resources"
import { MEASURING_IMPACT_ARTICLE } from "./measuring-impact-article"
import { MISSION_ARTICLE } from "./mission-article"
import { DOCUMENTATION_NAVIGATION, DOCUMENTATION_PATH } from "./navigation"
import { NETWORKING_ARTICLE } from "./networking-article"
import { PARTNERSHIPS_ARTICLE } from "./partnerships-article"
import { SOCIAL_MEDIA_ARTICLE } from "./social-media-article"
import { SUSTAINABILITY_ARTICLE } from "./sustainability-article"

// Explicit authored-content registry. Never import drafts, account state, or
// dynamic Community profiles into the public documentation search corpus.
const articles = [
  MISSION_ARTICLE,
  COMPLIANCE_ARTICLE,
  FUNDRAISING_ARTICLE,
  MARKETING_ARTICLE,
  FRAMEWORKS_ARTICLE,
  MEASURING_IMPACT_ARTICLE,
  SUSTAINABILITY_ARTICLE,
  PARTNERSHIPS_ARTICLE,
  SOCIAL_MEDIA_ARTICLE,
  NETWORKING_ARTICLE,
  HR_ARTICLE,
  FINANCE_ARTICLE,
  LEGAL_ARTICLE,
  CAMPAIGNS_ARTICLE,
  CRM_ARTICLE,
]

function authoredText(value: unknown): string {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.map(authoredText).join(" ")
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => !["id", "url", "href", "slug"].includes(key))
      .map(([, item]) => authoredText(item))
      .join(" ")
  }
  return ""
}

function section(
  id: string,
  title: string,
  content: unknown
): DocumentationSearchSection {
  return { id, title, text: authoredText(content) }
}

function articleDocument(
  article: BestPracticeArticle
): DocumentationSearchDocument {
  const tool = getDocumentationToolMetadata(article.slug)
  const toolContent =
    article.slug === "best-practices/compliance"
      ? [
          tool?.description,
          commonFederalFilingPath("normally-50k-or-less", "under-500k"),
          commonFederalFilingPath("under-200k", "under-500k"),
          commonFederalFilingPath("200k-or-more", "500k-or-more"),
        ]
      : tool?.description
  return {
    href: `${DOCUMENTATION_PATH}/${article.slug}`,
    title: article.navigationTitle,
    category: article.slug.startsWith("tools/") ? "Tools" : "Best practices",
    description: article.description,
    sections: [
      { title: article.title, text: article.answer },
      section("definition", article.labels.definition, [
        article.definition,
        article.importantNote,
      ]),
      section("why-it-matters", "Why it matters", article.whyItMatters),
      section("stages", article.labels.stages, article.stages),
      ...(tool ? [section("sandbox", tool.title, toolContent)] : []),
      section("example", article.labels.example, article.example),
      section("framework", article.labels.framework, article.framework),
      section("checklist", article.labels.checklist, article.checklist),
      section("mistakes", article.labels.mistakes, article.mistakes),
      section("measures", article.labels.measures, [
        article.measuresIntroduction,
        article.measures,
      ]),
      section("sources", "Sources", [article.sources, article.disclaimer]),
    ],
  }
}

function foundationDocument(
  guide: FoundationGuide
): DocumentationSearchDocument {
  return {
    href: `${DOCUMENTATION_PATH}/${guide.slug}`,
    title: guide.title,
    category: "Get started",
    description: guide.description,
    sections: [
      { title: guide.title, text: guide.answer },
      ...guide.sections.map((item) =>
        section(item.id, item.title, [item.introduction, item.entries])
      ),
      section("stages", "Guidance by stage", guide.stages),
      section("checklist", "Checklist", guide.checklist),
      section("sources", "Sources", guide.sources),
    ],
  }
}

const brandDescriptions: Record<
  (typeof BRAND_IDENTITY_SECTIONS)[number]["id"],
  string
> = {
  foundation: "Organization name, tagline, mission, brand voice, and audience.",
  marks: "Upload primary and alternate logos, clear space, and minimum size.",
  "color-palette":
    "Background, primary, secondary, and text colors. HEX, RGB, color proportions, accessibility, and contrast checks.",
  typography:
    "Heading and body fonts, fallback stacks, and modular type scale.",
  applications:
    "Preview campaign composition and upload illustration and photography assets.",
  exports:
    "Download a ZIP brand kit with JSON, CSS tokens, guidance, and uploaded originals. Copy tokens or print the guide.",
}

export const DOCUMENTATION_SEARCH_DOCUMENTS: DocumentationSearchDocument[] = [
  {
    href: DOCUMENTATION_PATH,
    title: "Documentation home",
    category: "Library",
    description:
      "Practical guides and working tools for nonprofit founders and teams.",
    sections: [
      {
        title: "Nonprofit documentation",
        text: "Exploring, forming, operating, and growing. Quickstart, key concepts, best practices, tools, and resources.",
      },
    ],
  },
  foundationDocument(QUICKSTART_GUIDE),
  foundationDocument(KEY_CONCEPTS_GUIDE),
  ...articles.map(articleDocument),
  {
    href: `${DOCUMENTATION_PATH}/tools/brand-identity`,
    title: "Brand identity",
    category: "Tools",
    description:
      "Build a clear, accessible nonprofit brand system, then download everything your team needs to use it consistently.",
    sections: BRAND_IDENTITY_SECTIONS.map((item) =>
      section(item.id, item.label, brandDescriptions[item.id])
    ),
  },
  {
    href: `${DOCUMENTATION_PATH}/marketplace`,
    title: "Marketplace",
    category: "Resources",
    description:
      "Compare source-backed tools, discounts, funding, learning, and professional support.",
    sections: [
      {
        id: "directory",
        title: "Tools and resources",
        text: "Software, nonprofit offers, resource banks, professional support, and saved resources.",
      },
    ],
  },
  {
    href: "/documentation/fiscal-sponsorship",
    title: "Fiscal sponsorship",
    category: "Fund your project",
    description: "Review requirements, create a free account, and apply for fiscal sponsorship.",
    sections: [
      section("requirements", "What to prepare", "Charitable public benefit, legal structure, contact information, budget and funding plan."),
      section("application", "Your application", "Start, save a draft, resume and submit for review. No paid plan required. Sponsorship does not guarantee funding."),
    ],
  },
  ...MARKETPLACE_RESOURCES.map((resource): DocumentationSearchDocument => {
    const guide = MARKETPLACE_RESOURCE_GUIDES[resource.id]
    return {
      href: `${DOCUMENTATION_PATH}/marketplace/${resource.id}`,
      title: resource.name,
      category: "Resources",
      description: resource.description,
      sections: [
        section("use-when", "What you can do with it", [
          resource.useWhen,
          guide?.outcome,
        ]),
        {
          title: "Offer and eligibility",
          text: authoredText([
            resource.provider,
            resource.costNote,
            resource.eligibility,
          ]),
        },
        ...(guide
          ? [
              section("prepare", "Before you start", guide.preparation),
              section("get-started", "Put it to work", guide.steps),
              ...(guide.examples?.length
                ? [section("examples", "Ways to use it", guide.examples)]
                : []),
              section("watch-for", "Know before you commit", guide.watchFor),
            ]
          : []),
      ],
    }
  }),
].filter(
  (document) =>
    document.href === DOCUMENTATION_PATH ||
    MARKETPLACE_RESOURCES.some(
      (resource) =>
        document.href === `${DOCUMENTATION_PATH}/marketplace/${resource.id}`
    ) ||
    DOCUMENTATION_NAVIGATION.some((group) =>
      group.items.some(
        (item) => item.status === "live" && item.href === document.href
      )
    )
)
