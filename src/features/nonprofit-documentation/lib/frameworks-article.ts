import type { BestPracticeArticle } from "../types"

export const FRAMEWORKS_ARTICLE: BestPracticeArticle = {
  slug: "best-practices/frameworks",
  navigationTitle: "Frameworks",
  title: "Use nonprofit frameworks to make assumptions visible and actionable",
  description:
    "A practical U.S. nonprofit guide to systems maps, theories of change, logic models, responsibility maps, learning cycles, and a free interactive logic-model workspace.",
  eyebrow: "Best practices · Frameworks",
  answer:
    "A nonprofit framework is a structured way to examine a decision, organize shared thinking, expose assumptions, and connect strategy to action. Choose the framework for the question you need to answer, build it with people closest to the work, and revise it when evidence or context changes.",
  readingTime: "16 minute read",
  reviewedDate: "September 2, 2026",
  publishedDate: "2026-09-02",
  modifiedDate: "2026-09-02",
  labels: {
    definition: "What a useful nonprofit framework does",
    stages: "Use frameworks differently as the organization develops",
    example: "Fictional example",
    framework: "A connected five-framework practice",
    checklist: "Framework quality checklist",
    mistakes: "Common framework failures",
    measures: "Evidence that a framework is helping",
  },
  definition:
    "A framework is a bounded representation that helps a group ask consistent questions and make a decision. A systems map explores context and relationships. A theory of change explains how and why actions are expected to contribute to change. A logic model organizes resources, activities, direct outputs, and sequenced outcomes. A responsibility map clarifies ownership and participation. A learning cycle turns uncertainty into questions, evidence, interpretation, and adaptation. These tools can connect, but they are not interchangeable and none proves that a program works.",
  whyItMatters: [
    "A shared model lets staff, participants, board members, partners, funders, and evaluators identify where they agree, where definitions differ, and which links remain assumptions.",
    "Separating resources, activities, outputs, outcomes, and longer-term contribution prevents delivery volume from being presented as community change.",
    "Naming context and assumptions makes a program easier to pilot, measure, challenge, and adapt without pretending the organization controls every condition around it.",
    "Choosing a framework by decision need reduces template theater: the team can use the smallest useful tool, keep a record, and stop when the decision is clear enough to act.",
  ],
  importantNote:
    "A framework documents a current hypothesis or operating agreement. It does not establish causality, effectiveness, feasibility, community consent, or impact. Those require proportionate evidence, interpretation, and continued review.",
  stages: [
    {
      id: "exploring",
      label: "Exploring",
      question: "What needs to be understood before choosing a solution?",
      guidance:
        "Start with the need, people affected, history, existing efforts, system conditions, and limits of the organization’s perspective. A systems map and early theory of change can keep a promising idea from becoming an untested program assumption.",
      actions: [
        "Invite people closest to the issue to identify conditions, actors, relationships, assets, exclusions, prior efforts, and unanswered questions.",
        "Draft several possible change pathways instead of treating the first intervention idea as inevitable.",
        "Mark what comes from community input, lived experience, research, administrative data, organizational belief, or an unresolved question.",
      ],
      checkpoint:
        "You can describe the need and context without collapsing them into your proposed service, and you know whose perspective is still missing.",
    },
    {
      id: "forming",
      label: "Forming",
      question: "Can the organization explain how the program should work?",
      guidance:
        "Connect the need statement, mission, theory of change, program design, resources, responsibilities, and early evidence. Keep the model specific enough to guide a pilot and flexible enough to revise.",
      actions: [
        "Write an If, Then, So That theory of change with explicit assumptions and alternative explanations.",
        "Build a one-page logic model that distinguishes inputs, participant experience, outputs, and near-, intermediate-, and long-term outcomes.",
        "Assign an owner to the model and to each critical delivery, approval, evidence, and learning decision.",
      ],
      checkpoint:
        "The pathway is understandable, resources and responsibilities are plausible, assumptions are visible, and a small pilot could test at least one uncertain link.",
    },
    {
      id: "operating",
      label: "Operating",
      question: "Does the working model match actual delivery and learning?",
      guidance:
        "Use the framework as an operating reference rather than a proposal artifact. Compare planned activities and outputs with what happened, then interpret outcomes and access conditions with participants and partners.",
      actions: [
        "Review the model alongside budgets, staffing, schedules, program records, participant experience, outcome evidence, and unexpected effects.",
        "Define terms, data sources, owners, timing, disaggregation, evidence limits, and decisions before collecting additional information.",
        "Record what changed in the program or model, why it changed, whose input shaped the decision, and what will be reviewed next.",
      ],
      checkpoint:
        "The team can distinguish implementation from outcomes, explain significant variance, and show how evidence changed or confirmed a decision.",
    },
    {
      id: "growing",
      label: "Growing",
      question:
        "Can multiple teams use and challenge the frameworks consistently?",
      guidance:
        "Growth requires shared definitions, model ownership, version history, evidence governance, and room for program-specific context. Scaling a diagram without testing capacity, fidelity, access, and external conditions can scale the wrong thing.",
      actions: [
        "Maintain a portfolio view that connects organization-level strategy with distinct program models, responsibilities, evidence, and risks.",
        "Set review triggers for major context shifts, new evidence, participant harm or exclusion, program changes, staffing changes, and expansion decisions.",
        "Compare sites or programs without erasing differences in people, place, implementation, resources, access, or evidence quality.",
      ],
      checkpoint:
        "Each model has an owner, purpose, scope, definitions, evidence state, revision history, decision use, and a clear relationship to other organizational models.",
    },
  ],
  example: {
    name: "Illustrative example: Willow Street Family Resource Network",
    context:
      "A fictional nonprofit is considering neighborhood legal-navigation appointments. Staff know residents face housing and public-benefits questions, but they have not yet tested whether unclear information, limited trusted referrals, appointment supply, language access, or another condition is the most important barrier.",
    weakLabel: "Template-first model",
    weak: "If we hold workshops and appointments, then families will become stable and the community will thrive.",
    strongLabel: "Testable working pathway",
    strong:
      "If trained navigators and trusted partners provide accessible eligibility information, referrals, and appointments, then participating residents may better understand options and complete appropriate next steps. Over time, this may contribute to more timely problem resolution if appointment capacity, language access, referral quality, and available legal or public-benefit remedies are sufficient.",
    reason:
      "The working pathway names participants, activities, near-term change, longer-term contribution, and conditions that may break the sequence. It avoids promising legal results and creates questions the pilot can examine.",
  },
  framework: [
    {
      title: "Map the system",
      instruction:
        "Describe the need in context: people, history, assets, actors, relationships, policies, incentives, constraints, feedback, prior efforts, and forces outside program control.",
      prompt:
        "What shapes this issue, whose perspective is represented, and where could our map be wrong?",
    },
    {
      title: "State the theory of change",
      instruction:
        "Explain the proposed causal pathway in plain language. Use If, Then, So That, add a Because statement, and identify conditions required for the pathway to hold.",
      prompt:
        "If we do what with whom, then what may change, so that what becomes possible—and why?",
    },
    {
      title: "Build the logic model",
      instruction:
        "Connect available inputs to activities, direct outputs, sequenced outcomes, longer-term contribution, contextual factors, and evidence questions.",
      prompt:
        "What do we invest, what do people experience, what is produced, and who or what should change over time?",
    },
    {
      title: "Map responsibility",
      instruction:
        "For each critical deliverable and decision, identify one accountable owner, the people completing work, required contributors, approval authority, and people needing information.",
      prompt:
        "Who owns the result, who decides, who contributes, who does the work, and who must know?",
    },
    {
      title: "Run the learning cycle",
      instruction:
        "Select uncertain links, define questions and feasible evidence, interpret findings with people affected, decide what changes, and version the model.",
      prompt:
        "What evidence would strengthen, weaken, or change this decision, and who will use it?",
    },
  ],
  checklist: [
    "The framework has one named decision, audience, scope, owner, version, and review date.",
    "People affected by the work have a meaningful way to shape, question, correct, or decline participation in the model-building process.",
    "The need is described separately from the organization’s proposed program or preferred solution.",
    "Inputs, activities, direct outputs, near-term outcomes, intermediate outcomes, and long-term contribution use distinct definitions.",
    "Every arrow or causal link can be explained in words and has assumptions, alternative explanations, and relevant contextual factors.",
    "Outcome statements identify who or what changes, the direction of change, and an appropriate timeframe without promising attribution the program cannot establish.",
    "Evidence sources, definitions, ownership, timing, access, privacy, limitations, and intended decisions are proportionate to the question.",
    "Responsibilities identify a clear owner while preserving participant voice, appropriate governance, and subject-matter review.",
    "The model records uncertainty, disagreement, missing perspectives, risks, and possible unintended or unequal effects.",
    "The team has defined when the framework will be reviewed, revised, archived, or retired.",
  ],
  mistakes: [
    {
      mistake:
        "Choosing a framework because a funder or template uses the name.",
      correction:
        "First name the decision or question. Then use the smallest framework that helps the intended users make that decision, while meeting any required format separately.",
    },
    {
      mistake: "Building the model alone and presenting it as shared truth.",
      correction:
        "Document authorship and limits, involve people closest to the work, preserve disagreement, and create a correction and revision process.",
    },
    {
      mistake: "Treating outputs as outcomes.",
      correction:
        "Outputs are direct products of activities, such as sessions or referrals. Outcomes are changes for people, organizations, relationships, practices, or conditions.",
    },
    {
      mistake: "Using arrows without explaining what makes the link plausible.",
      correction:
        "For every important link, state the mechanism, assumptions, evidence, dependencies, competing explanations, and conditions outside program control.",
    },
    {
      mistake: "Making a one-way model for complex or adaptive work.",
      correction:
        "Use a simple model for communication, then record feedback, context, iteration, and uncertainty in the narrative and learning process.",
    },
    {
      mistake: "Polishing the diagram instead of using it.",
      correction:
        "Review the model with delivery, budget, responsibility, and evidence records. Version it when decisions, activities, definitions, or context change.",
    },
  ],
  measuresIntroduction:
    "Judge a framework by whether it improves shared understanding and decisions, not by visual complexity or completion. Keep framework use distinct from evidence of program outcomes.",
  measures: [
    "Shared language: intended users can explain key terms, distinctions, causal links, assumptions, and uncertainties consistently enough to work together.",
    "Decision use: the framework is referenced in a documented program, budget, responsibility, measurement, partnership, or adaptation decision.",
    "Perspective quality: affected people and relevant partners can see how their input, disagreement, and corrections changed the model or why it did not.",
    "Pathway integrity: activities, outputs, outcomes, timing, resources, and responsibilities remain aligned in actual operations rather than only in the diagram.",
    "Learning use: evidence is connected to a focused question and results in a recorded confirmation, revision, pause, test, or stop decision.",
    "Model stewardship: owners, versions, review dates, definitions, evidence states, and changes remain current and accessible to intended users.",
  ],
  sources: [
    {
      title: "Coach House Accelerator",
      publisher: "Coach House",
      url: "https://coachhouse.app/accelerator",
      note: "The internal sequence behind this guide: Need Statement alignment, If-Then-So That Theory of Change, Systems Thinking reflection, explicit assumptions, and program piloting.",
    },
    {
      title: "Step 2 — Describe the Program",
      publisher: "Centers for Disease Control and Prevention",
      url: "https://www.cdc.gov/evaluation/php/evaluation-framework-action-guide/step-2-describe-the-program.html",
      note: "Current guidance on logic models, program narratives, inputs, activities, sequenced outcomes, context, and collaborative development.",
    },
    {
      title: "CDC Program Evaluation Framework",
      publisher: "Centers for Disease Control and Prevention",
      url: "https://www.cdc.gov/evaluation/php/evaluation-framework/index.html",
      note: "A practical, nonprescriptive evaluation framework organized around context, program description, questions, evidence, conclusions, and action.",
    },
    {
      title: "Step 4 — Gather Credible Evidence",
      publisher: "Centers for Disease Control and Prevention",
      url: "https://www.cdc.gov/evaluation/php/evaluation-framework-action-guide/step-4-gather-credible-evidence.html",
      note: "Guidance for connecting logic-model activities and outcomes to defined indicators and feasible qualitative or quantitative measures.",
    },
    {
      title: "Evidence Readiness Resources",
      publisher: "AmeriCorps",
      url: "https://www.americorps.gov/grantees-sponsors/evaluation-resources",
      note: "Federal training and templates for logic models, evaluation readiness, research questions, data culture, capacity, sustainability, and scaling.",
    },
    {
      title: "Developing a Logic Model",
      publisher: "AmeriCorps",
      url: "https://americorps.gov/sites/default/files/document/Logic%20Model%20Slides_final.pdf",
      note: "A training resource defining inputs, activities, outputs, and short-, medium-, and long-term outcomes.",
    },
    {
      title: "Logic Model Toolkit for Charter School Programs",
      publisher: "National Charter School Resource Center, U.S. Department of Education",
      url: "https://charterschoolcenter.ed.gov/sites/default/files/upload/toolkits/Logic-Model-Toolkit-A-Resource-for-Current-and-Prospective-Grantees-of-Charter-School-Programs.pdf",
      note: "A worked planning guide connecting resources, activities, outputs, outcomes, assumptions, and evaluation. Its examples concern education grants.",
    },
    {
      title: "Tools and Training — Logic Model",
      publisher: "Minnesota Department of Health",
      url: "https://www.web.health.state.mn.us/communities/practice/resources/phqitoolbox/logicmodel.html",
      note: "State public-health guidance and examples describing logic models as maps of what a program does, why, what it expects, and how it will examine progress.",
    },
  ],
  disclaimer:
    "This educational guide and planning workspace do not determine program effectiveness, causal attribution, evaluation readiness, grant competitiveness, legal compliance, community agreement, or impact. Requirements vary by funder, program, population, evidence question, jurisdiction, and context. Review consequential models and claims with affected people and qualified program, evaluation, legal, financial, accessibility, privacy, and subject-matter professionals as appropriate.",
  previous: {
    title: "Marketing",
    href: "/documentation/best-practices/marketing",
  },
  next: {
    title: "Measuring impact",
    href: "/documentation/best-practices/measuring-impact",
  },
}
