import { z } from "zod"

const option = z.object({
  id: z.string().trim().min(1).max(100),
  label: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((value) => !value.includes(","), "Labels cannot contain commas."),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
})
const options = z
  .array(option)
  .max(100)
  .superRefine((items, ctx) => {
    const ids = new Set<string>()
    const names = new Set<string>()
    for (const item of items) {
      if (ids.has(item.id) || names.has(item.label.toLowerCase())) {
        ctx.addIssue({
          code: "custom",
          message: "Option names and IDs must be unique.",
        })
      }
      ids.add(item.id)
      names.add(item.label.toLowerCase())
    }
  })
export const projectOptionSettingsSchema = z.object({
  tags: options,
  sprintTypes: options,
})
export type ProjectOptionSettings = z.infer<typeof projectOptionSettingsSchema>
