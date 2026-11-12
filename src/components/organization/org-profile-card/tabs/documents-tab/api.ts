import type { DocumentsPolicyEntry } from "./types"

type SavePolicyPayload = {
  id?: string
  title: string
  summary: string
  status: DocumentsPolicyEntry["status"]
  categories: string[]
  programId: string | null
  personIds: string[]
}

async function getErrorMessage(response: Response, fallback: string) {
  const err = await response.json().catch(() => ({}))
  return err?.error || fallback
}

export async function uploadOrgDocument(kind: string, file: File) {
  const form = new FormData()
  form.append("file", file)

  const res = await fetch(`/api/account/org-documents?kind=${encodeURIComponent(kind)}`, {
    method: "POST",
    body: form,
  })
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Upload failed"))
  }

  // The authorized library refresh owns metadata after a successful write.
  const payload = await res.json()
  if (payload?.ok !== true) throw new Error("Upload confirmation unavailable")
}

export async function getOrgDocumentUrl(kind: string, options?: { download?: boolean }) {
  const search = new URLSearchParams({ kind })
  if (options?.download) {
    search.set("download", "1")
  }
  const res = await fetch(`/api/account/org-documents?${search.toString()}`)
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Unable to open document"))
  }

  const payload = await res.json()
  const url = payload?.url as string | undefined
  if (!url) throw new Error("Unable to open document")
  return url
}

export async function deleteOrgDocument(kind: string) {
  const res = await fetch(`/api/account/org-documents?kind=${encodeURIComponent(kind)}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Delete failed"))
  }
}

export async function savePolicy(payload: SavePolicyPayload) {
  const method = payload.id ? "PATCH" : "POST"
  const res = await fetch("/api/account/org-policies", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Unable to save policy"))
  }

  const response = await res.json()
  if (response?.ok !== true || typeof response.policyId !== "string" || !response.policyId)
    throw new Error("Policy confirmation unavailable")
  return response.policyId as string
}

export async function deletePolicy(policyId: string) {
  const res = await fetch(`/api/account/org-policies?id=${encodeURIComponent(policyId)}`, {
    method: "DELETE",
  })

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Unable to delete policy"))
  }
}

export async function uploadPolicyDocument(policyId: string, file: File) {
  const form = new FormData()
  form.append("file", file)

  const res = await fetch(
    `/api/account/org-policies/document?id=${encodeURIComponent(policyId)}`,
    {
      method: "POST",
      body: form,
    },
  )

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Unable to upload policy file"))
  }

  const payload = await res.json()
  if (payload?.ok !== true) throw new Error("Policy file confirmation unavailable")
}

export async function removePolicyDocument(policyId: string) {
  const res = await fetch(
    `/api/account/org-policies/document?id=${encodeURIComponent(policyId)}`,
    {
      method: "DELETE",
    },
  )

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Unable to remove policy file"))
  }

  const payload = await res.json()
  if (payload?.ok !== true) throw new Error("Policy file confirmation unavailable")
}

export async function getPolicyDocumentUrl(policyId: string, options?: { download?: boolean }) {
  const search = new URLSearchParams({ id: policyId })
  if (options?.download) {
    search.set("download", "1")
  }
  const res = await fetch(`/api/account/org-policies/document?${search.toString()}`)

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Unable to open policy file"))
  }

  const payload = await res.json()
  const url = payload?.url as string | undefined
  if (!url) throw new Error("Unable to open policy file")
  return url
}
