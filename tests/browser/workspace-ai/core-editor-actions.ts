export async function revalidateCoreDocuments(input: unknown) {
  const response = await fetch("/fixture/core-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) })
  if (!response.ok) throw new Error("Document unavailable")
  return response.json()
}
