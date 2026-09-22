export type OrgDocument = {
  name: string
  path: string
  size?: number | null
  mime?: string | null
  updatedAt?: string | null
}

export type OrgDocuments = {
  verificationLetter?: OrgDocument | null
  articlesOfIncorporation?: OrgDocument | null
  bylaws?: OrgDocument | null
  stateRegistration?: OrgDocument | null
  goodStandingCertificate?: OrgDocument | null
  w9?: OrgDocument | null
  taxExemptCertificate?: OrgDocument | null
  ueiConfirmation?: OrgDocument | null
  samActiveStatus?: OrgDocument | null
  grantsGovRegistration?: OrgDocument | null
  gataPreQualification?: OrgDocument | null
  einConfirmationLetter?: OrgDocument | null
  irs990s?: OrgDocument | null
  auditedFinancials?: OrgDocument | null
}

export type DocumentDefinition = {
  kind: string
  key: keyof OrgDocuments
  title: string
  description: string
  defaultName: string
  category: string
}

export type DocumentsPolicyEntry = {
  id: string
  title: string
  summary: string
  status: "not_started" | "in_progress" | "complete"
  categories: string[]
  programId: string | null
  personIds: string[]
  document: OrgDocument | null
  updatedAt: string | null
}
