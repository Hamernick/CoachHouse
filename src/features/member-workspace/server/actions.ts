"use server"

import { revalidatePath } from "next/cache"
import { setActiveOrganization } from "./organization-switch"

export async function setActiveOrganizationAction(orgId: string) {
  const result = await setActiveOrganization(orgId)
  if (!("error" in result)) {
    for (const path of ["/admin", "/my-organization", "/organization", "/organization/documents", "/workspace", "/organizations", "/tasks", "/people"]) revalidatePath(path)
  }
  return result
}
