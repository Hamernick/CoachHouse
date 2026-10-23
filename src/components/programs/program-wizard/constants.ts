import type { StepMeta } from "./types"

export const STEPS: StepMeta[] = [
  {
    title: "Choose activity type",
    helper: "Pick the category that best matches the work you want to add.",
  },
  {
    title: "Resource name",
    helper: "Give this work a clear name and one-sentence summary.",
  },
  {
    title: "Focus + format",
    helper: "Choose the public-benefit focus and how people experience it.",
  },
  {
    title: "Audience + outcomes",
    helper: "Describe the participant experience and what changes.",
  },
  {
    title: "Pilot size + staffing",
    helper: "How many people, and who will run it?",
  },
  {
    title: "When + where",
    helper: "Set cadence, start month, and delivery location.",
  },
  {
    title: "Budget + feasibility",
    helper: "Estimate cost and capacity as you type.",
  },
  {
    title: "Review + save",
    helper: "Review a concise activity brief for your team and funders.",
  },
]

export const DRAFT_STORAGE_KEY = "coach-house:program-wizard-draft:v1"
