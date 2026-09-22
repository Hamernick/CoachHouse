import { z } from "zod"
import { parseScheduleDay } from "./project-schedule"

const date = z
  .string()
  .refine((value) => parseScheduleDay(value) !== null, "Enter a valid date.")
export const guidedProjectSchema = z
  .object({
    requestId: z.string().uuid(),
    organizationId: z.string().uuid(),
    name: z.string().trim().min(1).max(180),
    description: z.string().trim().max(10000),
    outcomes: z.string().trim().max(10000),
    startDate: date,
    endDate: date,
    ownerId: z.string().uuid("Choose a project owner."),
    contributorIds: z.array(z.string().uuid()).max(30),
    tasks: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(180),
          startDate: date,
          endDate: date,
          workstream: z.string().trim().min(1).max(100),
          assigneeId: z.string().uuid().optional(),
        })
      )
      .max(50),
    files: z
      .array(
        z.object({
          id: z.string().regex(/^[a-zA-Z0-9_-]{10,200}$/),
          name: z.string().trim().min(1).max(255),
        })
      )
      .max(30),
  })
  .superRefine((value, context) => {
    if (value.endDate < value.startDate)
      context.addIssue({
        code: "custom",
        message: "Due date must follow the start date.",
        path: ["endDate"],
      })
    value.tasks.forEach((task, index) => {
      if (
        task.endDate < task.startDate ||
        task.startDate < value.startDate ||
        task.endDate > value.endDate
      )
        context.addIssue({
          code: "custom",
          message: "Task dates must fall within the project dates.",
          path: ["tasks", index],
        })
    })
  })
export type GuidedProjectInput = z.infer<typeof guidedProjectSchema>

export function guidedProjectOverview(input: GuidedProjectInput) {
  const escape = (text: string) =>
    text.replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char]!
    )
  const paragraphs = (text: string) =>
    text
      .split(/\n+/)
      .filter(Boolean)
      .map((line) => `<p>${escape(line)}</p>`)
      .join("")
  return `${paragraphs(input.description)}${input.outcomes ? `<h2>Outcomes</h2>${paragraphs(input.outcomes)}` : ""}`
}
