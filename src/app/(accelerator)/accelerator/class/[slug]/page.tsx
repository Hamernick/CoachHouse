import { organizationLearningUserId } from "@/lib/accelerator/organization-context"
import { redirect } from "next/navigation"

import { getClassModulesForUser } from "@/lib/modules"
import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { buildModuleStates } from "@/lib/module-progress"

type Params = { slug: string }

export default async function AcceleratorClassRedirect({ params }: { params: Promise<Params> }) {
  const { slug } = await params

  const requestContext = await resolveOptionalAuthenticatedAppContext()
  if (!requestContext) {
    redirect(`/login?redirect=/accelerator/class/${slug}`)
  }

  const { supabase, user, profileAudience, activeOrg } = requestContext

  const classCtx = await getClassModulesForUser({
    classSlug: slug,
    userId: organizationLearningUserId(user.id, activeOrg),
    forceAdmin: profileAudience.isAdmin,
    supabase,
  })

  const moduleStates = buildModuleStates(classCtx.modules, classCtx.progressMap)
  const target = moduleStates.find((state) => !state.completed) ?? moduleStates[moduleStates.length - 1]

  if (!target) {
    redirect("/accelerator")
  }

  redirect(`/accelerator/class/${slug}/module/${target.module.idx}`)
}
