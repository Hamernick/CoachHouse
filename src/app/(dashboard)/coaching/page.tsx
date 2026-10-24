import type { Metadata } from "next"
import { CoachingBookingPage } from "@/features/coaching-booking"

export const metadata: Metadata = {
  title: "Coaching",
  description: "Schedule coaching sessions and review your bookings.",
}


type CoachingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function CoachingPage({ searchParams }: CoachingPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  return <CoachingBookingPage searchParams={resolvedSearchParams} />
}
