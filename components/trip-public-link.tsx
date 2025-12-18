"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { useTrip } from "@/contexts/trip-context"

export function TripPublicLink() {
  const { selectedTrip } = useTrip()

  if (!selectedTrip) return null

  return (
    <Link
      href={`/trip/${selectedTrip.slug}`}
      target="_blank"
      className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
    >
      Zobacz stronę publiczną
      <ExternalLink className="h-3 w-3" />
    </Link>
  )
}