import { parseAssignmentFields } from "@/lib/modules/assignment"
import type { CompanionSnapshot } from "../types"

// Verbatim answer-field names and labels from supabase/seed.sql:1592-1755.
// Subtitle screens are omitted; they do not count toward assignment completion.
const questions = [
  ["mission_work_in_world", "What are you trying to do in the world?"],
  ["mission_main_activities", "What are the main activities or approaches you plan to use?"],
  ["mission_who_for", "Who are you doing this work for?"],
  ["mission_group_importance", "What makes this group important to focus on?"],
  ["mission_difference", "What difference does your work make in people's lives?"],
  ["mission_missing_without_work", "If your work did not exist, what would be missing?"],
  ["mission_success_3_years", "If your work is successful, what will be different 3-5 years from now?"],
  ["mission_unique_approach", "What is unique about how you approach this work?"],
  ["mission_effective_approach", "Why do you believe your approach will be effective?"],
  ["mission_pulling_together", "In your own words, describe what you do, for whom, and the difference it makes."],
  ["mission_final_statement", "Write or paste your preferred mission statement draft."],
] as const

export const companionAssignmentFields = parseAssignmentFields({
  fields: questions.map(([name, label]) => ({ name, label, type: "long_text", required: false })),
})

export const companionLesson: CompanionSnapshot["lesson"] = {
  id: "repository-mission",
  title: "Mission",
  description: "What difference are you making in the world?",
  href: "/accelerator/class/mission-vision-values/module/1",
  fields: companionAssignmentFields.map(({ name, label, required }) => ({ name, label, required })),
  completionMode: "all_answered",
  completeOnSubmit: true,
}

export const companionSource: CompanionSnapshot["source"] = {
  kind: "repository_fixture",
  label: "Repository curriculum fixture: supabase/seed.sql, Mission (base df8ffcc6). Published curriculum not verified.",
  verifiedAt: null,
}
