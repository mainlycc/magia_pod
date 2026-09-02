"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTrip } from "@/contexts/trip-context"
import { appendRegistrationTokenQuery } from "@/lib/trips/registration-access"

export function TripPublicLink() {
  const { selectedTrip, tripFullData } = useTrip()

  if (!selectedTrip) return null

  const href = tripFullData?.registration_token
    ? appendRegistrationTokenQuery(
        `/trip/${selectedTrip.slug}`,
        tripFullData.registration_token,
      )
    : `/trip/${selectedTrip.slug}`

  return (
    <Button asChild variant="outline" size="default">
      <Link
        href={href}
        target="_blank"
        className="inline-flex items-center gap-2"
      >
        Zobacz stronę publiczną
        <ExternalLink className="h-4 w-4" />
      </Link>
    </Button>
  )
}