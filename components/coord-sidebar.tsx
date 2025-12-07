"use client"

import * as React from "react"
import {
  IconInnerShadowTop,
  IconMap,
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

const coordData = {
  navMain: [
    {
      title: "Wyjazdy",
      url: "/coord",
      icon: IconMap,
    },
  ],
}

export function CoordSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
    name: "Koordynator",
    email: "coord@example.com",
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
              <Link href="/coord">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Koordynator</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavSimple items={coordData.navMain} label="Menu" />
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

