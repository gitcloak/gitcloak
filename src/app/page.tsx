'use client'

import { useEffect } from 'react'
import {
  Github,
  KeyRound,
  Layers,
  ShieldCheck,
  WifiOff,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { AuthButton } from '@/components/auth-button'
import { LandingBackground } from '@/components/landing-background'
import { SpotlightLogo } from '@/components/spotlight-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const MOCK_BACKEND = process.env.NEXT_PUBLIC_MOCK_BACKEND === '1'

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Client-side encryption',
    description: 'Files are encrypted with the age format in your browser.',
  },
  {
    icon: KeyRound,
    title: 'Zero-knowledge',
    description: 'Your encryption key never leaves your browser.',
  },
  {
    icon: Layers,
    title: 'GitHub OAuth',
    description: 'Sign in with GitHub — no separate account to manage.',
  },
  {
    icon: WifiOff,
    title: 'No vendor lock-in',
    description: 'Plain .age files in your own repositories.',
  },
]

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // If user is already signed in, redirect to app
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // The mock backend always seeds a signed-in session, which would hide
      // this page from the end-to-end suite. `?stay=1` is honoured in mock
      // builds only, so production keeps the redirect untouched.
      if (MOCK_BACKEND && new URLSearchParams(window.location.search).has('stay')) {
        return
      }
      router.push('/app')
    }
  }, [status, session, router])

  if (status === 'loading') {
    return null // or a loading spinner
  }

  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-hidden">
      <LandingBackground />
      <header className="relative z-10 flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="size-4" />
          </span>
          <span className="text-lg font-bold tracking-tight">GitCloak</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/gitcloak/gitcloak"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View GitCloak on GitHub"
          >
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1">
              <Github className="size-3.5" />
              <span className="hidden sm:inline">Open source</span>
              <span className="sm:hidden">GitHub</span>
            </Badge>
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-12 px-4 py-12 sm:px-8 sm:py-16">
        <div className="flex max-w-2xl flex-col items-center gap-6 text-center">
          <Badge variant="secondary">Encrypted markdown for GitHub</Badge>
          <SpotlightLogo />
          <p className="text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Secure, encrypted markdown editing for GitHub repositories.
          </p>
          <div className="pt-2">
            <AuthButton />
          </div>
          <p className="text-sm text-muted-foreground">
            Your encryption key never leaves your browser
          </p>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="gap-2 py-5">
              <CardContent className="flex flex-col gap-2 px-5">
                <feature.icon className="size-5 text-primary" />
                <h2 className="text-sm font-semibold">{feature.title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          GitCloak is an open source project ·{' '}
          <a
            href="https://github.com/gitcloak/gitcloak"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-4"
          >
            View on GitHub
          </a>
        </p>
      </main>
    </div>
  )
}
