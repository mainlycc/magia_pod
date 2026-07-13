"use client"

import * as React from "react"
import {
  IconFileDescription,
  IconMail,
  IconReceipt,
  IconReportAnalytics,
  IconSettings,
  IconShieldCheck,
  IconUserPlus,
  IconUsers,
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
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

export function TripSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [userData, setUserData] = React.useState<{
    name: string
    email: string
    avatar: string
  } | null>(null)
  const { role, isRoleLoaded } = useTrip()
  const pathname = usePathname()
  const isCoordinator = role === "coordinator"

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

  const coordinatorAllowedUrls = [
    "/trip-dashboard/publiczny-wyglad",
    "/trip-dashboard/uczestnicy",
  ]

  const allTripNavItems = [
    {
      title: "Informacje ogólne",
      url: "/trip-dashboard/informacje",
      icon: IconSettings,
    },
    {
      title: "Publiczny wygląd",
      url: "/trip-dashboard/publiczny-wyglad",
      icon: IconEdit,
    },
    {
      title: "Formularz",
      url: "/trip-dashboard/informacje/formularz",
      icon: IconFileDescription,
    },
    {
      title: "Wzór umowy",
      url: "/trip-dashboard/umowa",
      icon: IconFileText,
    },
    {
      title: "Ubezpieczenia",
      url: "/trip-dashboard/ubezpieczenia",
      icon: IconShieldCheck,
    },
    {
      title: "Dokumentacja",
      url: "/trip-dashboard/dokumentacja",
      icon: IconFileText,
    },
    {
      title: "Uczestnicy",
      url: "/trip-dashboard/uczestnicy",
      icon: IconUsers,
    },
    {
      title: "Faktury",
      url: "/trip-dashboard/faktury",
      icon: IconReceipt,
    },
  ]

  const tripNavItems = isCoordinator
    ? allTripNavItems.filter((item) => coordinatorAllowedUrls.includes(item.url))
    : allTripNavItems

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
    {
      title: "Panel ubezpieczeń",
      url: "/trip-dashboard/ubezpieczenia-globalne",
      icon: IconShieldCheck,
    },
    {
      title: "Raport umów TFG",
      url: "/trip-dashboard/raport-umow",
      icon: IconReportAnalytics,
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
        </SidebarMenu>
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {/* Menu renderujemy dopiero po ustaleniu roli, żeby koordynator nie widział
            przez moment pełnej listy zakładek. */}
        {isRoleLoaded && (
          <NavSimple
            items={tripNavItems.map((item) => ({
              ...item,
              isActive: isActive(item.url),
            }))}
            label="Wycieczka"
          />
        )}
        {isRoleLoaded && !isCoordinator && (
          <>
            <SidebarSeparator />
            <NavSimple
              items={globalNavItems.map((item) => ({
                ...item,
                isActive: isActive(item.url),
              }))}
              label="Globalne ustawienia"
            />
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={displayUser} />
      </SidebarFooter>
    </Sidebar>
  )
}


