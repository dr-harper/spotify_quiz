'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { GameSettings } from '@/types/database'
import { DEFAULT_GAME_SETTINGS } from '@/types/database'

interface QuizIntroProps {
  settings: GameSettings | null
  isHost: boolean
  onStart: () => void
}

interface Phase {
  emoji: string
  title: string
  description: string
  enabled: boolean
}

export function QuizIntro({ settings, isHost, onStart }: QuizIntroProps) {
  const gameSettings = settings || DEFAULT_GAME_SETTINGS

  const phases: Phase[] = [
    {
      emoji: '🎵',
      title: 'Round 1',
      description: 'Listen to songs and guess who picked them',
      enabled: true,
    },
    {
      emoji: '🧠',
      title: 'Trivia',
      description: 'Test your Christmas music knowledge',
      enabled: gameSettings.triviaEnabled,
    },
    {
      emoji: '🎶',
      title: 'Round 2',
      description: 'More songs, more guessing!',
      enabled: true,
    },
    {
      emoji: '⭐',
      title: 'Favourites',
      description: 'Vote for your top 3 favourite songs',
      enabled: true,
    },
    {
      emoji: '🏆',
      title: 'Results',
      description: 'Final scores and awards revealed',
      enabled: true,
    },
  ]

  const enabledPhases = phases.filter(p => p.enabled)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            Get Ready!
          </h1>
          <p className="text-muted-foreground">
            Here's what's coming up...
          </p>
        </div>

        {/* Phases */}
        <Card className="border-2 border-primary/30">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {enabledPhases.map((phase, index) => (
                <div
                  key={phase.title}
                  className="flex items-center gap-4"
                >
                  {/* Step number */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{index + 1}</span>
                  </div>

                  {/* Phase info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{phase.emoji}</span>
                      <span className="font-semibold">{phase.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {phase.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scoring info */}
        <Card className="border border-muted">
          <CardContent className="py-4">
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">How to score points:</p>
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                <Badge variant="outline">+100 correct guess</Badge>
                <Badge variant="outline">+100 trivia answer</Badge>
                <Badge variant="outline">+50 per favourite vote</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Start button */}
        {isHost ? (
          <Button
            onClick={onStart}
            className="w-full h-14 text-lg"
            size="lg"
          >
            Let's Go! 🎄
          </Button>
        ) : (
          <div className="text-center">
            <Badge variant="secondary" className="text-base px-4 py-2">
              Waiting for host to start...
            </Badge>
          </div>
        )}
      </div>
    </main>
  )
}
