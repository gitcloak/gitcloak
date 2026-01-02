import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Protect all routes under /app
  if (!session?.user || !session.accessToken) {
    redirect('/')
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {children}
    </div>
  )
}
