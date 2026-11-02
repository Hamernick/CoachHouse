"use server"

import "server-only"
import { readComposableDataViewSource as readSource, readExistingDataViewCreation as readExistingCreation } from "./server/existing-source"

import { runDataViewCommand as runCommand } from "./server/actions"
import { readProjectDataViewCreation as readCreation } from "./server/project-creation"

export async function runDataViewCommand(input: unknown) {
  return runCommand(input)
}
export async function readProjectDataViewCreation(input: unknown) {
  return readCreation(input)
}

export async function readComposableDataViewSource(organizationId:string,viewId:string) {
  return readSource(organizationId,viewId)
}
export async function readExistingDataViewCreation(input:unknown) {
  return readExistingCreation(input)
}
