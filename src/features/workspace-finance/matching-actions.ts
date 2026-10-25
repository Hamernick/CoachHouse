"use server"
import { revalidatePath } from "next/cache"
import type { ResourceMatchTarget } from "./matching-types"
import { loadResourceMatches, searchResourceMatches, changeResourceMatch } from "./server/resource-matches"

export async function getResourceOpportunityMatches(target:ResourceMatchTarget) {
  try { return await loadResourceMatches(target) } catch(error) { return {error:error instanceof Error?error.message:"Matches unavailable."} }
}
export async function findResourceOpportunityMatches(input:unknown) {
  try { return await searchResourceMatches(input) } catch(error) { return {error:error instanceof Error?error.message:"Search unavailable."} }
}
export async function updateResourceOpportunityMatch(input:unknown) {
  try { const result=await changeResourceMatch(input);revalidatePath("/workspace");return result } catch(error) { return {error:error instanceof Error?error.message:"Match update unavailable."} }
}
