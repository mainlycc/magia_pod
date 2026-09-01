import { CoordSidebar } from "@/components/coord-sidebar"
import { PageTitle } from "@/components/page-title"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"

export default function CoordLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <CoordSidebar />
      <SidebarInset className="transition-[margin] duration-200 ease-linear min-h-0 h-svh overflow-hidden">
        <div className="flex flex-1 flex-col gap-4 p-4 min-w-0 min-h-0 h-full overflow-hidden">
          <Card className="flex-1 flex flex-col min-w-0 min-h-0">
            <CardHeader
              data-coord-dashboard-header
              className="flex flex-row items-center gap-2 pb-4 shrink-0"
            >
              <div className="flex flex-1 items-center justify-between gap-2">
                <PageTitle />
              </div>
            </CardHeader>
            <CardContent
              data-coord-dashboard-content
              className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden"
            >
              {children}
            </CardContent>
          </Card>
        </div>
        <Toaster position="top-right" richColors />
      </SidebarInset>
    </SidebarProvider>
  )
}
