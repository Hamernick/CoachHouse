import { parseAssignmentFields } from "@/lib/modules/assignment"
import type { CompanionSnapshot } from "../types"
import publishedLesson from "./lesson-data.json"

// A bounded snapshot of verified published curriculum, not member data.
// Subtitle screens are omitted; they do not count toward assignment completion.
export const companionAssignmentFields = parseAssignmentFields({ fields: publishedLesson.fields })

export const companionLesson: CompanionSnapshot["lesson"] = {
  id: publishedLesson.id,
  title: publishedLesson.title,
  description: publishedLesson.description,
  href: `/accelerator/class/${publishedLesson.classSlug}/module/1`,
  fields: companionAssignmentFields.map(({ name, label, description, required }) => ({ name, label, description, required })),
  completionMode: "all_answered",
  completeOnSubmit: publishedLesson.completeOnSubmit,
}

export const companionSource: CompanionSnapshot["source"] = {
  kind: "published",
  label: `Published Coach House curriculum, captured ${publishedLesson.verifiedAt}. Practice answers and organization are fictional.`,
  verifiedAt: publishedLesson.verifiedAt,
}
