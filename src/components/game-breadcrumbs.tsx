'use client'

import { cn } from '@/lib/utils'

type GameStage = 'join' | 'lobby' | 'submitting' | 'quiz' | 'results'

interface GameBreadcrumbsProps {
  currentStage: GameStage
  canNavigate?: boolean
  onNavigate?: (stage: GameStage) => void
}

const stages: { key: GameStage; label: string }[] = [
  { key: 'join', label: 'Join' },
  { key: 'lobby', label: 'Lobby' },
  { key: 'submitting', label: 'Songs' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'results', label: 'Results' },
]

export function GameBreadcrumbs({ currentStage, canNavigate, onNavigate }: GameBreadcrumbsProps) {
  const currentIndex = stages.findIndex(s => s.key === currentStage)

  const handleClick = (stage: GameStage, index: number) => {
    if (!canNavigate || !onNavigate) return
    if (index >= currentIndex) return // Can only go back
    if (stage === 'join') return // Can't navigate to join
    onNavigate(stage)
  }

  return (
    <nav className="flex items-center justify-center gap-1 text-sm mb-6">
      {stages.map((stage, index) => {
        const isActive = stage.key === currentStage
        const isPast = index < currentIndex
        const isFuture = index > currentIndex
        const isClickable = canNavigate && isPast && stage.key !== 'join'

        return (
          <div key={stage.key} className="flex items-center">
            <button
              onClick={() => handleClick(stage.key, index)}
              disabled={!isClickable}
              className={cn(
                'px-3 py-1 rounded-full transition-colors',
                isActive && 'bg-primary text-primary-foreground font-semibold',
                isPast && 'text-primary/70',
                isFuture && 'text-muted-foreground/50',
                isClickable && 'hover:bg-primary/20 cursor-pointer underline underline-offset-2'
              )}
            >
              {stage.label}
            </button>
            {index < stages.length - 1 && (
              <span
                className={cn(
                  'mx-1',
                  isPast ? 'text-primary/50' : 'text-muted-foreground/30'
                )}
              >
                →
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}
