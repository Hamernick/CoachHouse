"use server"

import "server-only"
import { readTableAnalysisSnapshot as readAnalysis } from "./server/table-analysis"
import { readComposableDataViewSource as readSource, readExistingDataViewCreation as readExistingCreation } from "./server/existing-source"

import { createLinkedSheetView as createSheet } from "./server/sheet-composition"

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
export async function readExistingDataViewCreation(input:unknown,binding?:unknown) {
  return readExistingCreation(input,binding)
}

export async function createLinkedSheetView(input:unknown,binding:unknown) {
  return createSheet(input,binding)
}

export async function readTableAnalysisSnapshot(organizationId: string, viewId: string, actorId: string, signal?: AbortSignal) {
  return readAnalysis(organizationId, viewId, actorId, signal)
}
