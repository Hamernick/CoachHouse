"use server"
import { runDataViewCommand as runCommand } from "./server/actions"
export async function runDataViewCommand(input: unknown) {
  return runCommand(input)
}
