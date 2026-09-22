import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { cache } from "react"

import {
  MarketplacePersonPage,
  marketplacePersonHref,
  decodeMarketplacePersonHandle,
} from "@/features/nonprofit-documentation"
import { fetchPublicPersonByHandle } from "@/lib/queries/public-people"

type Props = { params: Promise<{ handle: string }> }
const loadPerson = cache(fetchPublicPersonByHandle)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const handle = decodeMarketplacePersonHandle((await params).handle)
  const person = await loadPerson(handle)
  if (!person) return { title: "Person not found", robots: { index: false } }
  const path = marketplacePersonHref(person.handle)
  const description =
    person.headline ?? `Meet ${person.name} in the Coach House community.`
  return {
    title: `${person.name} · Marketplace people`,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: person.name,
      description,
      type: "profile",
      url: `https://coachhouse.app${path}`,
    },
  }
}

export default async function MarketplacePersonRoute({ params }: Props) {
  const handle = decodeMarketplacePersonHandle((await params).handle)
  const person = await loadPerson(handle)
  if (!person) notFound()
  if (handle !== `@${person.handle}`)
    redirect(marketplacePersonHref(person.handle))
  return <MarketplacePersonPage person={person} />
}
