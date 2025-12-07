"use client"

import * as React from "react"
import {
  IconDashboard,
  IconFileDescription,
  IconInnerShadowTop,
  IconMap,
  IconReceipt,
  IconSettings,
  IconShieldCheck,
  IconUserPlus,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

import { NavSimple } from "@/components/nav-simple"
import { NavUser } from "@/components/nav-user"
import { ThemeSwitcher } from "@/components/theme-switcher"
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

const adminData = {
  navMain: [
    {
      title: "Dashboard",
      url: "/admin",
      icon: IconDashboard,
    },
    {
      title: "Wycieczki",
      url: "/admin/trips",
      icon: IconMap,
    },
    {
      title: "Rezerwacje i Umowy",
      url: "/admin/bookings",
      icon: IconFileDescription,
    },
    {
      title: "Płatności",
      url: "/admin/payments",
      icon: IconWallet,
    },
    {
      title: "Faktury",
      url: "/admin/faktury",
      icon: IconReceipt,
    },
    {
      title: "Ubezpieczenia",
      url: "/admin/insurance",
      icon: IconShieldCheck,
    },
    {
      title: "Uczestnicy",
      url: "/admin/uczestnicy",
      icon: IconUsers,
    },
    {
      title: "Zaproszenia koordynatorów",
      url: "/admin/coordinators/invite",
      icon: IconUserPlus,
    },
    {
      title: "Przykład",
      url: "/admin/przyklad",
      icon: IconSettings,
    },
  ],
}

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [userData, setUserData] = React.useState<{
    name: string
    email: string
    avatar: string
  } | null>(null)

  React.useEffect(() => {
    const loadUserData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const name = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || 'Użytkownik'
        const email = user.email || ''
        const avatar = user.user_metadata?.avatar_url || ''
        
        setUserData({
          name,
          email,
          avatar,
        })
      }
    }
    
    loadUserData()
  }, [])

  // Fallback do przykładowych danych jeśli jeszcze nie załadowano
  const displayUser = userData || {
    name: "Admin",
    email: "admin@example.com",
    avatar: "",
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/admin" className="flex w-full justify-center">
                <span className="text-lg font-semibold text-center">
                  Magia podróżowania
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavSimple items={adminData.navMain} label="Menu" />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-center p-2">
          <ThemeSwitcher />
        </div>
        <SidebarSeparator />
        <NavUser user={displayUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

