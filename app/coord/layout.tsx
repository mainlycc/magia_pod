import { CoordSidebar } from "@/components/coord-sidebar"
import { PageTitle } from "@/components/page-title"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function CoordLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <CoordSidebar />
      <SidebarInset className="transition-[margin] duration-200 ease-linear">
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


