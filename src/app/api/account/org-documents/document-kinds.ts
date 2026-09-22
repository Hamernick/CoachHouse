export const KIND_KEY_MAP = {
  "verification-letter": "verificationLetter",
  "articles-of-incorporation": "articlesOfIncorporation",
  bylaws: "bylaws",
  "state-registration": "stateRegistration",
  "good-standing-certificate": "goodStandingCertificate",
  w9: "w9",
  "tax-exempt-certificate": "taxExemptCertificate",
  "uei-confirmation": "ueiConfirmation",
  "sam-active-status": "samActiveStatus",
  "grants-gov-registration": "grantsGovRegistration",
  "gata-pre-qualification": "gataPreQualification",
  "ein-confirmation-letter": "einConfirmationLetter",
  "irs-990s": "irs990s",
  "audited-financials": "auditedFinancials",
} as const

export type DocumentKey = (typeof KIND_KEY_MAP)[keyof typeof KIND_KEY_MAP]

export type DocumentMeta = {
  name: string
  path: string
  size: number
  mime: string
  updatedAt: string
}
