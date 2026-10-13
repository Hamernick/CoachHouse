const RESOURCE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function publicResourceProfileId(id: string) {
  if (id.startsWith("nonprofit:") && /^\d{9}$/.test(id.slice(10))) return id.slice(10)
  if (id.startsWith("resource_map:") && RESOURCE_UUID.test(id.slice(13))) return id.slice(13)
  return null
}

export function publicResourceProfileItemId(id: string) {
  if (/^\d{9}$/.test(id)) return `nonprofit:${id}`
  if (RESOURCE_UUID.test(id)) return `resource_map:${id}`
  return null
}

export function publicResourceProfileHref(id: string) {
  const profileId = publicResourceProfileId(id)
  return profileId ? `/find/resources/${profileId}` : null
}
