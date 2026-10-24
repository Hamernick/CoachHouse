"use server"
import { loadPersonalNote as load, writePersonalNote as write } from "./server/note-module-actions"
export async function loadPersonalNote(moduleId: string) { return load(moduleId) }
export async function writePersonalNote(input: Parameters<typeof write>[0]) { return write(input) }
