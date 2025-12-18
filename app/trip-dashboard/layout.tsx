import { TripProvider } from "@/contexts/trip-context"
import { TripSidebar } from "@/components/trip-sidebar"
import { PageTitle } from "@/components/page-title"
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
            "transition-[margin] duration-200 ease-linear",
            "md:ml-[var(--sidebar-width)]",
            "md:group-data-[collapsible=icon]/sidebar-wrapper:ml-[var(--sidebar-width-icon)]",
            "md:group-data-[collapsible=offcanvas]/sidebar-wrapper:ml-0"
          )}
        >
          <div className="flex flex-1 flex-col gap-4 p-4">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="flex flex-row items-center gap-2 pb-4">
                <div className="flex flex-1 items-center justify-between gap-2">
                  <PageTitle />
                </div>
              </CardHeader>
              <CardContent className="flex-1">{children}</CardContent>
            </Card>
          </div>
          <Toaster position="top-right" richColors />
        </SidebarInset>
      </SidebarProvider>
    </TripProvider>
  )
}

