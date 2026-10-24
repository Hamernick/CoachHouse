"use server"
import { loadWorkspacePageEditorAction as load, reviewWorkspacePageAction as review, commitWorkspacePageAction as commit } from "./server/actions"
export async function loadWorkspacePageEditorAction(input: unknown) { return load(input) }
export async function reviewWorkspacePageAction(input: unknown) { return review(input) }
export async function commitWorkspacePageAction(input: unknown) { return commit(input) }
