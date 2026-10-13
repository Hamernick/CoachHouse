"use client"

import { CommunityJoinCards } from "@/components/community/community-join-cards"

export function CommunityStep() {
  return (
    <div className="space-y-5 py-5" data-onboarding-step-id="community">
      <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
        <CommunityJoinCards
          compact
          title="Find your people"
          description="Ask a question, share what you’re building, or come back when you’re ready. Joining is optional."
        />
      </div>
    </div>
  )
}
