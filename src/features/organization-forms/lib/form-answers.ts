import { z } from "zod"
import type {
  FormSnapshot,
  FormSnapshotQuestion,
  FormVersion,
} from "./form-version"

export const FORM_ANSWER_LIMITS = {
  text: 2_000,
  paragraph: 10_000,
  email: 254,
  totalCharacters: 50_000,
} as const
const answerValueSchema = z.union([
  z.string().max(FORM_ANSWER_LIMITS.paragraph),
  z.number().finite(),
  z.array(z.string().max(64)).max(50),
])
export const formAnswersSchema = z
  .array(
    z.strictObject({
      questionId: z.uuid(),
      value: answerValueSchema,
    })
  )
  .max(50)
export const formSubmissionSchema = z.strictObject({
  id: z.uuid(),
  formId: z.uuid(),
  versionId: z.uuid(),
  answers: formAnswersSchema,
})
export type FormAnswer = z.infer<typeof formAnswersSchema>[number]
export type FormAnswerIssue = { questionId?: string; message: string }
type AnswerResult =
  | { ok: true; answers: FormAnswer[] }
  | { ok: false; issues: FormAnswerIssue[] }

/** Keep numeric drafts as free text until an explicit check/submit action. */
export function normalizeFormAnswerInputs(
  snapshot: FormSnapshot,
  answers: FormAnswer[]
): FormAnswer[] {
  return answers.map((answer) => {
    const question = snapshot.questions.find(
      (item) => item.id === answer.questionId
    )
    if (
      question?.type === "number" &&
      typeof answer.value === "string" &&
      /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(answer.value.trim())
    )
      return { ...answer, value: Number(answer.value.trim()) }
    return answer
  })
}

function validateValue(
  question: FormSnapshotQuestion,
  value: FormAnswer["value"]
): string | null {
  switch (question.type) {
    case "text":
    case "paragraph":
      return typeof value !== "string"
        ? "Enter text."
        : value.length > FORM_ANSWER_LIMITS[question.type]
          ? `Use ${FORM_ANSWER_LIMITS[question.type]} characters or fewer.`
          : null
    case "email":
      return typeof value === "string" &&
        value.length <= FORM_ANSWER_LIMITS.email &&
        z.email().safeParse(value.trim()).success
        ? null
        : "Enter a valid email address."
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? null
        : "Enter a number."
    case "single_choice":
      return typeof value === "string" &&
        question.options.some((option) => option.id === value)
        ? null
        : "Choose one of the available options."
    case "multiple_choice":
      return Array.isArray(value) &&
        new Set(value).size === value.length &&
        value.every((id) => question.options.some((option) => option.id === id))
        ? null
        : "Choose distinct available options."
  }
}

/** Shared preview/server validation. Does not authorize, accept or store a response. */
export function validateFormAnswers(
  snapshot: FormSnapshot,
  input: unknown
): AnswerResult {
  const parsed = formAnswersSchema.safeParse(input)
  if (!parsed.success)
    return {
      ok: false,
      issues: [
        {
          message: "Answers have an invalid format or exceed the form limits.",
        },
      ],
    }
  const answers = parsed.data
  const total = answers.reduce(
    (sum, answer) =>
      sum +
      (typeof answer.value === "string"
        ? answer.value.length
        : Array.isArray(answer.value)
          ? answer.value.join("").length
          : 0),
    0
  )
  if (total > FORM_ANSWER_LIMITS.totalCharacters)
    return {
      ok: false,
      issues: [{ message: "Answers exceed the total form limit." }],
    }
  const issues: FormAnswerIssue[] = []
  const submitted = new Map<string, FormAnswer>()
  const knownIds = new Set(snapshot.questions.map((question) => question.id))
  for (const answer of answers) {
    if (!knownIds.has(answer.questionId))
      issues.push({
        message: "An answer refers to a question outside this version.",
      })
    if (submitted.has(answer.questionId))
      issues.push({
        questionId: answer.questionId,
        message: "Answer each question only once.",
      })
    submitted.set(answer.questionId, answer)
  }
  const normalized: FormAnswer[] = []
  for (const question of snapshot.questions) {
    const answer = submitted.get(question.id)
    const value = answer?.value
    const empty =
      value === undefined ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0)
    if (empty) {
      // Empty arrays are only a valid empty value for multiple-choice fields.
      if (Array.isArray(value) && question.type !== "multiple_choice")
        issues.push({
          questionId: question.id,
          message: "Use the expected answer type.",
        })
      else if (question.required)
        issues.push({
          questionId: question.id,
          message: "This question is required.",
        })
      continue
    }
    if (!answer) continue
    const error = validateValue(question, answer.value)
    if (error) issues.push({ questionId: question.id, message: error })
    else
      normalized.push({
        ...answer,
        value:
          typeof answer.value === "string" ? answer.value.trim() : answer.value,
      })
  }
  return issues.length
    ? { ok: false, issues }
    : { ok: true, answers: normalized }
}

/** Version binding is checked before answers. Publication/revocation must still be checked in a transaction. */
export function validateFormSubmission(version: FormVersion, input: unknown) {
  const parsed = formSubmissionSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false as const, issues: [{ message: "Invalid submission." }] }
  if (
    parsed.data.formId !== version.formId ||
    parsed.data.versionId !== version.id
  )
    return {
      ok: false as const,
      issues: [
        { message: "This form version has changed. Reload before submitting." },
      ],
    }
  const result = validateFormAnswers(version.definition, parsed.data.answers)
  return result.ok
    ? {
        ok: true as const,
        submission: { ...parsed.data, answers: result.answers },
      }
    : result
}
