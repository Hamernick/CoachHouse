export async function revalidateWorkspaceCanvasAccess(scope: unknown) {
  const response = await fetch("/__fixture/canvas-access", { method: "POST", body: JSON.stringify(scope) })
  if (!response.ok) throw Error("Fixture unavailable")
  return response.json()
}
