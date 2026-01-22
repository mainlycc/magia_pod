"use client"

import * as React from "react"
import {
  IconFileDescription,
  IconMail,
  IconReceipt,
  IconSettings,
  IconShieldCheck,
  IconUserPlus,
  IconUsers,
  IconWallet,
  IconEdit,
  IconPlus,
  IconFileText,
} from "@tabler/icons-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useTrip } from "@/contexts/trip-context"

import { NavSimple } from "@/components/nav-simple"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

export function TripSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [userData, setUserData] = React.useState<{
    name: string
    email: string
    avatar: string
  } | null>(null)
  const { selectedTrip, setSelectedTrip, trips } = useTrip()
  const pathname = usePathname()

  React.useEffect(() => {
    const loadUserData = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const name =
          (user.user_metadata?.full_name as string) ||
          user.email?.split("@")[0] ||
          "Użytkownik"
        const email = user.email || ""
        const avatar = user.user_metadata?.avatar_url || ""

        setUserData({
          name,
          email,
          avatar,
        })
      }
    }

    loadUserData()
  }, [])

  const displayUser = userData || {
    name: "Admin",
    email: "admin@example.com",
    avatar: "",
  }

  const isActive = (url: string) => {
    if (url === "/trip-dashboard") {
      return pathname === "/trip-dashboard"
    }
    return pathname?.startsWith(url)
  }

  const tripNavItems = [
    {
      title: "Informacje ogólne",
      url: "/trip-dashboard/informacje",
      icon: IconSettings,
    },
    {
      title: "Formularz",
      url: "/trip-dashboard/informacje/formularz",
      icon: IconFileDescription,
    },
    {
      title: "Edycja publicznego wyglądu",
      url: "/trip-dashboard/publiczny-wyglad",
      icon: IconEdit,
    },
    {
      title: "Rezerwacje i Umowy",
      url: "/trip-dashboard/rezerwacje",
      icon: IconFileDescription,
    },
    {
      title: "Płatności",
      url: "/trip-dashboard/platnosci",
      icon: IconWallet,
    },
    {
      title: "Faktury",
      url: "/trip-dashboard/faktury",
      icon: IconReceipt,
    },
    {
      title: "Ubezpieczenia",
      url: "/trip-dashboard/ubezpieczenia",
      icon: IconShieldCheck,
    },
    {
      title: "Uczestnicy",
      url: "/trip-dashboard/uczestnicy",
      icon: IconUsers,
    },
    {
      title: "Dokumentacja",
      url: "/trip-dashboard/dokumentacja",
      icon: IconFileText,
    },
  ]

  const globalNavItems = [
    {
      title: "Dodaj wycieczkę",
      url: "/trip-dashboard/dodaj-wycieczke",
      icon: IconPlus,
    },
    {
      title: "Zaproszenia koordynatorów",
      url: "/trip-dashboard/zaproszenia-koordynatorow",
      icon: IconUserPlus,
    },
    {
      title: "Komunikacja masowa",
      url: "/trip-dashboard/komunikacja-masowa",
      icon: IconMail,
    },
    {
      title: "Dokumenty",
      url: "/trip-dashboard/dokumenty",
      icon: IconFileText,
    },
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="px-2 pt-4 pb-2">
              <Link href="/trip-dashboard">
                <h2 className="text-base font-semibold text-center hover:underline">
                  Magia podróżowania
                </h2>
              </Link>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="flex w-full items-center px-2 pb-2 min-w-0 max-w-full overflow-hidden">
              <div
                className="flex-1 min-w-0 max-w-full overflow-hidden"
                style={{ width: 0 }}
              >
                <NativeSelect
                  size="default"
                  className="w-full max-w-full text-sm font-semibold"
                  value={selectedTrip?.id || ""}
                  onChange={(e) => {
                    const value = e.target.value
                    const trip = trips.find((t) => t.id === value)
                    if (trip) {
                      setSelectedTrip(trip)
                    }
                  }}
                >
                  <NativeSelectOption value="">
                    Wybierz wycieczkę
                  </NativeSelectOption>
                  {trips.map((trip) => (
                    <NativeSelectOption key={trip.id} value={trip.id}>
                      {trip.title}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavSimple
          items={tripNavItems.map((item) => ({
            ...item,
            isActive: isActive(item.url),
          }))}
          label="Wycieczka"
        />
        <SidebarSeparator />
        <NavSimple
          items={globalNavItems.map((item) => ({
            ...item,
            isActive: isActive(item.url),
          }))}
          label="Globalne ustawienia"
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={displayUser} />
      </SidebarFooter>
    </Sidebar>
  )
}


