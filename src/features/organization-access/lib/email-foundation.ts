import { renderMinimalEmail } from "@/lib/email/minimal-template"
import {
  formatOrganizationAccessRoleLabel,
  type OrganizationAccessRole,
} from "./notification-metadata"

export type CoachHouseEmailPreview = {
  id: string
  family: "app" | "supabase-auth"
  category: string
  title: string
  subject: string
  previewText: string
  description: string
  html: string
  text: string
}

type EmailStat = {
  label: string
  value: string
}

type EmailTemplateInput = {
  logoUrl: string
  eyebrow: string
  title: string
  intro: string
  body: string[]
  ctaLabel: string
  ctaHref: string
  helpText: string
  footer: string
  previewText: string
  stats?: EmailStat[]
}

export function renderCoachHouseEmail(input: EmailTemplateInput) {
  return renderMinimalEmail({
    logoUrl: input.logoUrl,
    eyebrow: input.eyebrow,
    title: input.title,
    intro: input.intro,
    body: input.body,
    details: input.stats,
    action: { label: input.ctaLabel, href: input.ctaHref },
    helpText: input.helpText,
    footer: input.footer,
    previewText: input.previewText,
  })
}

export function renderCoachHouseEmailHtml(input: EmailTemplateInput) {
  return renderCoachHouseEmail(input).html
}

type PreviewSeed = {
  siteUrl: string
  organizationName: string
}

function resolveLogoUrl(siteUrl: string) {
  return `${siteUrl.replace(/\/$/, "")}/coach-house-logo-dark.png`
}

export function buildOrganizationInviteEmailPreview({
  siteUrl,
  organizationName,
}: PreviewSeed): CoachHouseEmailPreview {
  const joinUrl = `${siteUrl.replace(/\/$/, "")}/join-organization?token=preview-token`

  return {
    id: "organization-external-invite",
    family: "app",
    category: "Invites",
    title: "Organization invite",
    subject: `Join ${organizationName} on Coach House`,
    previewText: `Accept your Coach House invite to join ${organizationName}.`,
    description:
      "Custom app-owned invite email for people who do not have an account yet.",
    ...renderCoachHouseEmail({
      logoUrl: resolveLogoUrl(siteUrl),
      eyebrow: "Organization invite",
      title: `Join ${organizationName} on Coach House`,
      intro:
        "You’ve been invited to join this organization on Coach House.",
      body: [
        "Create your account, then accept the invitation to access the workspace.",
      ],
      ctaLabel: "Create account and join",
      ctaHref: joinUrl,
      helpText: "Sign in or create an account to accept this invitation.",
      footer:
        "If you were not expecting this invite, you can safely ignore this message.",
      previewText: `Accept your Coach House invite to join ${organizationName}.`,
      stats: [
        { label: "Access", value: "Team invite" },
        { label: "Role", value: "Workspace editor" },
      ],
    }),
  }
}

export function buildExistingUserRequestEmailPreview({
  siteUrl,
  organizationName,
  reviewUrl = `${siteUrl.replace(/\/$/, "")}/access-requests`,
  inviterName,
  role,
  respondBy,
}: PreviewSeed & { reviewUrl?: string; inviterName?: string; role?: OrganizationAccessRole; respondBy?: string }): CoachHouseEmailPreview {
  return {
    id: "organization-existing-user-request",
    family: "app",
    category: "Invites",
    title: "Existing user request",
    subject: `${organizationName} invited you to collaborate`,
    previewText: `Review the access request from ${organizationName} inside your Coach House account.`,
    description:
      "Heads-up email for an existing Coach House user who should accept or decline inside notifications.",
    ...renderCoachHouseEmail({
      logoUrl: resolveLogoUrl(siteUrl),
      eyebrow: "Access request",
      title: `${organizationName} invited you to collaborate`,
      intro: inviterName
        ? `${inviterName} invited you to collaborate with ${organizationName}.`
        : "There’s a new access request waiting for you in Coach House notifications.",
      body: [
        "Open your account to review the request and choose whether to accept or decline it.",
      ],
      ctaLabel: "Review request",
      ctaHref: reviewUrl,
      helpText: "Sign in with your existing Coach House account to respond.",
      footer:
        "If this wasn’t expected, no action is required and you can ignore this email.",
      previewText: `Review the access request from ${organizationName} inside your Coach House account.`,
      stats: [
        { label: "Action", value: "Accept or decline" },
        { label: "Location", value: "Notifications" },
        ...(role ? [{ label: "Role", value: formatOrganizationAccessRoleLabel(role) }] : []),
        ...(respondBy ? [{ label: "Respond by", value: respondBy }] : []),
      ],
    }),
  }
}

type SupabaseAuthEmailTemplateInput = {
  id: string
  title: string
  subject: string
  previewText: string
  description: string
  eyebrow: string
  ctaLabel: string
  ctaHref: string
  intro: string
  body: string[]
  footer: string
}

function buildSupabaseAuthEmailTemplate(
  siteUrl: string,
  input: SupabaseAuthEmailTemplateInput,
): CoachHouseEmailPreview {
  return {
    id: input.id,
    family: "supabase-auth",
    category: "Auth emails",
    title: input.title,
    subject: input.subject,
    previewText: input.previewText,
    description: input.description,
    ...renderCoachHouseEmail({
      logoUrl: resolveLogoUrl(siteUrl),
      eyebrow: input.eyebrow,
      title: input.title,
      intro: input.intro,
      body: input.body,
      ctaLabel: input.ctaLabel,
      ctaHref: input.ctaHref,
      helpText: "Use this link only if you requested this email.",
      footer: input.footer,
      previewText: input.previewText,
    }),
  }
}

export function buildSupabaseAuthEmailPreviews(
  siteUrl: string,
): CoachHouseEmailPreview[] {
  const normalizedSiteUrl = siteUrl.replace(/\/$/, "")

  return [
    buildSupabaseAuthEmailTemplate(siteUrl, {
      id: "supabase-confirm-sign-up",
      title: "Confirm your email",
      subject: "Confirm your email to get started with Coach House",
      previewText: "Confirm your address to continue setting up your account.",
      description: "Supabase confirmation email used after sign up.",
      eyebrow: "Confirm sign up",
      ctaLabel: "Confirm email",
      ctaHref:
        `${normalizedSiteUrl}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}`,
      intro:
        "Welcome to Coach House. Confirm your email so we can finish setting up your account.",
      body: [
        "After confirming, you can continue where you left off.",
      ],
      footer: "If you didn’t create an account, you can safely ignore this email.",
    }),
    buildSupabaseAuthEmailTemplate(siteUrl, {
      id: "supabase-invite-user",
      title: "Accept your Coach House invite",
      subject: "You’ve been invited to Coach House",
      previewText: "Create your account and finish setting up your access.",
      description:
        "Supabase invite-user email for account creation flows that redirect into the organization join step.",
      eyebrow: "Invite user",
      ctaLabel: "Accept invite",
      ctaHref: "{{ .ConfirmationURL }}",
      intro:
        "You’ve been invited to create your Coach House account and continue into a shared workspace.",
      body: [
        "Use the secure link below to finish account setup. We’ll take you to the next step automatically.",
      ],
      footer: "If this invite wasn’t meant for you, you can ignore this message.",
    }),
    buildSupabaseAuthEmailTemplate(siteUrl, {
      id: "supabase-magic-link",
      title: "Your secure sign in link",
      subject: "Sign in to Coach House",
      previewText: "Use this one-time link to securely sign in.",
      description: "Supabase magic-link email for passwordless sign in.",
      eyebrow: "Magic link",
      ctaLabel: "Sign in",
      ctaHref: "{{ .ConfirmationURL }}",
      intro: "Use this secure one-time link to sign in to Coach House.",
      body: [
        "The link expires automatically, so use it soon and only on a device you trust.",
      ],
      footer: "If you didn’t request this sign-in link, no action is required.",
    }),
    buildSupabaseAuthEmailTemplate(siteUrl, {
      id: "supabase-change-email",
      title: "Confirm your new email",
      subject: "Confirm your new Coach House email address",
      previewText: "Verify your new address to finish the update.",
      description: "Supabase email-change verification template.",
      eyebrow: "Change email address",
      ctaLabel: "Confirm new email",
      ctaHref: "{{ .ConfirmationURL }}",
      intro:
        "Confirm your new email address so we can finish updating your Coach House account.",
      body: [
        "Once confirmed, future sign-ins and account notices will use this new address.",
      ],
      footer: "If you didn’t request this change, you can ignore this email.",
    }),
    buildSupabaseAuthEmailTemplate(siteUrl, {
      id: "supabase-reset-password",
      title: "Reset your password",
      subject: "Reset your Coach House password",
      previewText: "Choose a new password with this secure reset link.",
      description: "Supabase recovery email template.",
      eyebrow: "Reset password",
      ctaLabel: "Reset password",
      ctaHref:
        `${normalizedSiteUrl}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}`,
      intro:
        "Use the secure link below to choose a new password for your Coach House account.",
      body: [
        "For security, the link expires automatically. If you still need help after that, request another reset email.",
      ],
      footer: "If you didn’t request a password reset, you can safely ignore this message.",
    }),
    buildSupabaseAuthEmailTemplate(siteUrl, {
      id: "supabase-reauthentication",
      title: "Confirm this secure action",
      subject: "Confirm your Coach House security check",
      previewText: "Use this link to continue a sensitive action securely.",
      description: "Supabase reauthentication template for sensitive actions.",
      eyebrow: "Reauthentication",
      ctaLabel: "Continue securely",
      ctaHref: "{{ .ConfirmationURL }}",
      intro: "Before we continue, we need to confirm it’s really you.",
      body: [
        "Use the link below to finish this secure step. It expires automatically for your protection.",
      ],
      footer: "If you didn’t request this action, you can ignore this email.",
    }),
  ]
}

export function buildOrganizationAccessEmailPreviews(siteUrl: string) {
  const normalizedSiteUrl = siteUrl.replace(/\/$/, "")
  const organizationName = "South Side Renewal Initiative"

  return [
    buildOrganizationInviteEmailPreview({
      siteUrl: normalizedSiteUrl,
      organizationName,
    }),
    buildExistingUserRequestEmailPreview({
      siteUrl: normalizedSiteUrl,
      organizationName,
    }),
    ...buildSupabaseAuthEmailPreviews(normalizedSiteUrl),
  ]
}

export function buildOrganizationAccessRequestEmailSubject({
  organizationName,
}: {
  organizationName: string
}) {
  return `${organizationName} invited you to collaborate`
}

export function buildOrganizationAccessRequestEmail(input: PreviewSeed & {
  reviewUrl: string
  inviterName?: string
  role?: OrganizationAccessRole
  respondBy?: string
}) {
  const { html, text } = buildExistingUserRequestEmailPreview(input)
  return { html, text }
}

export function buildOrganizationAccessRequestEmailHtml(input: Parameters<typeof buildOrganizationAccessRequestEmail>[0]) {
  return buildOrganizationAccessRequestEmail(input).html
}

export function buildOrganizationInviteEmailSubject({
  organizationName,
  role,
}: {
  organizationName: string
  role: OrganizationAccessRole
}) {
  return `Join ${organizationName} as ${formatOrganizationAccessRoleLabel(role)} on Coach House`
}

export function buildOrganizationInviteEmail({
  siteUrl,
  organizationName,
  role,
  joinUrl,
  inviterName,
  respondBy,
}: {
  siteUrl: string
  organizationName: string
  role: OrganizationAccessRole
  joinUrl: string
  inviterName?: string
  respondBy?: string
}) {
  return renderCoachHouseEmail({
    logoUrl: resolveLogoUrl(siteUrl),
    eyebrow: "Organization invite",
    title: `Join ${organizationName} on Coach House`,
    intro: inviterName
      ? `${inviterName} invited you to join ${organizationName}.`
      : "You’ve been invited to join this organization on Coach House.",
    body: [
      `${organizationName} is ready for you inside Coach House.`,
      `Your access will open as ${formatOrganizationAccessRoleLabel(role)} once you finish the secure join step.`,
    ],
    ctaLabel: "Create account and join",
    ctaHref: joinUrl,
    helpText: "Sign in or create an account to accept this invitation.",
    footer:
      "If you were not expecting this invite, you can safely ignore this message.",
    previewText: `Accept your Coach House invite to join ${organizationName}.`,
    stats: [
      { label: "Access", value: "Organization" },
      { label: "Role", value: formatOrganizationAccessRoleLabel(role) },
      ...(respondBy ? [{ label: "Respond by", value: respondBy }] : []),
    ],
  })
}

export function buildOrganizationInviteEmailHtml(input: Parameters<typeof buildOrganizationInviteEmail>[0]) {
  return buildOrganizationInviteEmail(input).html
}
