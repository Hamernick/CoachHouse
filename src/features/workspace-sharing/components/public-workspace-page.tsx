import { OrganizationFormIntake } from "@/features/organization-forms/client"
import ReactMarkdown, { defaultUrlTransform } from "react-markdown"
import remarkGfm from "remark-gfm"
import ExternalLinkIcon from "lucide-react/dist/esm/icons/external-link"
import CalendarIcon from "lucide-react/dist/esm/icons/calendar-days"
import MapPinIcon from "lucide-react/dist/esm/icons/map-pin"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { WorkspaceNodeFrameRoot, WorkspaceNodeFrameHeader, WorkspaceNodeFrameBody } from "@/components/workspace/workspace-node-frame"
import type { WorkspacePageSnapshot } from "../types"
import { cn } from "@/lib/utils"
import { PublicEventTime } from "./public-event-time"
import { PublicPageDocument } from "./public-page-document"
import { PublicPageImage } from "./public-page-image"
import { pageBrandStyle } from "../lib/page-brand"

type AssetPresentation = { interactiveForms?: boolean; documentPreviews?: Record<string, string>; imagePreviews?: Record<string, string>; imageAudience?: "public" | "guest" | "editor" }
type PublicItem = WorkspacePageSnapshot["items"][number]
function PublicParticleContent({ content, locale, embedded, formId, organization, interactiveForms, documentPreviews, imagePreviews, imageAudience = "public" }: { content: PublicItem["content"]; formId: string; organization: string; locale?: string; embedded: boolean } & AssetPresentation) {
  const NoteHeading = embedded ? "h4" : "h3"
  switch (content.kind) {
    case "text": return null
    case "notes": return (
      <div className="prose prose-sm dark:prose-invert max-w-none break-words prose-headings:break-words prose-a:break-all">
        <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml
          urlTransform={(url) => {
            const safe = defaultUrlTransform(url)
            return /^(https?:|mailto:|#)/i.test(safe) ? safe : ""
          }}
          components={{
            h1: ({ children }) => <NoteHeading>{children}</NoteHeading>,
            h2: ({ children }) => <NoteHeading>{children}</NoteHeading>,
            img: ({ alt }) => <span>{alt}</span>,
            a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
            table: ({ children }) => <div className="focus-ring overflow-x-auto rounded-lg" tabIndex={0} role="region" aria-label="Notes table"><table>{children}</table></div>,
          }}
        >{content.markdown}</ReactMarkdown>
      </div>
    )
    case "drive_link": return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <a className={cn(buttonVariants({ variant: "outline" }), "h-auto min-h-11 min-w-0 max-w-full whitespace-normal rounded-full gap-2 shadow-none transition-colors motion-reduce:transition-none")}
          href={content.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
          <span className="min-w-0 break-words">Open in Google Drive</span> <ExternalLinkIcon className="size-3.5" aria-hidden />
        </a>
        <span className="text-muted-foreground text-xs">Google sign-in may be required.</span>
      </div>
    )
    case "event": return (
      <dl className="flex flex-col gap-2 text-sm">
        {content.startsAt && <div className="flex items-center gap-2"><dt className="sr-only">When</dt><CalendarIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <dd className="min-w-0 break-words"><PublicEventTime value={content.startsAt} locale={locale} /></dd>
        </div>}
        {content.location && <div className="flex items-start gap-2"><dt className="sr-only">Where</dt><MapPinIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden /><dd className="min-w-0 break-words">{content.location}</dd></div>}
      </dl>
    )
    case "color": return <div className="flex items-center gap-2"><span className="size-6 rounded-full border border-border/60" style={{ backgroundColor: content.hex }} aria-hidden /><span className="font-mono text-sm">{content.hex}</span></div>
    case "form": return interactiveForms && content.intakeVersionId ? <OrganizationFormIntake key={content.intakeVersionId} formId={formId} versionId={content.intakeVersionId} definition={content.definition} organization={organization} audience={imageAudience === "guest" ? "guest" : "public"} /> : <div><p className="text-muted-foreground mb-2 text-xs">Form preview</p><ol className="divide-border/60 divide-y divide-dashed">{content.definition.questions.map((question) => <li key={question.id} className="py-3 first:pt-0 last:pb-0"><p className="break-words text-sm">{question.label}{question.required && <span className="text-muted-foreground" aria-label="required"> *</span>}</p>{"options" in question && <ul className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">{question.options.map((option) => <li key={option}>{option}</li>)}</ul>}</li>)}</ol></div>
    case "image": {
      const src = imagePreviews?.[content.assetId] ?? `/api/public/workspace-page-assets/${content.assetId}?audience=${imageAudience}`
      return <PublicPageImage key={src} src={src} alt={content.alt} width={content.width} height={content.height} />
    }
    case "document": {
      const src = documentPreviews?.[content.assetId] ?? `/api/public/workspace-page-documents/${content.assetId}?audience=${imageAudience}`
      return <PublicPageDocument key={src} src={src} name={content.name} />
    }
  }
}

/** Server-rendered shared frame anatomy. No React Flow, editor, iframe or
 * provider SDK is needed to read a branded page. */
export function PublicWorkspacePage({ snapshot, locale, embedded = false, interactiveForms = !embedded, documentPreviews, imagePreviews, imageAudience }: { snapshot: WorkspacePageSnapshot; locale?: string; embedded?: boolean } & AssetPresentation) {
  const Root = embedded ? "div" : "main"
  const BrandHeading = embedded ? "h2" : "h1"
  const ContentHeading = embedded ? "h3" : "h2"
  return <Root aria-label={embedded ? "Public page preview" : undefined} className={cn("mx-auto flex w-full max-w-[46rem] flex-col gap-6 px-4 sm:px-6", embedded ? "py-4" : "min-h-svh pt-10 pb-[max(2rem,env(safe-area-inset-bottom))] sm:pt-16")}>
    <header className="flex min-w-0 flex-col gap-4 px-1">
      <div className="flex min-w-0 items-center gap-3">
        <span className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-medium" style={pageBrandStyle(snapshot.brand.primaryColor)} aria-hidden>{snapshot.brand.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()}</span>
        <BrandHeading className="min-w-0 break-words text-xl font-semibold tracking-tight sm:text-2xl">{snapshot.brand.name}</BrandHeading>
      </div>
      {(snapshot.title || snapshot.description) && <div className="flex flex-col gap-2">{snapshot.title && <ContentHeading className="break-words text-lg font-medium">{snapshot.title}</ContentHeading>}{snapshot.description && <p className="text-muted-foreground whitespace-pre-wrap break-words text-sm leading-relaxed">{snapshot.description}</p>}</div>}
    </header>
    <section aria-label="Shared Particles" className="flex min-w-0 flex-col gap-3">
      {snapshot.items.map((item) => <WorkspaceNodeFrameRoot key={item.id} aria-label={item.title} className="bg-muted flex min-w-0 flex-col gap-0 rounded-[28px] px-0.5 pt-0 pb-0.5 shadow-none">
        <WorkspaceNodeFrameHeader className="items-center px-4 py-3"><ContentHeading id={embedded ? undefined : `particle-${item.id}`} className="min-w-0 break-words text-sm font-medium">{item.title}</ContentHeading></WorkspaceNodeFrameHeader>
        {(item.description || item.content.kind !== "text") && <WorkspaceNodeFrameBody className="bg-card flex min-w-0 flex-col gap-3 rounded-[25px] p-4 sm:p-5">{item.description && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.description}</p>}<PublicParticleContent content={item.content} formId={item.id} organization={snapshot.brand.name} interactiveForms={interactiveForms} locale={locale} embedded={embedded} documentPreviews={documentPreviews} imagePreviews={imagePreviews} imageAudience={imageAudience} /></WorkspaceNodeFrameBody>}
      </WorkspaceNodeFrameRoot>)}
    </section>
  </Root>
}

export function PublicWorkspacePageLoading() {
  return <main className="mx-auto flex min-h-svh w-full max-w-[46rem] flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16" aria-busy="true" aria-label="Loading shared page">
    <span className="sr-only" role="status">Loading shared page…</span>
    <Skeleton className="h-11 w-56 max-w-full rounded-xl motion-reduce:animate-none" />
    {[0, 1, 2].map((index) => <Skeleton key={index} className="h-40 w-full rounded-[28px] motion-reduce:animate-none" />)}
  </main>
}
