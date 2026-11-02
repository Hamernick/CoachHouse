"use client"
import type { FormIntakeCommand } from "../lib"

export class IntakeRequestError extends Error {
  constructor(message: string, public readonly uncertain: boolean, public readonly status = 503) { super(message) }
}
export async function sendFormCommand(command: FormIntakeCommand): Promise<unknown> {
  try {
    const response = await fetch("/api/public/forms/intake", { method: "POST", credentials: "same-origin",
      cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command),
      signal: AbortSignal.timeout(15_000) })
    const result: unknown = await response.json()
    if (!result || typeof result !== "object") throw new Error("Invalid reply")
    if (!response.ok) {
      if (!("error" in result) || typeof result.error !== "string" || !("uncertain" in result) || typeof result.uncertain !== "boolean") throw new Error("Invalid reply")
      throw new IntakeRequestError(result.error, result.uncertain, response.status)
    }
    if (!("value" in result)) throw new Error("Invalid reply")
    return result.value
  } catch (error) {
    if (error instanceof IntakeRequestError) throw error
    throw new IntakeRequestError("Unable to confirm. Retry the same request.", (command.action === "submit" || command.action === "delete_response" || command.action === "correct" || command.action === "recover_form" || command.action === "grant_reviewer" || command.action === "revoke_reviewer"))
  }
}
