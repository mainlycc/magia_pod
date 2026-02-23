"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTrip } from "@/contexts/trip-context"

export function TripPublicLink() {
  const { selectedTrip } = useTrip()

  if (!selectedTrip) return null

  return (
    <Button asChild variant="outline" size="default">
      <Link
        href={`/trip/${selectedTrip.slug}`}
        target="_blank"
        className="inline-flex items-center gap-2"
      >
        Zobacz stronę publiczną
        <ExternalLink className="h-4 w-4" />
      </Link>
    </Button>
  )
}