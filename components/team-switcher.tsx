"use client"

import * as React from "react"
import { ChevronsUpDown, MapPin, Plus } from "lucide-react"
import Link from "next/link"

import { useTrip } from "@/contexts/trip-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

function formatTripDates(
  startDate: string | null,
  endDate: string | null
): string {
  if (!startDate) {
    return "Brak daty"
  }

  const format = (date: string) =>
    new Date(date).toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })

  if (!endDate) {
    return format(startDate)
  }

  return `${format(startDate)} – ${format(endDate)}`
}

export function TeamSwitcher() {
  const { isMobile } = useSidebar()
  const { selectedTrip, setSelectedTrip, trips, role } = useTrip()
  const isCoordinator = role === "coordinator"

  const activeTrip = selectedTrip ?? trips[0] ?? null

  if (trips.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="cursor-default">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <MapPin className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Brak wycieczek</span>
              <span className="truncate text-xs text-muted-foreground">
                Dodaj pierwszą wycieczkę
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <MapPin className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeTrip?.title ?? "Wybierz wycieczkę"}
                </span>
                <span className="truncate text-xs">
                  {activeTrip
                    ? formatTripDates(activeTrip.start_date, activeTrip.end_date)
                    : "Wybierz z listy"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Wycieczki
            </DropdownMenuLabel>
            {trips.map((trip) => (
              <DropdownMenuItem
                key={trip.id}
                onClick={() => setSelectedTrip(trip)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <MapPin className="size-3.5 shrink-0" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">{trip.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {formatTripDates(trip.start_date, trip.end_date)}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
            {!isCoordinator && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="gap-2 p-2">
                  <Link href="/trip-dashboard/dodaj-wycieczke">
                    <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                      <Plus className="size-4" />
                    </div>
                    <div className="font-medium text-muted-foreground">
                      Dodaj wycieczkę
                    </div>
                  </Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
