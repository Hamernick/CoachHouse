import type { BestPracticeArticle } from "../types"

export const NETWORKING_ARTICLE: BestPracticeArticle = {
  slug: "tools/networking",
  navigationTitle: "Networking",
  title: "Build a nonprofit network that moves work responsibly",
  description:
    "A U.S.-wide, stage-specific nonprofit networking guide and device-local relationship-map tool for reciprocal, community-accountable follow-through.",
  eyebrow: "Tools · Networking",
  answer:
    "Effective nonprofit networking is a repeatable relationship practice: begin with a defined mission purpose, listen to people closest to the issue, map the roles the work needs, offer reciprocal value, make a bounded invitation, follow through, and learn. A contact list can support this work, but it does not prove trust, representation, access, influence, or partnership.",
  readingTime: "19 minute read",
  reviewedDate: "September 2, 2026",
  publishedDate: "2026-09-02",
  modifiedDate: "2026-09-02",
  labels: {
    definition: "What nonprofit networking includes",
    stages: "Build the relationship system your stage needs",
    example: "Fictional worked example",
    framework: "A seven-part relationship loop",
    checklist: "Conversation and follow-through checklist",
    mistakes: "Common networking mistakes",
    measures: "Evidence for learning",
  },
  definition:
    "Nonprofit networking is the intentional practice of listening, learning, exchanging value, making introductions, coordinating next steps, maintaining relationships, and closing loops around a charitable purpose. A contact is a possible point of connection. A relationship develops through repeated, trustworthy interaction. A referral is a bounded handoff. A partnership adds shared work and governance. A coalition coordinates multiple parties. A fundraising or advocacy conversation has its own authority, disclosure, tax, reporting, and ethical considerations. Calling every connection a partner obscures these differences.",
  whyItMatters: [
    "People affected by an issue often hold essential knowledge, relationships, history, and solutions that an institution-centered map will miss.",
    "Reliable referrals, funding conversations, volunteer pathways, policy education, peer learning, and collaboration all depend on fit, context, capacity, trust, and follow-through—not a one-time exchange of contact information.",
    "Reciprocity protects against extractive outreach. A useful relationship makes the nonprofit's purpose and limits clear while respecting what the other party values, knows, risks, and chooses.",
    "Accessible meeting formats, language access, compensation, scheduling, technology, transportation, and clear materials determine who can participate and influence decisions.",
    "Relationship notes can contain personal, political, health, safety, financial, or other sensitive information. Collect only what the organization needs, protect it, limit access, and set retention and deletion rules.",
    "A distributed relationship system is more resilient than one executive's private network. Shared context, ownership, boundaries, and succession protect commitments when people change roles.",
  ],
  importantNote:
    "Networking does not create authority, consent, endorsement, representation, confidentiality, referral capacity, a partnership, or a right to use someone's name or information. Review current federal, state, Tribal, territorial, local, professional, funding, and organizational requirements when conversations involve lobbying, candidates, fundraising, procurement, gifts, conflicts, personal data, regulated services, media, or formal commitments.",
  stages: [
    {
      id: "exploring",
      label: "Exploring",
      question: "Who understands the issue, and what should we learn first?",
      guidance:
        "Start with a learning purpose, not a request for support. Map people affected by the issue, informal leaders, existing organizations, public systems, service providers, critics, and overlooked assets. Ask how people want to participate and what previous outreach or commitments shape the context.",
      actions: [
        "Name one bounded issue, geography or community, decision, and learning question before listing contacts.",
        "Identify people closest to the issue and the access, language, compensation, safety, and power conditions needed for meaningful participation.",
        "Inventory existing trusted relationships and previous promises before approaching new institutions or influential people.",
        "Request a short listening conversation with a clear purpose, realistic time, voluntary participation, and no implied commitment.",
      ],
      checkpoint:
        "The team can explain what it needs to learn, whose knowledge is essential, how participation will influence the work, what it can responsibly offer, and how it will follow up even when no opportunity results.",
    },
    {
      id: "forming",
      label: "Forming",
      question: "Can we turn conversations into a responsible system?",
      guidance:
        "Build a small relationship map organized by mission function rather than prestige. Prepare a conversation brief, assign an owner, record minimum necessary institutional context, and distinguish listening, learning, exchange, coordination, and collaboration. Make specific invitations people can accept, revise, or decline.",
      actions: [
        "Map community, peer, public, funding, professional, advocacy, media, and other locally relevant roles without assuming each category must be filled.",
        "For each active relationship, state the purpose, relevant context, responsible offer, next step, owner, and review timing.",
        "Create accessible outreach, meeting, note, permission, introduction, follow-up, conflict, gift, and escalation practices.",
        "Choose one shared record appropriate to the information and train owners to separate verified facts, commitments, observations, and assumptions.",
      ],
      checkpoint:
        "A reviewer can trace each planned conversation to a mission purpose, community need, reciprocal value, bounded invitation, access plan, data boundary, responsible owner, and promised follow-up.",
    },
    {
      id: "operating",
      label: "Operating",
      question: "Do relationships lead to reliable, reciprocal follow-through?",
      guidance:
        "Use a consistent prepare-converse-record-follow-up-review rhythm. Confirm capacity before referrals or introductions, ask permission before sharing names or details, close promised loops, and give useful updates even when there is no progress. Treat a decline or lack of fit as information rather than a failed relationship.",
      actions: [
        "Prepare current context, questions, organizational boundaries, authority, conflicts, and the specific decision or invitation before each conversation.",
        "Listen for priorities, constraints, language, timing, access, capacity, risks, alternatives, and what a responsible exchange could look like.",
        "Send an accurate follow-up with commitments, owners, dates, unresolved questions, consented introductions, and an easy correction or decline path.",
        "Review open loops, dormant commitments, referral quality, repeated requests, access barriers, staff load, and relationships that need repair, transition, or closure.",
      ],
      checkpoint:
        "The organization can show what it promised, what it completed, what it learned, whose input changed a decision, where capacity or access failed, and which relationships to maintain, deepen, pause, repair, transfer, or close.",
    },
    {
      id: "growing",
      label: "Growing",
      question:
        "How can the network grow without concentrating power or losing trust?",
      guidance:
        "Expansion changes who represents the organization, what can be promised, how information moves, and whose relationships are visible. Distribute ownership, document institutional context, support local leadership, compensate community expertise where appropriate, and revalidate privacy, conflicts, lobbying, political, procurement, fundraising, and brand boundaries.",
      actions: [
        "Create role-based relationship ownership, backups, transition notes, access controls, retention rules, and offboarding for staff, board members, volunteers, and contractors.",
        "Define which invitations, introductions, referrals, public statements, funding requests, policy contacts, gifts, and agreements require additional authority or review.",
        "Compare representation, participation, follow-through, reciprocity, access, capacity, and decision influence across locations or teams without ranking people by perceived power.",
        "Invest in relationships between community members and institutions—not only relationships routed through the nonprofit—and plan for responsible transfer or closure.",
      ],
      checkpoint:
        "The growing network has distributed ownership, current records, community influence, accessible participation, clear authority, protected information, conflict and tax review where needed, succession coverage, and evidence of closed loops.",
    },
  ],
  example: {
    name: "Willow Street Family Resource Network",
    context:
      "This fictional operating nonprofit offers bilingual benefits navigation in three ZIP codes. Residents report that referrals sometimes reach organizations whose eligibility, language access, or appointment capacity has changed. Willow Street wants to improve the referral pathway without claiming to represent residents or asking partners to promise capacity they do not have.",
    weakLabel: "Weak outreach",
    weak: "We are building a powerful coalition and would love to partner. Please send your contacts, promote our program, and let us know what resources you can provide.",
    strongLabel: "Stronger working invitation",
    strong:
      "Willow Street is reviewing how adults in three service ZIP codes find current housing and public-benefits help. Would your intake or community-access lead be open to a 30-minute listening conversation during the next three weeks? We want to understand current fit, eligibility, language access, capacity updates, and referral feedback. We can share the themes we hear and our current navigation pathway; this conversation creates no referral or partnership commitment. English and Spanish materials, remote or accessible in-person options, and compensation for resident advisors are available.",
    reason:
      "The stronger invitation names the purpose, relevant role, questions, timing, reciprocal offer, access options, and limit. The team would still need to confirm the recipient, authority, accommodations, note and sharing boundaries, follow-up owner, and whether any referral, data, funding, advocacy, or partnership review becomes necessary.",
  },
  framework: [
    {
      title: "1. Define the purpose before the people",
      instruction:
        "State the issue, community, decision, desired learning or action, time horizon, and limits. Networking should serve a real mission need rather than an abstract goal to meet influential people.",
      prompt:
        "What decision or mission result should better relationships improve, and what cannot be solved by networking alone?",
    },
    {
      title: "2. Begin with community knowledge and existing assets",
      instruction:
        "Identify people affected, informal leaders, existing relationships, local history, previous commitments, critics, and community-controlled assets. Decide how participation can influence the work and what access or compensation is needed.",
      prompt:
        "Whose knowledge is essential, who is usually overlooked, and how will the organization close the loop with them?",
    },
    {
      title: "3. Map roles, not prestige",
      instruction:
        "Map the functions the purpose requires: lived and local knowledge, service capacity, referrals, peer learning, public authority, funding, technical skill, advocacy, communication, and accountability. Use organization- or role-level labels when personal detail is unnecessary.",
      prompt:
        "Which perspectives, capabilities, and constraints are represented, missing, duplicated, or over-relied upon?",
    },
    {
      title: "4. Prepare a reciprocal, bounded invitation",
      instruction:
        "Explain why this person or role is relevant, what you hope to learn or do, what you can responsibly offer, the time and format, and what the conversation does not commit either party to do.",
      prompt:
        "Why them, why now, what value can flow both ways, and can they comfortably revise or decline the invitation?",
    },
    {
      title: "5. Make the conversation accessible and useful",
      instruction:
        "Offer relevant communication formats, language access, accommodations, clear materials, timing, location, technology, compensation, and facilitation. Listen for context and constraints before presenting a solution or request.",
      prompt:
        "What would let each participant understand, contribute, question, and influence the conversation?",
    },
    {
      title: "6. Follow through and record only what is needed",
      instruction:
        "Confirm commitments, owners, dates, open questions, introductions, and the next review. Separate facts, permission, commitments, and assumptions; limit access and retention; do not turn sensitive conversation notes into informal personal profiles.",
      prompt:
        "What was promised, what may be shared, who owns the next step, and when will the loop close?",
    },
    {
      title: "7. Review relationship health through behavior",
      instruction:
        "Examine follow-through, reciprocity, access, community influence, referral quality, capacity, learning, repair, transitions, and closed loops. Do not infer trust, equity, or representation from contact volume, meeting count, title, or proximity to power.",
      prompt:
        "What changed because of the relationship, what remains unverified, and should the team maintain, deepen, repair, pause, transfer, or close it?",
    },
  ],
  checklist: [
    "The mission purpose, community or geography, decision, objective, review period, owner, and limits are explicit.",
    "People affected by the work can shape priorities, the relationship map, invitations, decisions, interpretation, and follow-up through an accessible and appropriately supported process.",
    "Existing relationships, community assets, history, previous promises, concerns, critics, and gaps are documented before new outreach begins.",
    "Each mapped organization or role has a clear category, current engagement mode, purpose, relevant context, responsible offer, next step, owner, and review timing.",
    "Outreach explains why the recipient is relevant, what is being requested, expected time, format, access options, reciprocal value, and the absence of implied commitment.",
    "Meeting preparation covers current facts, questions, authority, organizational limits, conflicts, gifts, funding, lobbying, political activity, confidentiality, safety, and escalation where relevant.",
    "Communication formats, language access, disability access, scheduling, technology, transportation, compensation, childcare, and other participation needs are addressed proportionately.",
    "Names, contact details, notes, introductions, and sensitive information are collected only when needed, with appropriate notice or permission, access, security, correction, retention, and deletion practices.",
    "No person's name, quotation, logo, relationship, attendance, introduction, or association is presented as endorsement, representation, consent, capacity, or partnership without confirmation.",
    "Referrals and introductions confirm fit, current capacity, permission, information boundaries, handoff responsibility, feedback, and what happens when the receiving party cannot help.",
    "Follow-up accurately records commitments, owners, dates, unresolved questions, declines, corrections, and the next review; routine updates continue even when there is no progress.",
    "The review results in a documented maintain, deepen, repair, pause, transfer, close, or formalize decision with evidence, limitations, owner, and next date.",
  ],
  mistakes: [
    {
      mistake: "Starting with influential names instead of a mission purpose.",
      correction:
        "Define the decision, community, needed roles, and learning question first; influence does not substitute for fit, accountability, or trust.",
    },
    {
      mistake: "Treating people affected by the work as one stakeholder box.",
      correction:
        "Recognize different experiences, interests, access needs, risks, assets, and forms of leadership; create real decision influence and close feedback loops.",
    },
    {
      mistake: "Opening with a broad request to partner.",
      correction:
        "Make a bounded listening or learning invitation and distinguish it from a referral, promotion, funding request, joint activity, or formal partnership.",
    },
    {
      mistake: "Asking for contacts or introductions without context.",
      correction:
        "Explain purpose, relevance, privacy, and the intended handoff; ask permission before sharing a name, contact detail, or sensitive context.",
    },
    {
      mistake:
        "Capturing every personal detail in a shared spreadsheet or CRM.",
      correction:
        "Store the minimum institutional context needed, protect access, separate sensitive records, set retention, and avoid unverified personal profiles or power scores.",
    },
    {
      mistake:
        "Promising referrals, recognition, funding, or decisions without authority.",
      correction:
        "State your role and limits, verify capacity, route commitments to authorized review, and correct misunderstandings quickly.",
    },
    {
      mistake: "Following up only when the organization needs something.",
      correction:
        "Close promised loops, share useful updates, acknowledge contributions, offer responsible value, and communicate changes or lack of progress.",
    },
    {
      mistake: "Reporting meetings and contact counts as network strength.",
      correction:
        "Examine follow-through, reciprocity, access, participation, community influence, referral quality, useful learning, repaired problems, and responsible closure.",
    },
  ],
  measuresIntroduction:
    "Use evidence about relationship behavior and mission contribution. Counts can describe activity or coverage, but they cannot establish trust, reciprocity, influence, representation, equity, consent, partnership quality, or community impact.",
  measures: [
    "Community influence: people affected by the issue help define priorities, correct assumptions, shape invitations, influence decisions, interpret learning, and receive accessible follow-up.",
    "Representation and gaps: relevant community, peer, public, funding, professional, advocacy, service, and accountability roles are visible without treating category coverage as legitimacy.",
    "Follow-through: commitments, introductions, referrals, updates, corrections, declines, and next steps have responsible owners and close within the agreed timing.",
    "Reciprocity: participants can name useful value, information, access, recognition, learning, resources, or support exchanged without hidden pressure or implied endorsement.",
    "Access and safety: language, disability, format, scheduling, technology, transportation, compensation, privacy, conflict, and safety barriers are identified and acted on.",
    "Mission use: relationships contribute to better understanding, referrals, services, participation, funding fit, talent, policy education, coordination, or another defined decision, with limitations stated.",
    "Resilience and learning: ownership is distributed, context survives transitions, relationship concentration and workload are visible, concerns can be repaired, and reviews lead to maintain, deepen, pause, transfer, close, or formalize decisions.",
  ],
  sources: [
    {
      title: "Coach House Accelerator",
      publisher: "Coach House",
      url: "https://coachhouse.app/accelerator",
      note: "The internal learning sequence behind this guide: stakeholder and audience mapping, relationship assets, fundraising mindset, introductions, referral pathways, reciprocal value, collaboration, ownership, and coaching review.",
    },
    {
      title: "Principles of Community Engagement, Third Edition",
      publisher: "CDC and Agency for Toxic Substances and Disease Registry",
      url: "https://stacks.cdc.gov/view/cdc/251390",
      note: "Current federal community-engagement reference covering trust, shared leadership and power, participatory decisions, communication, equity, benefits, capacity, evaluation, and sustained relationships.",
    },
    {
      title: "Identifying Allies",
      publisher: "Agency for Toxic Substances and Disease Registry",
      url: "https://www.atsdr.cdc.gov/community-engagement-playbook/php/activities/identifying-stakeholders.html",
      note: "Current playbook guidance for identifying community members, organizations, and government partners already connected to the issue and local context.",
    },
    {
      title:
        "Maintaining Collaboration and Communication with Community Partners",
      publisher: "Agency for Toxic Substances and Disease Registry",
      url: "https://www.atsdr.cdc.gov/community-engagement-playbook/php/activities/maintaining-collaboration.html",
      note: "Federal playbook guidance emphasizing continuing communication, listening, trust, reciprocity, empathy, exchange, role clarity, and adjustment from community input.",
    },
    {
      title: "Identifying and Analyzing Stakeholders and Their Interests",
      publisher: "University of Kansas Community Tool Box",
      url: "https://ctb.ku.edu/en/table-of-contents/participation/encouraging-involvement/identify-stakeholders/main",
      note: "Practical community-development guidance on people affected directly and indirectly, key stakeholders, varied interests, participatory process, and the limits of power-centered mapping.",
    },
    {
      title: "Building and Sustaining Relationships",
      publisher: "University of Kansas Community Tool Box",
      url: "https://ctb.ku.edu/en/table-of-contents/leadership/leadership-functions/build-sustain-relationships/main",
      note: "Practical guidance on one-to-one relationship building, listening, trust, integrity, time, maintenance, allies, conflict, and avoiding relationships formed only to extract work.",
    },
    {
      title: "Protecting Personal Information: A Guide for Business",
      publisher: "Federal Trade Commission",
      url: "https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business",
      note: "Plain-language federal guidance to inventory personal information, keep only what is needed, protect it, dispose of it securely, and prepare for incidents.",
    },
    {
      title: "ADA Requirements: Effective Communication",
      publisher: "U.S. Department of Justice",
      url: "https://www.ada.gov/resources/effective-communication/",
      note: "Federal guidance for covered nonprofits on effective communication with people who have communication disabilities and appropriate auxiliary aids and services.",
    },
    {
      title: "Lobbying",
      publisher: "Internal Revenue Service",
      url: "https://www.irs.gov/charities-non-profits/lobbying",
      note: "Current federal tax overview distinguishing lobbying from some public-policy education and explaining that section 501(c)(3) organizations may conduct some lobbying within applicable limits.",
    },
    {
      title:
        "Restriction of Political Campaign Intervention by Section 501(c)(3) Organizations",
      publisher: "Internal Revenue Service",
      url: "https://www.irs.gov/charities-non-profits/charitable-organizations/restriction-of-political-campaign-intervention-by-section-501c3-tax-exempt-organizations",
      note: "Current federal tax guidance on the prohibition against section 501(c)(3) participation or intervention for or against candidates for elective public office.",
    },
  ],
  disclaimer:
    "This educational guide and planning tool do not identify, verify, contact, rank, score, endorse, represent, introduce, refer, approve, or select a person or organization; establish trust, consent, authority, confidentiality, capacity, fit, access, community representation, a partnership, a coalition, a professional relationship, a funding relationship, or a legal duty; verify personal information, commitments, conflicts, gifts, procurement, lobbying, political activity, fundraising, professional boundaries, accessibility, privacy, security, or legal requirements; predict relationship strength, response, funding, referrals, participation, influence, policy results, or impact; or replace community decision-making and qualified legal, tax, privacy, security, accessibility, fundraising, advocacy, professional, safeguarding, program, governance, or board review. Requirements vary by organization, exemption, activity, role, relationship, communication, data, funding, profession, jurisdiction, and state.",
  previous: {
    title: "Social media",
    href: "/documentation/tools/social-media",
  },
  next: { title: "HR", href: "/documentation/tools/hr" },
}
