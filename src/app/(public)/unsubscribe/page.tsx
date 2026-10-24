import type { Metadata } from "next"

import { EmailUnsubscribeCard } from "@/features/email-ops"
import { verifyEmailPreferenceToken } from "@/lib/email/preference-tokens"

type SearchParams = Record<string, string | string[] | undefined>

type UnsubscribePageProps = {
  searchParams?: Promise<SearchParams>
}

const TOPIC_LABELS: Record<string, string> = {
  product_updates: "Product updates",
  coaching: "Coaching",
  funding_opportunities: "Funding opportunities",
  events: "Events",
}

export const metadata: Metadata = {
  description: "Manage your Coach House email preferences.",
  title: "Email preferences",
}

export default async function UnsubscribePage({
  searchParams,
}: UnsubscribePageProps) {
  const resolved = searchParams ? await searchParams : {}
  const rawToken = resolved.token
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken
  const verified =
    typeof token === "string" ? await verifyEmailPreferenceToken(token) : null

  return (
    <main className="bg-muted/35 text-foreground grid min-h-screen place-items-center px-4 py-10">
      {verified?.ok && token ? (
        <EmailUnsubscribeCard
          token={token}
          email={verified.payload.email}
          topicLabel={TOPIC_LABELS[verified.payload.topicId] ?? "these emails"}
        />
      ) : (
        <section className="border-border/60 bg-background w-full max-w-md rounded-[1.35rem] border p-5 text-center shadow-sm">
          <p className="text-muted-foreground text-sm font-medium">
            Email preferences
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">
            This link is not available
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            The unsubscribe link is missing, expired, or could not be verified.
            Contact Coach House if you need help updating your preferences.
          </p>
        </section>
      )}
    </main>
  )
}
