import type { Metadata } from "next"
import { ClassOverview } from "@/components/training/class-overview"
import { getClassModulesForUser } from "@/lib/modules"
import { buildModuleStates } from "@/lib/module-progress"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Training Class",
  description: "Review your nonprofit training class and module progress.",
}

 
// Static landing that relies on middleware for auth

type Params = { slug: string }

export default async function ClassLandingPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params

  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  let profile: { role: string | null } | null = null
  if (auth.user) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle<{ role: string | null }>()
    profile = data ?? null
  }

  // Use existing server helper that already respects RLS and publication
  const classCtx = auth.user
    ? await getClassModulesForUser({
        classSlug: slug,
        userId: auth.user.id,
        forceAdmin: profile?.role === "admin",
        supabase,
      })
    : null

  const moduleStates = classCtx ? buildModuleStates(classCtx.modules, classCtx.progressMap) : null

  const c = classCtx && moduleStates
    ? {
        id: classCtx.classId,
        title: classCtx.classTitle,
        blurb: classCtx.classSubtitle ?? classCtx.classDescription ?? "",
        description: classCtx.classDescription ?? "",
        published: classCtx.classPublished,
        slug,
        resources: classCtx.classResources ?? [],
        videoUrl: classCtx.classVideoUrl ?? null,
        modules: moduleStates.map(({ module, status, locked }) => ({
          id: module.id,
          title: module.title,
          subtitle: module.description ?? undefined,
          idx: module.idx,
          published: module.published !== false,
          status,
          locked,
          progressPercent: status === "completed" ? 100 : status === "in_progress" ? 55 : 0,
          durationMinutes: module.durationMinutes ?? null,
          lessonCount: (module as { lesson_count?: number | null }).lesson_count ?? null,
        })),
      }
    : null

  return (
    <div className="space-y-8">
      {c ? (
        <ClassOverview c={c} isAdmin={profile?.role === "admin"} />
      ) : (
        <div className="rounded-lg border bg-card/60 p-6 text-sm text-muted-foreground">Class not found.</div>
      )}
    </div>
  )
}
