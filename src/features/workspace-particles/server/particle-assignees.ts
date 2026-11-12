import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import type { ParticleAssignee } from "../lib/particle-assignees"
import { ParticleMutationError } from "../lib/authorized-mutation"

/** Caller authenticates the actor and organization before supplying its roster client.
 * Select only assignment identity fields; never return invitation tokens. */
export async function readParticleAssignees(client: SupabaseClient<Database>, orgId: string, now = Date.now()): Promise<ParticleAssignee[]> {
  const members: { member_id: string; member_email: string }[] = []
  const invites: { id: string; email: string; accepted_at: string | null; expires_at: string }[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("organization_memberships").select("member_id, member_email")
      .eq("org_id", orgId).order("member_id").range(offset, offset + 999).abortSignal(AbortSignal.timeout(15_000))
    if (error) throw new ParticleMutationError("unavailable", "Unable to load team members. Try again.")
    members.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) break
  }
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("organization_invites").select("id, email, accepted_at, expires_at")
      .eq("org_id", orgId).not("token", "like", "fndr_%").order("id").range(offset, offset + 999).abortSignal(AbortSignal.timeout(15_000))
    if (error) throw new ParticleMutationError("unavailable", "Unable to load team invitations. Try again.")
    invites.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) break
  }
  const roster = new Map<string, ParticleAssignee>([[orgId, { id: orgId, name: "Organization owner" }]])
  for (const member of members) roster.set(member.member_id, { id: member.member_id, name: member.member_email, email: member.member_email })
  const ids = [...roster.keys()]
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await client.from("profiles").select("id, full_name, email, avatar_url")
      .in("id", ids.slice(offset, offset + 100)).abortSignal(AbortSignal.timeout(15_000))
    if (error) throw new ParticleMutationError("unavailable", "Unable to load team members. Try again.")
    for (const profile of data ?? []) {
      const person = roster.get(profile.id)!
      person.avatarUrl = profile.avatar_url && /^https?:\/\//i.test(profile.avatar_url) ? profile.avatar_url : undefined
      person.email ||= profile.email ?? undefined
      person.name = profile.full_name?.trim() || person.email || person.name
    }
  }
  const byEmail = new Map([...roster.values()].filter(person => person.email).map(person => [person.email!.trim().toLowerCase(), person]))
  for (const invite of invites) {
    const member = byEmail.get(invite.email.trim().toLowerCase())
    if (member) {
      // Valid only while this identity remains on the current team.
      if ((!member.invited && invite.accepted_at) || (member.invited && !invite.accepted_at && Date.parse(invite.expires_at) > now)) (member.aliases ??= []).push(invite.id)
      continue
    }
    if (invite.accepted_at || Date.parse(invite.expires_at) <= now || !Number.isFinite(Date.parse(invite.expires_at))) continue
    const person = { id: invite.id, name: invite.email, email: invite.email, invited: true }
    roster.set(invite.id, person)
    byEmail.set(invite.email.trim().toLowerCase(), person)
  }
  return [...roster.values()].sort((a, b) => a.name.localeCompare(b.name))
}
