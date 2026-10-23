import { z } from "zod"

export const fiscalOrganizationCandidateSchema = z.object({
  organizationId: z.string().uuid(), name: z.string(), ownerEmail: z.string().email(),
  version: z.string().regex(/^[a-f0-9]{32}$/),
}).strict()
export const fiscalOrganizationSearchSchema = z.object({
  linked: z.object({ organizationId: z.string().uuid(), name: z.string() }).strict().nullable(),
  candidates: z.array(fiscalOrganizationCandidateSchema).max(25),
}).strict()
export const fiscalOrganizationLinkInputSchema = z.object({
  projectId: z.string().uuid(), organizationId: z.string().uuid(), requestId: z.string().uuid(),
  version: z.string().regex(/^[a-f0-9]{32}$/),
}).strict()
export type FiscalOrganizationCandidate = z.infer<typeof fiscalOrganizationCandidateSchema>
export type FiscalOrganizationSearch = z.infer<typeof fiscalOrganizationSearchSchema>
