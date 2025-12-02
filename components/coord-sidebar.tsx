"use client"

import * as React from "react"
import {
  IconInnerShadowTop,
  IconMap,
} from "@tabler/icons-react"
import Link from "next/link"

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
  user: {
    name: "Koordynator",
    email: "coord@example.com",
    avatar: "/avatars/coord.jpg",
  },
  navMain: [
    {
      title: "Wyjazdy",
      url: "/coord",
      icon: IconMap,
    },
  ],
}

export function CoordSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
        <NavUser user={coordData.user} />
      </SidebarFooter>
    </Sidebar>
  )
}

