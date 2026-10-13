"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type FormEvent } from "react"
import ArrowUpRightIcon from "lucide-react/dist/esm/icons/arrow-up-right"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/lib/toast"

import type { PublicMapClaimListingOption } from "../types"

type ClaimListingSearchStatus = "idle" | "loading" | "ready" | "error"

function createSubmissionKey() {
  return crypto.randomUUID()
}

export function PublicMapClaimDialog() {
  const [open, setOpen] = useState(false)
  const [listingQuery, setListingQuery] = useState("")
  const [listingOptions, setListingOptions] = useState<
    PublicMapClaimListingOption[]
  >([])
  const [searchStatus, setSearchStatus] =
    useState<ClaimListingSearchStatus>("idle")
  const [selectedListing, setSelectedListing] =
    useState<PublicMapClaimListingOption | null>(null)
  const [dirty, setDirty] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submissionKeyRef = useRef(createSubmissionKey())

  useEffect(() => {
    const query = listingQuery.trim().toLocaleLowerCase()
    if (query.length < 2 || selectedListing) return

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/public/organization-claims?query=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        )
        const result = (await response.json().catch(() => null)) as {
          listingOptions?: PublicMapClaimListingOption[]
        } | null
        if (!response.ok) throw new Error("Listing search failed.")
        setListingOptions(
          Array.isArray(result?.listingOptions) ? result.listingOptions : []
        )
        setSearchStatus("ready")
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        setListingOptions([])
        setSearchStatus("error")
      }
    }, 200)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [listingQuery, selectedListing])

  function begin() {
    setListingQuery("")
    setListingOptions([])
    setSearchStatus("idle")
    setSelectedListing(null)
    setDirty(false)
    submissionKeyRef.current = createSubmissionKey()
    setOpen(true)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && dirty && !window.confirm("Discard this request?")) return
    setOpen(nextOpen)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    if (!form.reportValidity()) return
    if (!selectedListing) {
      form.querySelector<HTMLInputElement>("#claim-listing-search")?.focus()
      return
    }

    const formData = new FormData(form)
    setSubmitting(true)
    try {
      const response = await fetch("/api/public/organization-claims", {
        body: JSON.stringify({
          claimantEmail: formData.get("claimantEmail"),
          claimantName: formData.get("claimantName"),
          listingName: selectedListing.name,
          message: formData.get("message"),
          submissionKey: submissionKeyRef.current,
          targetId: selectedListing.id,
          targetKind: "resource_map_organization",
          website: formData.get("website"),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
      const result = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      if (!response.ok) {
        toast.error(result?.error ?? "Unable to send the request.", {
          closeButton: true,
        })
        return
      }

      setDirty(false)
      setOpen(false)
      form.reset()
      setSelectedListing(null)
      submissionKeyRef.current = createSubmissionKey()
      toast.success(
        "Request received. We’ll review the listing and contact you.",
        {
          closeButton: true,
          duration: Number.POSITIVE_INFINITY,
        }
      )
    } catch {
      toast.error("Unable to send the request.", { closeButton: true })
    } finally {
      setSubmitting(false)
    }
  }

  const showSearchStatus = listingQuery.trim().length >= 2 && !selectedListing
  const noSearchResults =
    searchStatus === "ready" && listingOptions.length === 0

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full flex-col gap-0.5 rounded-xl py-4 text-center whitespace-normal"
        onClick={begin}
      >
        <span className="text-muted-foreground text-xs">
          Have an NFP listed on Coach House?
        </span>
        <span className="flex items-center gap-1 text-xs font-medium">
          Claim or manage it
          <ArrowUpRightIcon aria-hidden className="size-3.5" />
        </span>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[min(44rem,calc(100dvh-2rem))] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Claim a listing</DialogTitle>
            <DialogDescription>
              Request access to an imported public listing. Coach House verifies
              each request before changing ownership.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onChange={() => setDirty(true)}
            onSubmit={handleSubmit}
          >
            <div className="grid gap-2">
              <Label htmlFor="claim-listing-search">Nonprofit</Label>
              <Input
                id="claim-listing-search"
                value={selectedListing?.name ?? listingQuery}
                onChange={(event) => {
                  const query = event.target.value
                  setSelectedListing(null)
                  setListingOptions([])
                  setListingQuery(query)
                  setSearchStatus(query.trim().length >= 2 ? "loading" : "idle")
                }}
                autoComplete="off"
                maxLength={80}
                placeholder="Search listings…"
                required
              />
              {listingOptions.length > 0 && !selectedListing ? (
                <div className="bg-popover grid max-h-48 overflow-y-auto rounded-md border p-1 shadow-sm">
                  {listingOptions.map((listing) => (
                    <button
                      key={listing.id}
                      type="button"
                      className="hover:bg-accent focus-visible:bg-accent min-h-11 truncate rounded-sm px-2 text-left text-sm outline-none"
                      onClick={() => {
                        setSelectedListing(listing)
                        setListingQuery(listing.name)
                        setSearchStatus("idle")
                      }}
                    >
                      {listing.name}
                    </button>
                  ))}
                </div>
              ) : null}
              {showSearchStatus &&
              (searchStatus === "loading" ||
                searchStatus === "error" ||
                noSearchResults) ? (
                <div className="grid gap-1" role="status">
                  <p className="text-muted-foreground text-xs">
                    {searchStatus === "loading"
                      ? "Searching imported listings…"
                      : searchStatus === "error"
                        ? "Unable to search listings. Try again."
                        : "No claimable listing found."}
                  </p>
                  {noSearchResults ? (
                    <Link
                      href="/sign-up?intent=build&source=find_claim"
                      className="text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                      onClick={() => setDirty(false)}
                    >
                      Create your nonprofit on Coach House
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="claim-name">Your name</Label>
              <Input
                id="claim-name"
                name="claimantName"
                minLength={2}
                maxLength={120}
                autoComplete="name"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="claim-email">Email</Label>
              <Input
                id="claim-email"
                name="claimantEmail"
                type="email"
                maxLength={254}
                autoComplete="email"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="claim-message">Message</Label>
              <Textarea
                id="claim-message"
                name="message"
                maxLength={2000}
                rows={4}
                placeholder="Tell us how you’re connected to this nonprofit."
              />
            </div>
            <div className="absolute -left-[10000px]" aria-hidden="true">
              <Label htmlFor="claim-website">Website</Label>
              <Input
                id="claim-website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Sending…" : "Send request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
