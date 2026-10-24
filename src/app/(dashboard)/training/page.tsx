import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { TrainingShell } from "@/components/training/training-shell"
import { fetchSidebarTree } from "@/lib/academy"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { isSupabaseAuthSessionMissingError } from "@/lib/supabase/auth-errors"
import { supabaseErrorToError } from "@/lib/supabase/errors"

export const metadata: Metadata = {
  title: "Training",
  description: "Explore nonprofit training and continue your lessons.",
}


export default async function TrainingPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError && !isSupabaseAuthSessionMissingError(userError)) {
    throw supabaseErrorToError(userError, "Unable to load user.")
  }

  if (!user) {
    redirect("/login?redirect=/training")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>()
  const isAdmin = profile?.role === "admin"

  const classes = await fetchSidebarTree({ includeDrafts: isAdmin, forceAdmin: isAdmin })
  const classDefs = classes.map((klass) => ({
    id: klass.id,
    title: klass.title,
    blurb: klass.description ?? "",
    description: klass.description ?? "",
    slug: klass.slug,
    published: klass.published,
    modules: klass.modules.map((module) => ({
      id: module.id,
      title: module.title,
      subtitle: module.description ?? undefined,
      published: module.published,
    })),
  }))

  return (
    <div className="w-full">
      <TrainingShell classes={classDefs} isAdmin={isAdmin} />
    </div>
  )
}
