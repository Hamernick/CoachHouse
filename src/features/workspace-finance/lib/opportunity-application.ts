import { z } from "zod"
import { officialOpportunityNoticeSchema, type OfficialOpportunityNotice } from "../matching-types"
import { opportunityValueLabel } from "./opportunity-matching"

export const applicationSectionId = (matchId: string) => `application-${z.uuid().parse(matchId)}`
const escape = (text: string) => text.replace(/[&<>"']/g, value => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[value]!)
const excerpt = (text: string, limit: number) => escape(text.length > limit ? `${text.slice(0, limit)}\n[Excerpt: read the complete official notice.]` : text)

/** A preparation worksheet, not an extracted official application form or AI output.
 * Accepts public notice facts only: private funding reviews never enter shared documents. */
export function opportunityApplicationSeed(input: OfficialOpportunityNotice) {
  const notice = officialOpportunityNoticeSchema.parse(input)
  const title = `Application — ${notice.title}`.slice(0, 200)
  const content = [
    `<h1>${escape(title)}</h1>`,
    "<p>Preparation draft. Nothing has been submitted. These are planning prompts, not the funder's application questions. Verify the official forms, attachments and limits before use.</p>",
    `<h2>Official source</h2><p><a href="${escape(notice.originalUrl)}">${escape(notice.title)}</a></p>`,
    `<p>${escape(notice.agency)} · Checked ${escape(notice.verifiedAt)}${notice.updatedDate ? ` · Updated ${escape(notice.updatedDate)}` : ""}</p>`,
    `<p>${escape(opportunityValueLabel(notice))}. This is a published award range, not a requested amount or secured funding.</p>`,
    `<p>Deadline: ${escape(notice.deadlineDate ?? "[needs information]")}. Confirm the exact cutoff and time zone in the official notice.</p>`,
    `<h2>Published program summary</h2><p>${excerpt(notice.summary || "[needs information]", 4000)}</p>`,
    `<h2>Published eligibility</h2><p>${excerpt(notice.eligibilityText || "[needs information: read the official notice and attachments]", 4000)}</p>`,
    "<h2>Project and organization</h2><p>[needs information: identify the target resource, applicant, project, community served and supporting evidence]</p>",
    "<h2>Delivery and outcomes</h2><p>[needs information: activities, responsible people, schedule, measurable outcomes and evidence]</p>",
    "<h2>Request and budget</h2><p>[needs information: requested amount, currency, eligible costs, cost sharing and existing funding. Private funding reviews have not been copied into this organization document.]</p>",
    "<h2>Before submitting</h2><ul><li>Check the official application questions, forms, attachments, word limits and submission method.</li><li>Confirm eligibility, registrations, budget, approvals, deadline and supporting documents.</li><li>Review every factual claim and citation. Preparation and saving do not submit an application.</li></ul>",
  ].join("")
  return { title, content }
}
