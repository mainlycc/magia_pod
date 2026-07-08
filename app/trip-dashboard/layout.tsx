import { TripProvider } from "@/contexts/trip-context"
import { PageTitle } from "@/components/page-title"
import { TripSidebar } from "@/components/trip-sidebar"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

export default function TripDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TripProvider>
      <SidebarProvider>
        <TripSidebar />
        <SidebarInset
          className={cn(
            "transition-[margin] duration-200 ease-linear min-h-0 h-svh overflow-hidden",
            "md:ml-[var(--sidebar-width)]",
            "md:group-data-[collapsible=icon]/sidebar-wrapper:ml-[var(--sidebar-width-icon)]",
            "md:group-data-[collapsible=offcanvas]/sidebar-wrapper:ml-0"
          )}
        >
          <div className="flex flex-1 flex-col gap-4 p-4 min-w-0 min-h-0 h-full overflow-hidden">
            <Card className="flex-1 flex flex-col min-w-0 min-h-0">
              <CardHeader
                data-trip-dashboard-header
                className="flex flex-row items-center gap-2 pb-4 shrink-0"
              >
                <div className="flex flex-1 items-center justify-between gap-2">
                  <PageTitle />
                </div>
              </CardHeader>
              <CardContent
                data-trip-dashboard-content
                className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden"
              >
                {children}
              </CardContent>
            </Card>
          </div>
          <Toaster position="top-right" richColors />
        </SidebarInset>
      </SidebarProvider>
    </TripProvider>
  )
}

