export type AiCreditLimit = { limit: number | null; used: number; revision: string | null }
export type AiCreditLimits = {
  canManage: boolean
  resetsAt: string
  organization: AiCreditLimit
  members: Array<AiCreditLimit & { memberId: string; name: string }>
}
