import type { EmailOpsCampaign } from "../types"
import { EMAIL_OPS_HTML_DRAFT_MARKER } from "./campaign-content"

const EMAIL_OPS_PRODUCT_UPDATE_HTML = `${EMAIL_OPS_HTML_DRAFT_MARKER}
<div style="margin:0 auto;max-width:640px;background:#ffffff;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="padding:0 0 24px;border-bottom:1px solid #e8e8e8;">
    <p style="margin:0 0 16px;color:#6b7280;font-size:13px;letter-spacing:.02em;text-transform:uppercase;">Coach House product update</p>
    <h1 style="margin:0;color:#111111;font-size:28px;line-height:1.25;letter-spacing:-.02em;">A clearer operating system for organizations</h1>
    <p style="margin:18px 0 0;color:#444444;font-size:16px;line-height:1.65;">We are shaping Coach House around one simple idea: your organization should have one calm place to understand what is happening, what needs attention, and what support is available next.</p>
  </div>

  <div style="padding:24px 0;border-bottom:1px solid #e8e8e8;">
    <div style="border-left:2px solid #e8e8e8;padding:4px 0 4px 16px;">
      <p style="margin:0;color:#6b7280;font-size:12px;letter-spacing:.04em;text-transform:uppercase;">Asset block / workspace canvas preview</p>
      <p style="margin:10px 0 0;color:#111111;font-size:15px;font-weight:600;">Add photo, SVG, or short animation showing organization cards connected on the canvas.</p>
      <p style="margin:8px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">Suggested motion: cards settle into place, then a person node and document node connect to the organization.</p>
    </div>
  </div>

  <div style="padding:24px 0;border-bottom:1px solid #e8e8e8;">
    <h2 style="margin:0;color:#111111;font-size:20px;letter-spacing:-.02em;">What is coming into focus</h2>
    <div style="margin-top:18px;display:block;">
      <div style="padding:18px 0;border-top:1px solid #eeeeee;">
        <p style="margin:0;color:#111111;font-size:15px;font-weight:700;">Fiscal sponsorship that feels guided</p>
        <p style="margin:8px 0 0;color:#4b5563;font-size:14px;line-height:1.65;">The flow is moving toward a real application, coach review, agreement, signature, and document-storage experience. The goal is less back-and-forth and a clearer path from interest to signed sponsorship.</p>
      </div>
      <div style="padding:18px 0;border-top:1px solid #eeeeee;">
        <p style="margin:0;color:#111111;font-size:15px;font-weight:700;">A workspace that shows relationships</p>
        <p style="margin:8px 0 0;color:#4b5563;font-size:14px;line-height:1.65;">The canvas is becoming a visual map of your organization: people, programs, documents, roadmap items, and coaching support in context rather than scattered across separate pages.</p>
      </div>
      <div style="padding:18px 0;border-top:1px solid #eeeeee;">
        <p style="margin:0;color:#111111;font-size:15px;font-weight:700;">Documents that become reusable knowledge</p>
        <p style="margin:8px 0 0;color:#4b5563;font-size:14px;line-height:1.65;">Organization overviews, signed agreements, handbooks, uploads, and working notes are being treated as useful context that can be found, reviewed, downloaded, and used to move work forward.</p>
      </div>
    </div>
  </div>

  <div style="padding:24px 0;border-bottom:1px solid #e8e8e8;">
    <div style="border-left:2px solid #e8e8e8;padding:4px 0 4px 16px;">
      <p style="margin:0;color:#6b7280;font-size:12px;letter-spacing:.04em;text-transform:uppercase;">Asset block / fiscal sponsorship flow</p>
      <p style="margin:10px 0 0;color:#111111;font-size:15px;font-weight:600;">Add a minimal sequence illustration: Application -> Review -> Agreement -> Signatures -> Stored documents.</p>
      <p style="margin:8px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">Suggested format: thin-line SVG or three-frame animation with the current product UI as the reference.</p>
    </div>
  </div>

  <div style="padding:24px 0;border-bottom:1px solid #e8e8e8;">
    <h2 style="margin:0;color:#111111;font-size:20px;letter-spacing:-.02em;">Where we are heading next</h2>
    <p style="margin:12px 0 0;color:#4b5563;font-size:14px;line-height:1.65;">The next layer is opportunity intelligence: helping organizations surface relevant grants, funding opportunities, events, social signals, and next-step recommendations based on the information they choose to keep in Coach House.</p>
    <p style="margin:14px 0 0;color:#4b5563;font-size:14px;line-height:1.65;">We are also preparing usage credits so AI-powered work can be understandable, trackable, and controlled. The product direction is simple: useful automation, clear limits, and human review where it matters.</p>
  </div>

  <div style="padding:24px 0;border-bottom:1px solid #e8e8e8;">
    <div style="border-left:2px solid #e8e8e8;padding:4px 0 4px 16px;">
      <p style="margin:0;color:#6b7280;font-size:12px;letter-spacing:.04em;text-transform:uppercase;">Asset block / opportunity intelligence preview</p>
      <p style="margin:10px 0 0;color:#111111;font-size:15px;font-weight:600;">Add product still or animation showing opportunities flowing into an activity monitor.</p>
      <p style="margin:8px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">Suggested callouts: "Review fit," "Draft materials," "Ask a coach," and "Save to documents."</p>
    </div>
  </div>

  <div style="padding:24px 0 0;">
    <h2 style="margin:0;color:#111111;font-size:20px;letter-spacing:-.02em;">How to read the roadmap</h2>
    <p style="margin:12px 0 0;color:#4b5563;font-size:14px;line-height:1.65;">We are building toward a workspace where strategy, compliance, documents, coaching, and opportunities reinforce each other. Each update will show the product direction in plain language and preview the parts of the system as they become easier to use.</p>
    <p style="margin:22px 0 0;">
      <a href="https://coachhouse.app/my-organization" style="display:inline-block;border-radius:4px;background:#111111;color:#ffffff;font-size:14px;font-weight:700;line-height:1;padding:13px 18px;text-decoration:none;">Open your workspace</a>
    </p>
  </div>
</div>`

export const EMAIL_OPS_CAMPAIGNS: EmailOpsCampaign[] = [
  {
    id: "weekly-product-update",
    title: "Product roadmap update",
    subject: "What we are building next at Coach House",
    previewText:
      "A simple look at the workspace, fiscal sponsorship, documents, and opportunity intelligence roadmap.",
    markdown: EMAIL_OPS_PRODUCT_UPDATE_HTML,
    status: "draft",
    audienceSegmentId: "opted-in-members",
    ownerName: "Coach House",
    updatedAtLabel: "Today",
    scheduledForLabel: "Friday 9:00 AM",
    heroMetric: "Roadmap",
    heroLabel: "public product update draft",
    tags: ["product", "roadmap", "members"],
  },
  {
    id: "coach-welcome",
    title: "Coach welcome",
    subject: "Welcome to Coach House",
    previewText:
      "First internal welcome note for new coaches and collaborators.",
    markdown:
      "# Coach welcome\n\nWelcome to the weekly Coach House product update. This draft will become the lightweight launch path for onboarding coaches into the workspace.",
    status: "review",
    audienceSegmentId: "coaches",
    ownerName: "Coach House",
    updatedAtLabel: "Yesterday",
    scheduledForLabel: null,
    heroMetric: "18",
    heroLabel: "coach recipients",
    tags: ["coaches", "welcome"],
  },
  {
    id: "member-roundup",
    title: "Member roundup",
    subject: "Member workspace roundup",
    previewText: "A safer template for member-facing product notes.",
    markdown:
      "# Member roundup\n\nA short member-facing update belongs here once consent, audience segmentation, and suppression checks are fully wired.",
    status: "paused",
    audienceSegmentId: "opted-in-members",
    ownerName: "Coach House",
    updatedAtLabel: "May 31",
    scheduledForLabel: null,
    heroMetric: "0",
    heroLabel: "bulk sends enabled",
    tags: ["members", "paused"],
  },
]


export function findEmailOpsCampaign(campaignId: string) {
  return (
    EMAIL_OPS_CAMPAIGNS.find((campaign) => campaign.id === campaignId) ?? null
  )
}
