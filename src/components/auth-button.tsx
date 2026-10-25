'use client'

import { Github } from 'lucide-react'
import { signIn, signOut } from 'next-auth/react'
import { useSession } from 'next-auth/react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

export function AuthButton() {
  const { data: session } = useSession()

  if (session?.user) {
    const name = session.user.name || session.user.email || 'User'

    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Avatar className="size-8">
            {session.user.image && (
              <AvatarImage src={session.user.image} alt={name} />
            )}
            <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span>Signed in as {name}</span>
        </div>
        <Button
          variant="destructive"
          size="lg"
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          Sign Out
        </Button>
      </div>
    )
  }

  return (
    <Button size="lg" onClick={() => signIn('github', { callbackUrl: '/app' })}>
      <Github className="size-5" />
      Sign in with GitHub
    </Button>
  )
}
