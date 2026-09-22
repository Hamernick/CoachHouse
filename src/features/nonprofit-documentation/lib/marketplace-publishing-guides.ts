import type { MarketplaceResourceGuide } from "../marketplace-types"

export const PUBLISHING_GUIDES: Record<string, MarketplaceResourceGuide> = {
  "stripe-nonprofits": {
    outcome:
      "Choose a payment workflow and understand fees, payouts, and nonprofit pricing before accepting live payments.",
    preparation: [
      "Your legal organization details, nonprofit documentation, website, and the person authorized to manage payments.",
      "A clear description of donations versus product or ticket sales, plus your existing fundraising and accounting tools.",
    ],
    steps: [
      {
        title: "Check nonprofit pricing eligibility",
        description:
          "Review Stripe's nonprofit criteria and request approval through its support process. Ask which charges, currencies, and payment methods receive the reduced rate.",
        href: "https://support.stripe.com/questions/fee-discount-for-nonprofit-organizations",
        linkLabel: "Review Stripe's nonprofit discount",
      },
      {
        title: "Choose your payment workflow",
        description:
          "Compare the Stripe integration in your donation platform with Stripe-hosted payment options. Check recurring giving, receipts, refunds, and accounting exports.",
        href: "https://stripe.com/payments",
        linkLabel: "Explore Stripe Payments",
      },
      {
        title: "Test before going live",
        description:
          "Use test mode to check successful and failed payments, receipts, and refunds. Assign someone to reconcile payouts and monitor disputes before accepting real money.",
        href: "https://docs.stripe.com/testing",
        linkLabel: "Read Stripe's testing guide",
      },
    ],
    watchFor: [
      "Nonprofit rates are not automatic and do not make payment processing free.",
      "Your fundraising platform may charge separate fees; confirm the combined cost and who sends receipts.",
      "Keep payment access with named administrators and review payout and dispute settings.",
    ],
    sources: [
      {
        title: "Nonprofit fee discount",
        href: "https://support.stripe.com/questions/fee-discount-for-nonprofit-organizations",
      },
      { title: "Stripe pricing", href: "https://stripe.com/pricing" },
      { title: "Testing payments", href: "https://docs.stripe.com/testing" },
    ],
  },
  substack: {
    outcome:
      "Launch a newsletter with a clear audience, opt-in subscription process, and sustainable publishing schedule.",
    preparation: [
      "A publication name, short description, reply-to contact, and an editor responsible for each issue.",
      "A first issue and a clear record of subscriber consent before importing an existing list.",
    ],
    steps: [
      {
        title: "Set up the publication",
        description:
          "Choose the publication identity, description, and web address. Explain who the newsletter serves and what readers will receive.",
        href: "https://substack.com/",
        linkLabel: "Start with Substack",
      },
      {
        title: "Prepare a welcome and first issue",
        description:
          "Write a short welcome, add a signup link to your website, and send a preview to your team. Check links, image descriptions, and mobile readability.",
      },
      {
        title: "Choose free or paid deliberately",
        description:
          "Start with the publishing model that fits your audience. If considering paid subscriptions, review platform and processing fees and make clear what subscribers receive.",
        href: "https://substack.com/going-paid",
        linkLabel: "Review paid publishing",
      },
    ],
    watchFor: [
      "A paid subscription is not automatically a charitable donation; describe the transaction accurately.",
      "Keep a current export of your publication and subscriber records, and honor unsubscribe requests.",
    ],
    sources: [
      { title: "Substack publishing", href: "https://substack.com/" },
      { title: "Paid publishing", href: "https://substack.com/going-paid" },
      {
        title: "Paid subscriptions and fees",
        href: "https://faq.substack.com/p/how-do-paid-subscriptions-on-substack",
      },
    ],
  },
  squarespace: {
    outcome:
      "Publish a maintainable nonprofit website with clear program information and working contact and support paths.",
    preparation: [
      "Your domain details, logo, mission, program descriptions, contact information, and approved images.",
      "An owner for website updates and a list of required forms, donation links, and integrations.",
    ],
    steps: [
      {
        title: "Plan the essential pages",
        description:
          "Start with Home, About, Programs, Get involved, and Contact. Give each page one useful next action and identify who will maintain it.",
        href: "https://support.squarespace.com/hc/en-us/articles/115015429248-Building-a-nonprofit-site",
        linkLabel: "Read the nonprofit website guide",
      },
      {
        title: "Build and test during the trial",
        description:
          "Choose a suitable template, add your content, and test navigation, mobile layouts, forms, and donation links before connecting your public domain.",
        href: "https://www.squarespace.com/",
        linkLabel: "Explore Squarespace",
      },
      {
        title: "Compare the full cost before publishing",
        description:
          "Review plan features, renewal pricing, domains, and payment fees. The official nonprofit guide lists NONPROFIT for 10% off the first payment; confirm it at checkout.",
        href: "https://www.squarespace.com/pricing",
        linkLabel: "Compare website plans",
      },
    ],
    watchFor: [
      "The nonprofit code applies to the first payment, not every renewal.",
      "Website hosting, domain renewal, email services, and payment processing can be separate charges.",
    ],
    sources: [
      {
        title: "Building a nonprofit site and offer code",
        href: "https://support.squarespace.com/hc/en-us/articles/115015429248-Building-a-nonprofit-site",
      },
      { title: "Website plans", href: "https://www.squarespace.com/pricing" },
    ],
  },
}
