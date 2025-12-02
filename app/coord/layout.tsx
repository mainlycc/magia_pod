import { CoordSidebar } from "@/components/coord-sidebar"
import { PageTitle } from "@/components/page-title"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export default function CoordLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <CoordSidebar />
      <SidebarInset className={cn(
        "transition-[margin] duration-200 ease-linear",
        "md:ml-[var(--sidebar-width)]",
        "md:group-data-[collapsible=icon]/sidebar-wrapper:ml-[var(--sidebar-width-icon)]",
        "md:group-data-[collapsible=offcanvas]/sidebar-wrapper:ml-0"
      )}>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="flex flex-row items-center gap-2 pb-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <PageTitle />
            </CardHeader>
            <CardContent className="flex-1">
              {children}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}


