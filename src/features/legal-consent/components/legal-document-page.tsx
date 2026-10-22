import Image from "next/image"
import Link from "next/link"

import type { LegalDocument } from "../types"

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  const relatedDocument =
    document.slug === "terms"
      ? { href: "/privacy", label: "Privacy Policy" }
      : { href: "/terms", label: "Terms of Service" }

  return (
    <main
      id="main-content"
      className="bg-background text-foreground flex h-svh min-h-0 flex-col overflow-hidden [--shell-border:var(--border)] [--shell-content-pad:1rem] sm:[--shell-content-pad:1.25rem]"
    >
      <a
        href="#legal-document-content"
        className="bg-background focus-visible:ring-ring sr-only z-50 rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus-visible:ring-2 focus-visible:outline-none"
      >
        Skip to document
      </a>
      <header className="flex min-h-14 shrink-0 items-center px-[var(--shell-content-pad)] py-2">
        <Link
          href="/"
          className="hover:bg-muted focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          aria-label="Coach House home"
        >
          <span className="relative flex size-8 shrink-0 items-center justify-center">
            <Image
              src="/coach-house-logo-light.png"
              alt=""
              width={32}
              height={32}
              className="block dark:hidden"
              priority
            />
            <Image
              src="/coach-house-logo-dark.png"
              alt=""
              width={32}
              height={32}
              className="hidden dark:block"
              priority
            />
          </span>
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate text-base font-bold tracking-tight">
              Coach House
            </span>
            <span className="text-muted-foreground pt-1 text-[10px] font-semibold tracking-[0.18em]">
              ALPHA
            </span>
          </span>
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 px-[var(--shell-content-pad)] pb-[var(--shell-content-pad)]">
        <div
          data-legal-document-canvas=""
          className="bg-background relative flex min-h-0 w-full flex-1 overflow-hidden rounded-[28px] border border-[color:var(--shell-border)] shadow-sm"
        >
          <article
            id="legal-document-content"
            className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain"
          >
            <header className="px-5 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pt-20">
              <div className="mx-auto w-full max-w-5xl">
                <p className="text-muted-foreground text-sm font-medium">
                  Effective {document.effectiveDate} · Version{" "}
                  {document.version}
                </p>
                <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
                  {document.title}
                </h1>
                <p className="text-muted-foreground mt-4 max-w-3xl text-base leading-7 text-pretty sm:text-lg">
                  {document.description}
                </p>
                <nav
                  aria-label={`${document.title} sections`}
                  className="bg-muted/30 border-border/70 mt-10 rounded-2xl border p-5 sm:p-6"
                >
                  <h2 className="text-sm font-semibold">On this page</h2>
                  <ol className="text-muted-foreground mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                    {document.sections.map((section, index) => (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          className="hover:text-foreground focus-visible:ring-ring inline-flex min-h-6 rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {index + 1}. {section.heading}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </div>
            </header>

            <div className="px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
              <div className="mx-auto w-full max-w-4xl">
                <div className="space-y-10">
                  {document.sections.map((section) => (
                    <section key={section.id} aria-labelledby={section.id}>
                      <h2
                        id={section.id}
                        className="scroll-mt-6 text-xl font-semibold text-balance"
                      >
                        {section.heading}
                      </h2>
                      <div className="text-muted-foreground mt-3 space-y-3 leading-7 break-words">
                        {section.body.map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                        {section.items?.length ? (
                          <ul className="list-disc space-y-2 pl-6">
                            {section.items.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </section>
                  ))}
                </div>
                <div className="text-muted-foreground mt-12 flex flex-wrap gap-x-6 gap-y-3 border-t pt-6 text-sm">
                  <Link
                    href="/sign-up"
                    className="text-foreground focus-visible:ring-ring rounded-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    Return to account creation
                  </Link>
                  <Link
                    href={relatedDocument.href}
                    className="text-foreground focus-visible:ring-ring rounded-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    Read the {relatedDocument.label}
                  </Link>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </main>
  )
}
