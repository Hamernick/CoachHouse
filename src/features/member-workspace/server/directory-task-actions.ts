"use server"

import type { MemberWorkspaceCreateTaskInput } from "../types"
import { createMemberWorkspaceTaskAction, updateMemberWorkspaceTaskAction } from "./task-actions"
import { resolveDirectoryTaskScope } from "./task-directory-scope"

export async function createDirectoryTaskAction(input: MemberWorkspaceCreateTaskInput) {
  return createMemberWorkspaceTaskAction(input, await resolveDirectoryTaskScope())
}

export async function updateDirectoryTaskAction(taskId: string, input: MemberWorkspaceCreateTaskInput) {
  return updateMemberWorkspaceTaskAction(taskId, input, await resolveDirectoryTaskScope())
}
