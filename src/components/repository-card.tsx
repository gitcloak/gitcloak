'use client'

import { Clock, Globe, Lock, BookMarked } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface Repository {
  id: number
  name: string
  fullName: string
  owner: string
  private: boolean
  description: string | null
  updatedAt: string
}

export function RepositoryCard({ repo }: { repo: Repository }) {
  return (
    <Card className="cursor-pointer gap-3 py-4 transition-colors hover:border-primary/40">
      <CardHeader className="px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-base text-gc-accent">
              <BookMarked className="size-4 shrink-0" />
              <span className="truncate">{repo.fullName}</span>
            </CardTitle>
            {repo.description && (
              <CardDescription className="mt-1 line-clamp-2">
                {repo.description}
              </CardDescription>
            )}
          </div>
          <Badge variant="secondary" className="shrink-0 gap-1">
            {repo.private ? <Lock className="size-3" /> : <Globe className="size-3" />}
            {repo.private ? 'Private' : 'Public'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4">
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" />
          Updated: {new Date(repo.updatedAt).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  )
}
