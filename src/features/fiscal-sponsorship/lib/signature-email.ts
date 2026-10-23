import { renderMinimalEmail } from "@/lib/email/minimal-template"

export function buildFiscalSignatureEmail({ siteUrl, projectName, signingUrl }: {
  siteUrl: string
  projectName: string
  signingUrl: string
}) {
  return {
    subject: `${projectName.replace(/[\r\n]+/g, " ")} is ready for signature`,
    ...renderMinimalEmail({
      siteUrl,
      eyebrow: "Fiscal sponsorship",
      title: "Your agreement is ready to sign",
      intro: `${projectName} is ready for your signature in Coach House.`,
      details: [{ label: "Project", value: projectName }],
      action: { label: "Review and sign the agreement", href: signingUrl },
      helpText: "Sign in with the Coach House account assigned to this application.",
      previewText: `Review and sign the fiscal sponsorship agreement for ${projectName}.`,
    }),
  }
}
