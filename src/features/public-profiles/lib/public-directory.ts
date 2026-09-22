import { validatePublicHandle } from "./handles"

export type PublicPersonDirectoryEntry = {
  handle: string
  name: string
  headline: string | null
  location: string | null
  avatarUrl: string | null
  href: string
}

export type PublicPersonDirectoryProfile = PublicPersonDirectoryEntry & {
  bio: string | null
  websiteUrl: string | null
}

type PublishedPersonRow = {
  profile_id: string
  display_name: string
  headline: string | null
  location_label: string | null
  avatar_url: string | null
  is_public: boolean
}

type PersonHandleRow = {
  profile_id: string | null
  owner_type: string
  handle: string
}

function publicImageUrl(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url.href : null
  } catch {
    return null
  }
}

/** Explicit projection: account data and publication flags never reach the directory. */
export function projectPublicPeople(
  people: PublishedPersonRow[],
  handles: PersonHandleRow[]
): PublicPersonDirectoryEntry[] {
  const handlesByPerson = new Map(
    handles
      .filter(
        (row) =>
          row.owner_type === "person" &&
          row.profile_id &&
          validatePublicHandle(row.handle).valid
      )
      .map((row) => [row.profile_id, validatePublicHandle(row.handle).handle])
  )

  return people.flatMap((person) => {
    const handle = handlesByPerson.get(person.profile_id)
    if (!person.is_public || !handle || !person.display_name.trim()) return []
    return [
      {
        handle,
        name: person.display_name,
        headline: person.headline,
        location: person.location_label,
        avatarUrl: publicImageUrl(person.avatar_url),
        href: `/${handle}`,
      },
    ]
  })
}

export function projectPublicPerson(
  person: PublishedPersonRow & {
    bio: string | null
    website_url: string | null
  },
  handle: PersonHandleRow
): PublicPersonDirectoryProfile | null {
  const entry = projectPublicPeople([person], [handle])[0]
  if (!entry) return null

  let websiteUrl: string | null = null
  try {
    const url = new URL(person.website_url ?? "")
    if (url.protocol === "https:" || url.protocol === "http:") {
      websiteUrl = url.href
    }
  } catch {
    // An invalid optional website must not become a clickable link.
  }
  return { ...entry, bio: person.bio, websiteUrl }
}
