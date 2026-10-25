export type AiAllowanceSetup = {
  organizationName: string
  binding: string | null
  grant: { label: string; credits: number; expiresAt: string } | null
  options: Array<{ id: string; label: string; credits: number }>
}
