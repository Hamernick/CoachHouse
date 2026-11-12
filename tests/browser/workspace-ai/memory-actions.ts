async function call(input?: unknown, scope = "personal") {
  const result = await fetch(`/__fixture/${scope}-memory`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input ?? { action: "read" }) })
  const data = await result.json()
  if (!result.ok) throw new Error(data.error)
  return data
}
export const loadPersonalMemory = () => call()
export const changePersonalMemory = async (input: unknown) => ({ ok: true, memory: await call(input) })

export const loadOrganizationMemory = () => call(undefined, "organization")
export const changeOrganizationMemory = async (input: unknown) => ({ ok: true, memory: await call(input, "organization") })
