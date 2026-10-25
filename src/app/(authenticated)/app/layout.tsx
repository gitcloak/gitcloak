import { redirect } from "next/navigation"

import { SidebarProvider } from "@/components/ui/sidebar"
import { getSession } from "@/lib/session"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  // Protect all routes under /app
  if (!session?.user || !session.accessToken) {
    redirect('/')
  }

  return (
    // `SidebarProvider` owns the responsive shell: on desktop it renders the
    // sidebar inline (collapsible with ⌘B / the trigger), below `md` it swaps
    // the same sidebar into an off-canvas `Sheet`. `h-svh` + `overflow-hidden`
    // pin the shell to the viewport so only the panes inside scroll.
    <SidebarProvider className="h-svh overflow-hidden">
      {children}
    </SidebarProvider>
  )
}
