import type {
  MarketplaceResource,
  MarketplaceResourceGuide,
} from "../marketplace-types"
import { PLATFORM_RESOURCE_DEFAULTS } from "./marketplace-platform-defaults"

const ZEFFY_ELIGIBILITY =
  "https://support.zeffy.com/is-my-organization-eligible-to-use-zeffy-8m24r"
const ZEFFY_PRICING =
  "https://www.zeffy.com/home/free-online-fundraising-platform"
const VENMO_CHARITY_INFO =
  "https://help.venmo.com/cs/articles/charity-profile-faq-vhel124"
const VENMO_CHARITY_SETUP =
  "https://help.venmo.com/cs/articles/venmo-charity-profile-setup-guide-vhel366"
const VENMO_REQUIREMENTS =
  "https://help.venmo.com/cs/articles/requirements-vhel170"

export const FUNDRAISING_RESOURCES: MarketplaceResource[] = [
  {
    ...PLATFORM_RESOURCE_DEFAULTS,
    id: "zeffy",
    name: "Zeffy",
    provider: "Zeffy",
    functions: ["fundraising", "finance"],
    description:
      "Donation forms, event ticketing, and donor management with no platform or payment-processing fees for eligible nonprofits.",
    headerDescription: "Fundraising tools without platform or processing fees.",
    useWhen:
      "Your nonprofit needs donation forms and fundraising events with a clear, low-cost path to collecting gifts.",
    costModel: "free-eligible",
    costNote:
      "Zeffy covers platform and payment-processing fees. Donors can optionally contribute to Zeffy at checkout; this is separate from their gift to your organization.",
    eligibility:
      "Nonprofit or charitable organizations in supported countries with a bank account in the organization's name. U.S. organizations need an EIN; 501(c)(3) status is not required.",
    geography:
      "United States, Canada, United Kingdom, Ireland, Australia, and Germany; check country-specific requirements and territory limits.",
    accountRequirement:
      "An organization account, authorized representative, and organization-owned bank account; verification requirements vary by country.",
    url: "https://www.zeffy.com/",
    sourceLabel: "Zeffy fundraising platform",
    whyIncluded:
      "Offers eligible nonprofits a fundraising option that covers processing costs through voluntary donor support.",
  },
  {
    ...PLATFORM_RESOURCE_DEFAULTS,
    id: "venmo-charity-profiles",
    name: "Venmo charity profiles",
    provider: "Venmo",
    functions: ["fundraising", "finance"],
    description:
      "A verified charity profile for receiving Venmo donations, sharing a donation QR code, and accessing donor records.",
    headerDescription: "Accept donations through a verified charity profile.",
    useWhen:
      "Your supporters use Venmo and your organization wants a dedicated charity profile for online or in-person giving.",
    costModel: "paid-or-varies",
    costNote:
      "Venmo lists a fee of 1.9% + $0.10 per donation received. Expedited access to funds may carry additional fees; review current terms.",
    eligibility:
      "Charitable organizations with charity status confirmed on PayPal. The PayPal charity account and Venmo account must have the same owner.",
    geography:
      "United States; the account owner must meet Venmo's U.S. location and mobile-phone requirements.",
    delivery: "Online and in person through a donation QR code",
    accountRequirement:
      "A PayPal Business account with confirmed charity status and a linked Venmo account. Manage the charity profile in the Venmo app.",
    url: VENMO_CHARITY_INFO,
    sourceLabel: "Venmo charity profile information",
    whyIncluded:
      "Provides a charity-specific donation option for supporters who already use Venmo.",
  },
]

export const FUNDRAISING_GUIDES: Record<string, MarketplaceResourceGuide> = {
  zeffy: {
    outcome:
      "Prepare a donation form your team can explain clearly and reconcile with its records.",
    preparation: [
      "Your organization's registration details, bank account, and authorized representative.",
      "A campaign purpose, fundraising goal, and the information you need from donors.",
    ],
    steps: [
      {
        title: "Confirm organizational eligibility",
        description:
          "Check the country-specific requirements before registering. Use your organization's bank account and prepare the requested verification documents.",
        href: ZEFFY_ELIGIBILITY,
        linkLabel: "Check Zeffy eligibility",
      },
      {
        title: "Review the donor checkout",
        description:
          "Create a form for one campaign. Preview the suggested contribution to Zeffy so your team can explain that it is voluntary and separate from the donation.",
        href: ZEFFY_PRICING,
        linkLabel: "Understand Zeffy's funding model",
      },
      {
        title: "Plan acknowledgements and reconciliation",
        description:
          "Agree on who reviews donor records, answers payment questions, and matches payouts to your accounting. Check the available exports before sharing the form widely.",
      },
    ],
    watchFor: [
      "Country-specific eligibility and verification still apply even though the platform is free.",
      "Show donors how the optional Zeffy contribution affects their checkout total.",
    ],
    sources: [
      { title: "Zeffy platform", href: "https://www.zeffy.com/" },
      { title: "Eligibility and supported countries", href: ZEFFY_ELIGIBILITY },
      { title: "Pricing and optional contributions", href: ZEFFY_PRICING },
    ],
  },
  "venmo-charity-profiles": {
    outcome:
      "Set up a verified charity profile with clear ownership and a repeatable donation-records workflow.",
    preparation: [
      "Your PayPal Business account and confirmed charity status.",
      "The same account owner for PayPal and Venmo, plus your organization's description and images.",
    ],
    steps: [
      {
        title: "Check charity status and account ownership",
        description:
          "Start with your PayPal Business account and confirm its charity status. Check the designated owner carefully: Venmo says account and profile ownership cannot be transferred.",
        href: VENMO_CHARITY_SETUP,
        linkLabel: "Read the charity profile setup guide",
      },
      {
        title: "Create the charity profile from PayPal",
        description:
          "Find Venmo charity profiles in PayPal's App Center. Follow the linked setup, verify contact details, and preview the profile before publishing.",
        href: VENMO_CHARITY_SETUP,
        linkLabel: "Follow Venmo's setup instructions",
      },
      {
        title: "Share the profile and track donations",
        description:
          "Use the charity's QR code or profile link. Assign someone to reconcile donations, transaction fees, and transfers using the available statements.",
        href: VENMO_CHARITY_INFO,
        linkLabel: "Review charity profile features and fees",
      },
    ],
    watchFor: [
      "An existing Venmo business profile cannot be converted into a charity profile.",
      "Charity profile management requires the app; statements are also available on the web.",
      "Plan for the donation transaction fee when estimating net proceeds.",
    ],
    sources: [
      { title: "Charity profile information and fees", href: VENMO_CHARITY_INFO },
      { title: "Charity profile setup guide", href: VENMO_CHARITY_SETUP },
      { title: "Venmo account requirements", href: VENMO_REQUIREMENTS },
    ],
  },
}
