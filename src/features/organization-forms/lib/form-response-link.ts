import { z } from "zod"

/** A locator, never a bearer credential or permission grant. */
export function formResponsePath(versionId: string) {
  return `/forms/responses/${z.uuid().parse(versionId)}`
}
