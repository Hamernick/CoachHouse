"use server"

import "server-only"

import { runDataViewCommand as runCommand } from "./server/actions"
import { readProjectDataViewCreation as readCreation } from "./server/project-creation"

export async function runDataViewCommand(input: unknown) {
  return runCommand(input)
}
export async function readProjectDataViewCreation(input: unknown) {
  return readCreation(input)
}
