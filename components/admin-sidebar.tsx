"use client"

import * as React from "react"
import {
  IconDashboard,
  IconFileDescription,
  IconInnerShadowTop,
  IconMap,
  IconSettings,
  IconShieldCheck,
  IconUserPlus,
  IconUsers,
  IconWallet,
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

const adminData = {
  user: {
    name: "Admin",
    email: "admin@example.com",
    avatar: "/avatars/admin.jpg",
  },
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
        <NavUser user={adminData.user} />
      </SidebarFooter>
    </Sidebar>
  )
}

