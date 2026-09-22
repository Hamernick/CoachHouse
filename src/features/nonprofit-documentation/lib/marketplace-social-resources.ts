import type {
  MarketplaceResource,
  MarketplaceResourceGuide,
} from "../marketplace-types"
import { PLATFORM_RESOURCE_DEFAULTS } from "./marketplace-platform-defaults"

const SOCIAL_PLATFORMS = [
  {
    id: "instagram",
    name: "Instagram",
    provider: "Meta",
    url: "https://www.instagram.com/",
    description:
      "Share visual stories, Reels, and program updates that help people understand your nonprofit's work and get involved.",
    headline: "Show your work through photos and short videos.",
    useWhen:
      "Your community responds to visual stories and your team can maintain a consistent flow of accessible images and videos.",
    setupUrl:
      "https://www.facebookblueprint.com/student/path/262506-establish-your-business-with-instagram",
    setupTitle: "Meta's Instagram business setup course",
    setup:
      "Create an organization-owned account and review whether a professional account fits your needs. Add your mission, contact path, and a useful website link.",
    example:
      "Introduce one program with an approved image or captioned Reel, explain who it serves, and point people to a clear next step.",
  },
  {
    id: "facebook",
    name: "Facebook",
    provider: "Meta",
    url: "https://www.facebook.com/",
    description:
      "Use an organization Page to share nonprofit updates, events, and community information with people who follow your work.",
    headline: "Keep your community informed through a Facebook Page.",
    useWhen:
      "Your audience already uses Facebook for local information, events, and ongoing community updates.",
    setupUrl:
      "https://trainingworkshops.facebookblueprint.com/student/activity/409145-how-to-create-a-facebook-page",
    setupTitle: "Meta's Facebook Page setup guide",
    setup:
      "Create an organization Page using an authorized administrator's account. Add accurate contact details and assign Page access to the people who will maintain it.",
    example:
      "Publish an upcoming program or event with dates, location, accessibility details, and a link to register or learn more.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    provider: "TikTok",
    url: "https://www.tiktok.com/",
    description:
      "Publish short videos that explain your cause, show programs in action, and help new audiences discover your nonprofit.",
    headline: "Explain your mission through short-form video.",
    useWhen:
      "You have a clear audience and the capacity to create, caption, and moderate short videos consistently.",
    setupUrl: "https://ads.tiktok.com/business/en/solutions/business-account",
    setupTitle: "TikTok Business Account setup",
    setup:
      "Create your account and compare account types before choosing a Business Account. Check available profile links, analytics, and music permissions for your use.",
    example:
      "Answer one common question about your cause in a short, captioned video with a clear explanation of where viewers can learn more.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    provider: "LinkedIn",
    url: "https://www.linkedin.com/",
    description:
      "Create an organization Page to share your nonprofit's work, connect with partners, and reach prospective staff and volunteers.",
    headline: "Build professional relationships around your mission.",
    useWhen:
      "You want to reach partners, professional volunteers, prospective staff, and people interested in your organization's expertise.",
    setupUrl: "https://www.linkedin.com/help/linkedin/answer/a543852/",
    setupTitle: "Create a LinkedIn Page",
    setup:
      "Use an authorized member account to create the organization's Page. Complete the description, website, logo, and administrator access.",
    example:
      "Share a project outcome with evidence, explain what you learned, and invite a relevant partnership or volunteer conversation.",
  },
  {
    id: "x",
    name: "X (Twitter)",
    provider: "X",
    url: "https://x.com/",
    description:
      "Share timely public updates and join conversations with community partners, journalists, and supporters on X, formerly Twitter.",
    headline: "Share timely updates and take part in public conversations.",
    useWhen:
      "The people you need to reach are active on X and your team can monitor fast-moving public replies.",
    setupUrl: "https://help.x.com/en/using-x/create-x-account",
    setupTitle: "X account setup",
    setup:
      "Choose an organization handle, write a clear bio, and add your website. Review current account and subscription requirements for your region.",
    example:
      "Publish a concise program update with a source or information link, then assign someone to answer relevant questions.",
  },
] as const

export const SOCIAL_RESOURCES: MarketplaceResource[] = SOCIAL_PLATFORMS.map(
  (platform) => ({
    ...PLATFORM_RESOURCE_DEFAULTS,
    id: platform.id,
    name: platform.name,
    provider: platform.provider,
    functions:
      platform.id === "linkedin"
        ? ["communications", "people"]
        : ["communications"],
    description: platform.description,
    headerDescription: platform.headline,
    useWhen: platform.useWhen,
    costModel: platform.id === "x" ? "paid-or-varies" : "free-public",
    costNote:
      platform.id === "x"
        ? "Check current account requirements in your region. Optional subscriptions and advertising are paid."
        : "Basic account or Page publishing is free. Advertising, optional subscriptions, and other paid features have separate terms.",
    eligibility:
      "An authorized account holder who meets the platform's age, country, and account requirements.",
    geography:
      "Availability and features vary by country; check the platform's current terms.",
    accountRequirement:
      "An account and an authorized person responsible for publishing, access, and moderation.",
    url: platform.url,
    sourceLabel: `${platform.name} platform`,
    whyIncluded:
      "A familiar publishing channel to consider when it matches your audience, message, and staffing capacity.",
    relatedGuide: {
      title: "Social media planner",
      href: "/documentation/tools/social-media#sandbox",
    },
  })
)

export const SOCIAL_GUIDES: Record<string, MarketplaceResourceGuide> =
  Object.fromEntries(
    SOCIAL_PLATFORMS.map((platform) => [
      platform.id,
      {
        outcome: `Create a useful ${platform.name} presence with clear ownership, an audience, and a manageable publishing plan.`,
        preparation: [
          "Your public organization name, logo, mission, website, and an account recovery contact.",
          "A defined audience, one publishing owner, approved media, and a plan for responding to questions.",
        ],
        steps: [
          {
            title: "Set up the right account",
            description: platform.setup,
            href: platform.setupUrl,
            linkLabel: platform.setupTitle,
          },
          {
            title: "Publish one useful first post",
            description: platform.example,
          },
          {
            title: "Plan a sustainable routine",
            description:
              "Choose a frequency your team can maintain. Review responses and website visits, use captions or alternative text, and record which posts lead to useful conversations or actions.",
            href: "/documentation/tools/social-media#sandbox",
            linkLabel: "Build a social media plan",
          },
        ],
        watchFor: [
          "A social profile is not a guaranteed audience. Choose channels based on who you need to reach and the time you can maintain them.",
          "Get permission before sharing identifiable participant stories or images, and document account recovery and staff handoff.",
          "Paid promotion, verification, and fundraising features have separate eligibility and terms.",
        ],
        sources: [
          { title: platform.setupTitle, href: platform.setupUrl },
          { title: `${platform.name} website`, href: platform.url },
        ],
      },
    ])
  )
