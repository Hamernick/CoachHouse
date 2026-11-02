import type { FormAccessTarget } from "./form-review-access"
export function formSourcePath(organizationId: string, formId: string) {
  return `/forms/edit/${encodeURIComponent(organizationId)}/${encodeURIComponent(formId)}`
}
export function formTargetMatches(target: FormAccessTarget, value: { versionId?: string; organizationId?: string; formId?: string }) {
  return target.versionId ? value.versionId === target.versionId && !value.organizationId && !value.formId
    : value.organizationId === target.organizationId && value.formId === target.formId && !value.versionId
}
