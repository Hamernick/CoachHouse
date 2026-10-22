"use server"
import type { AiPlanTarget } from "./ai-plan-types"
import { quoteAiPlan, readAiPlan, stopAiPlan, applyAiPlan } from "./server/ai-plan-actions"
export async function quotePlanAssistance(target: AiPlanTarget) { return quoteAiPlan(target) }
export async function readPlanAssistance(id: string, target: AiPlanTarget) { return readAiPlan(id, target) }
export async function stopPlanAssistance(id: string, target: AiPlanTarget) { return stopAiPlan(id, target) }
export async function applyPlanAssistance(id: string, target: AiPlanTarget) { return applyAiPlan(id, target) }
export async function undoPlanAssistance(id: string, target: AiPlanTarget) { return applyAiPlan(id, target, true) }
