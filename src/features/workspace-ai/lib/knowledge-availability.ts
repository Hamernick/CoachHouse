import { z } from "zod"
export const knowledgeAvailabilitySchema = z.enum(["available", "metadata_only", "truncated", "changed", "unavailable", "unsupported_format", "exhausted_budget", "empty"])
export type KnowledgeAvailability = z.infer<typeof knowledgeAvailabilitySchema>
export const knowledgeRecoverySchema = z.enum(["none", "read_detail", "retry_read", "restart_research", "choose_source", "narrow_source"])
