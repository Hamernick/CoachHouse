# AUDIT-001: public trust and indexing verification

Observed 2026-10-13 13:38–13:40 UTC. Read-only preparation while SHIP-000 remains
blocked; no new release claim, website implementation, data mutation or publication.
Source base: main `ce1436a2`. Original plan inputs: packet09 stage1, packet05 stage1,
packet03 stage3, plus WORKSTREAMS.md and the original outside-audit handoff. Full
packets, decisions and boundaries were read; private source text is not copied here.

## Findings

| Source finding | Current evidence | Result / owner |
| --- | --- | --- |
| handoff:1.1, community placeholder/indexing | [Live community route](https://coachhouse.app/community) returns HTTP200 with a streamed Next redirect and meta refresh to `/login?redirect=%2Fcommunity`. Its initial text is only the loading brand; the old scaffold description remains. [Sitemap](https://coachhouse.app/sitemap.xml) includes `/community`. Source implements real community content behind an authentication/feature gate. | **Corrected:** login-gated content advertised in a public sitemap, not proof of an unimplemented community page. Owner09/01. |
| handoff:1.2, reported test profiles | The sitemap includes `/testing123-886455`, `/na`, `/caleb`; each route returns200 with `robots=index, follow`. However, the source sitemap already filters both person and organization records by `is_public=true`. | **Confirmed exposure; corrected cause:** investigate publication intent and data before removing anything. Slug names alone do not establish test status or financial-data exposure. Owner05; launch verification02. |
| handoff:1.6, fiscal fee/model disclosure | [Fiscal page](https://coachhouse.app/documentation/fiscal-sponsorship) and [pricing](https://coachhouse.app/pricing) omit the handoff's7% fee. The fiscal overview explains sponsor/project roles, and its collapsed accordion has Model C text in source. Anonymous form still displays submissions-disabled preview copy. | **Fee omission confirmed; model is not wholly absent.** Owner03 for approved terms,09/06 for presentation. No intake activation implied. |

## Source locations

- `src/app/sitemap.ts:28`: unconditional community sitemap entry.
- `src/app/(community)/community/page.tsx:25`: anonymous authentication gate when public sharing is disabled.
- `src/app/layout.tsx:18`: inherited scaffold description.
- `src/lib/queries/public-profile-sitemap.ts:54`: publication queries; both branches filter `is_public=true`.
- `src/features/organization-launch/server/publication-actions.ts:12`: existing publication feature gate and reviewed revision check.
- `src/features/fiscal-sponsorship/components/fiscal-sponsorship-overview.tsx:33`: visible sponsor role; line44 includes Model C explanation in accordion content.

## Smallest proposed correction

1. Community: exclude the login-gated route from the public sitemap and give it explicit page metadata/noindex while retaining its member route and invitations. Add focused coverage for the intended public/authenticated behavior. Do not delete the route or enable public sharing as an SEO fix.
2. Profiles: establish which reported records are intended public profiles versus demos. Use the existing publication controls for verified demo records, then confirm sitemap, profile metadata and cached public projections agree. If a distinct demo/approval policy is required, apply a shared predicate across those surfaces; do not introduce a slug blacklist or invent badge policy.
3. Fiscal: show the approved sponsorship percentage and fee basis near the explanation of sponsor roles; distinguish sponsor fees from processing costs. Use the existing Model C explanation. Confirm the current fee basis/exceptions from approved terms before final copy; do not publish the handoff's broad “no hidden costs” or universal tax-deduction claims without supporting policy. No in-app ledger, payout work, provider changes or intake activation.

Website implementation/publication remains subject to the original handoff boundary.
This report makes that review concrete; it is not a request to release tooling or a
claim that any application fix has shipped. Authenticated community rendering and
profile-owner intent were not tested. Search-engine crawl/index status is unknown;
a sitemap entry and index directive establish eligibility, not actual indexing.

## Evidence retention

Local raw public responses: `/tmp/coachhouse-public-audit-20261013/`; these are
convenience captures, not a permanent private backup. Public response hashes below
identify this observation; later responses may differ. No credentials or private
account data were fetched.

- https://coachhouse.app/community — SHA256 `3221505bbdcf9f69f3152960357fd4a050de9b7943489a5bdf57b782b5be3d80`
- https://coachhouse.app/sitemap.xml — SHA256 `5fd8fb3ce1ff049c6346d7f2c4d0ca82ffa48ee2b81ddac035f24861e73c47ad`
- https://coachhouse.app/documentation/fiscal-sponsorship — SHA256 `eb98e5d56e74b38b6495cbedda2b588eb0796ea4c311f62695f97486c43b2fd9`
- https://coachhouse.app/pricing — SHA256 `ef29b2dd5c00a56faec6056f79a4de7e9b8fd8c6adf203dc923c58b8b3ecb8b9`
