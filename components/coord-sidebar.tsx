"use client"

import * as React from "react"
import {
  IconMap,
  IconMessage,
  IconUsers,
} from "@tabler/icons-react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

import { NavSimple } from "@/components/nav-simple"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function CoordSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [userData, setUserData] = React.useState<{
    name: string
    email: string
    avatar: string
  } | null>(null)
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
    name: "Koordynator",
    email: "coord@example.com",
    avatar: "",
  }

  const isActive = (url: string) => {
    if (url === "/coord") {
      return pathname === "/coord"
    }
    return pathname?.startsWith(url)
  }

  const navItems = [
    {
      title: "Wyjazdy",
      url: "/coord",
      icon: IconMap,
    },
  ]

  // Na stronie konkretnego wyjazdu pokaż skróty do podstron
  const tripIdMatch = pathname?.match(/^\/coord\/trips\/([^/]+)/)
  const tripId = tripIdMatch?.[1]
  const tripNavItems = tripId
    ? [
        {
          title: "Uczestnicy",
          url: `/coord/trips/${tripId}/participants`,
          icon: IconUsers,
        },
        {
          title: "Wiadomość",
          url: `/coord/trips/${tripId}/message`,
          icon: IconMessage,
        },
      ]
    : []

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="px-2 pt-4 pb-2">
              <Link
                href="/coord"
                className="flex items-center gap-2 hover:opacity-90"
              >
                <Image
                  src="/logo23.png"
                  alt="Magia podróżowania"
                  width={40}
                  height={40}
                  className="size-10 shrink-0 object-contain"
                  priority
                />
                <h2 className="text-xs font-semibold leading-none tracking-tight hover:underline">
                  <span className="block">MAGIA</span>
                  <span className="block mt-0.5">PODRÓŻOWANIA</span>
                </h2>
              </Link>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavSimple
          items={navItems.map((item) => ({
            ...item,
            isActive: isActive(item.url),
          }))}
          label="Menu"
        />
        {tripNavItems.length > 0 && (
          <NavSimple
            items={tripNavItems.map((item) => ({
              ...item,
              isActive: isActive(item.url),
            }))}
            label="Wyjazd"
          />
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={displayUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
