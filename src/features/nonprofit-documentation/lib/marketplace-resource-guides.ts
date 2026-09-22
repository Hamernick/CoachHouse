import type { MarketplaceResourceGuide } from "../marketplace-types"
import { GOOGLE_AD_GRANTS_GUIDE } from "./google-ad-grants-guide"
import { MONKEYPOD_GUIDE } from "./marketplace-monkeypod"
import { PUBLISHING_GUIDES } from "./marketplace-publishing-guides"
import { SOCIAL_GUIDES } from "./marketplace-social-resources"
import { FUNDRAISING_GUIDES } from "./marketplace-fundraising-resources"

export const MARKETPLACE_RESOURCE_GUIDES: Record<
  string,
  MarketplaceResourceGuide
> = {
  monkeypod: MONKEYPOD_GUIDE,
  ...PUBLISHING_GUIDES,
  ...SOCIAL_GUIDES,
  ...FUNDRAISING_GUIDES,
  "google-ad-grants": GOOGLE_AD_GRANTS_GUIDE,
  "google-workspace-nonprofits": {
    outcome:
      "Give your team organization-owned email and files with a clear administrator and handoff process.",
    preparation: [
      "Your Google for Nonprofits approval, domain registrar access, and a list of team accounts.",
      "A record of where email and files live today, including anything that must be migrated.",
    ],
    steps: [
      {
        title: "Choose the nonprofit edition",
        description:
          "Compare the $0 nonprofit edition with paid editions against your actual requirements. Follow the Workspace activation route inside Google for Nonprofits.",
      },
      {
        title: "Prepare the email change",
        description:
          "Ask the person managing your domain to plan verification and mail routing. Pilot with a small group, preserve existing messages, and choose a migration window before changing records.",
      },
      {
        title: "Set up ownership and access",
        description:
          "Use named staff accounts, multi-factor authentication, and a second recovery administrator. Organize shared work by team; record how files and access transfer when someone leaves.",
      },
    ],
    watchFor: [
      "Domain registration, migrations, support services, and paid Workspace upgrades are separate costs.",
      "Do not create a second organizational Workspace account until you have checked whether one already exists.",
    ],
    sources: [
      {
        title: "Nonprofit editions and activation",
        href: "https://www.google.com/nonprofits/offerings/workspace/",
      },
    ],
  },
  "design-gigs-for-good": {
    outcome:
      "Find a relevant creative community and write a brief a designer can actually respond to.",
    preparation: [
      "The deliverable, audience, deadline, budget or compensation range, and one person who will approve the work.",
    ],
    steps: [
      {
        title: "Browse the board and community",
        description:
          "Read recent posts to understand the types of work shared. The website also links to a public Slack community for people working across design and social change.",
        href: "https://groups.google.com/g/design-gigs-for-good",
        linkLabel: "Browse the Google Groups board",
      },
      {
        title: "Write a concrete brief",
        description:
          "For example: a three-page campaign website, existing brand assets provided, mobile layouts required, a named decision-maker, and an agreed launch date. State the budget, location constraints, and application route.",
      },
      {
        title: "Follow the posting rules",
        description:
          "Use the board or community's current submission instructions. Discuss scope, compensation, revision rounds, file ownership, and handoff directly with the designer before starting.",
      },
    ],
    examples: [
      {
        title: "Need donated design support?",
        description:
          "Try Taproot Plus or Catchafire's eligible project access with a scoped request. Do not assume a designer on a free job board is offering unpaid work.",
      },
    ],
    watchFor: [
      "The board is a discovery channel. Availability and terms belong to each posting.",
      "Share a project brief publicly; keep private participant stories, donor records, and account credentials out of the post.",
    ],
    sources: [
      {
        title: "Design Gigs for Good website",
        href: "https://www.designgigsforgood.org/",
      },
      {
        title: "Public job board",
        href: "https://groups.google.com/g/design-gigs-for-good",
      },
    ],
  },
  "taproot-plus": {
    outcome:
      "Leave a volunteer engagement with a usable deliverable and a team member who knows how to maintain it.",
    preparation: [
      "One specific problem, an internal owner, relevant non-sensitive materials, and time to work with the volunteer.",
    ],
    steps: [
      {
        title: "Choose a call or a project",
        description:
          "Use a one-hour session to clarify the problem or review an approach. Choose a multi-week project when you already know the deliverable and can support the work.",
      },
      {
        title: "Create a profile and scope the request",
        description:
          "Sign up for Taproot Plus, describe your organization, and use its project templates or pro bono menu. Name what is included, what is out of scope, and who approves the result.",
      },
      {
        title: "Plan the handoff at the start",
        description:
          "Agree on check-ins, working files, access, and a final walkthrough. Ask for editable source files and maintenance notes, then revoke temporary access when the project is done.",
      },
    ],
    examples: [
      {
        title: "Campaign design request",
        description:
          "Ask for a reusable donation campaign template and three sample social posts using existing copy and brand assets. Your team owns approvals and publishing.",
      },
    ],
    watchFor: [
      "Free professional time still requires preparation and review from your team. Matching is not a guarantee of immediate availability.",
    ],
    sources: [
      {
        title: "Taproot Plus eligibility and formats",
        href: "https://taprootfoundation.org/taproot-plus",
      },
      {
        title: "Design and creative project examples",
        href: "https://taprootfoundation.org/design-creative",
      },
    ],
  },
  "catchafire-resource-bank": {
    outcome:
      "Build a short comparison list and identify the implementation work behind each option.",
    preparation: [
      "A specific workflow to improve, the people using it, and the tools you already pay for.",
    ],
    steps: [
      {
        title: "Search by the job you need done",
        description:
          "Browse the resource database for one need, such as donation forms or email campaigns. Pick two or three options to investigate.",
      },
      {
        title: "Confirm the offer at its source",
        description:
          "Open each provider's current pricing and nonprofit terms. Record seat limits, processing fees, eligibility, and renewal cost alongside the headline discount.",
      },
      {
        title: "Find help with implementation",
        description:
          "Look at the related Catchafire projects. If your organization has access, a scoped project can help configure or migrate the tool; otherwise check the current membership application path.",
      },
    ],
    watchFor: [
      "This is a discovery bank. We have verified the bank itself, not every product or claim inside it.",
    ],
    sources: [
      {
        title: "Catchafire resource database",
        href: "https://www.catchafire.org/nonprofitresources/",
      },
      {
        title: "Current membership pathways",
        href: "https://help.catchafire.org/en/articles/8380963-what-is-catchafire-and-how-do-i-join",
      },
    ],
  },
  catchafire: {
    outcome:
      "Turn a capacity gap into a defined project with a skilled volunteer.",
    preparation: [
      "Your funder's invitation, if you have one, and a named project owner.",
    ],
    steps: [
      {
        title: "Check your access path",
        description:
          "Use your foundation's invitation, or apply for a free membership through the form linked in Catchafire's help article. Unsponsored access depends on openings.",
      },
      {
        title: "Start with a scoped request",
        description:
          "Choose a ready-to-use project or a one-hour call. Gather the requested materials before posting, and describe the decision or deliverable you need.",
      },
      {
        title: "Agree on completion",
        description:
          "Set a review schedule and define what your team must be able to do after handoff. Keep access limited to what the volunteer needs.",
      },
    ],
    watchFor: [
      "Catchafire currently says it does not offer paid memberships. A free-membership application does not guarantee an immediate place.",
    ],
    sources: [
      {
        title: "How organizations join Catchafire",
        href: "https://help.catchafire.org/en/articles/8380963-what-is-catchafire-and-how-do-i-join",
      },
    ],
  },
  "techsoup-digital-assessment": {
    outcome:
      "Choose one technology improvement that supports your mission and has an owner.",
    preparation: [
      "A teammate who understands operations and an inventory of current software, costs, and recurring frustrations.",
    ],
    steps: [
      {
        title: "Create an assessment account",
        description:
          "Sign up for the Digital Assessment Tool, verify your email, and complete the organization profile. This account is separate from a TechSoup marketplace account.",
      },
      {
        title: "Answer with the people doing the work",
        description:
          "Complete the introductory assessment and invite relevant teammates. Use actual workflows and limitations rather than guessing what a policy says.",
      },
      {
        title: "Turn findings into one experiment",
        description:
          "Select a priority, assign an owner, and define a small improvement to try. Reassess after the change; use the score as a discussion aid rather than a procurement decision.",
      },
    ],
    watchFor: [
      "A recommendation can involve paid products. Check fit and costs before committing.",
    ],
    sources: [
      {
        title: "TechSoup assessment and account FAQ",
        href: "https://assessment.techsoup.org/",
      },
    ],
  },
  "adobe-express-nonprofits": {
    outcome:
      "Create a reusable set of campaign graphics your team can update without starting over.",
    preparation: [
      "Nonprofit verification information, existing brand assets, approved campaign copy, and the channels you use.",
    ],
    steps: [
      {
        title: "Apply for nonprofit access",
        description:
          "Follow Adobe's nonprofit application and confirm the current license allocation and renewal terms before inviting your team.",
      },
      {
        title: "Build a small template set",
        description:
          "Create a social post, flyer, and presentation cover using the same type, colors, and message. Check readability at phone size and leave room for captions or translations.",
      },
      {
        title: "Hand off a repeatable workflow",
        description:
          "Name the templates clearly, agree on who approves copy and images, and export one real campaign asset to test the process.",
      },
    ],
    watchFor: [
      "Express Premium access does not include every Adobe product or every stock-content license. Verify asset usage rights for your intended publication.",
    ],
    sources: [
      {
        title: "Adobe Express nonprofit offer",
        href: "https://www.adobe.com/nonprofits/express.html",
      },
    ],
  },
  "asana-nonprofits": {
    outcome: "Make one recurring program or campaign easier to coordinate.",
    preparation: [
      "A list of users, a real project with deadlines, and the features you need beyond a free task list.",
    ],
    steps: [
      {
        title: "Check the total subscription cost",
        description:
          "Compare eligible Starter and Advanced plans with your current tools. Count required seats and confirm monthly or annual billing.",
      },
      {
        title: "Apply before upgrading",
        description:
          "Use Asana's nonprofit verification route and follow the approval instructions to apply the discount. Check the final subscription price before purchase.",
      },
      {
        title: "Pilot one workflow",
        description:
          "Add owners, due dates, and dependencies for one campaign. Review it with the team each week before moving every organizational process into the system.",
      },
    ],
    watchFor: [
      "A 50% discount still means a paid plan. Unused seats and parallel tools can outweigh the savings.",
    ],
    sources: [
      {
        title: "Asana nonprofit offer and application",
        href: "https://asana.com/industry/nonprofit",
      },
      {
        title: "Asana nonprofit support",
        href: "https://help.asana.com/s/article/asana-for-nonprofits",
      },
    ],
  },
  trustlaw: {
    outcome:
      "Prepare a clear request for qualified legal help with an organizational matter.",
    preparation: [
      "Registration details, evidence of your social mission and operations, the relevant jurisdiction, and any actual deadline.",
    ],
    steps: [
      {
        title: "Check membership criteria",
        description:
          "Read TrustLaw's current eligibility document and apply if your organization meets it. The service is for qualifying organizations; it is not a general personal legal helpline.",
      },
      {
        title: "Scope the legal question",
        description:
          "Describe the facts, jurisdiction, desired outcome, and deadline. TrustLaw helps members turn a request into a project for its legal network.",
      },
      {
        title: "Confirm the engagement",
        description:
          "Review the offers with TrustLaw and the legal team. Agree on scope, confidentiality, timing, and any external expenses before sharing sensitive files.",
      },
    ],
    watchFor: [
      "Do not rely on a pending volunteer match for an urgent filing, hearing, or statutory deadline. Seek available counsel in the relevant jurisdiction.",
    ],
    sources: [
      { title: "TrustLaw service", href: "https://www.trust.org/trustlaw/" },
      {
        title: "Membership eligibility",
        href: "https://www.trust.org/documents/TrustLaw_Eligibility_Criteria_New.pdf",
      },
    ],
  },
}
