export type ParticleAssignee = {
  id: string
  name: string
  avatarUrl?: string
  email?: string
  invited?: boolean
  /** An accepted invitation keeps resolving to its current team member. */
  aliases?: string[]
}

export function assigneeMatches(person: ParticleAssignee, id: string) {
  return person.id === id || Boolean(person.aliases?.includes(id))
}
