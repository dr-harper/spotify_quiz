'use client'

import { useState } from 'react'
import { QuizIntro } from '@/app/room/[code]/components/quiz-intro'
import { FestiveBackground } from '@/components/festive-background'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { GameSettings } from '@/types/database'

/**
 * Demo page for the quiz intro screen - used for UI testing
 * Access at /demo/intro
 */

const SETTINGS_PRESETS: Record<string, GameSettings> = {
  full: {
    songsRequired: 5,
    christmasSongsRequired: 2,
    recentSongsRequired: 1,
    chameleonMode: true,
    guessTimerSeconds: 30,
    previewLengthSeconds: 30,
    revealAfterEachRound: true,
    allowDuplicateSongs: false,
    lobbyMusic: true,
    triviaEnabled: true,
    triviaQuestionCount: 10,
    snowEffect: true,
    themeColor: 'green',
  },
  noTrivia: {
    songsRequired: 5,
    christmasSongsRequired: 2,
    recentSongsRequired: 1,
    chameleonMode: true,
    guessTimerSeconds: 30,
    previewLengthSeconds: 30,
    revealAfterEachRound: true,
    allowDuplicateSongs: false,
    lobbyMusic: true,
    triviaEnabled: false,
    triviaQuestionCount: 5,
    snowEffect: true,
    themeColor: 'green',
  },
}

export default function DemoIntroPage() {
  const [preset, setPreset] = useState<'full' | 'noTrivia'>('full')
  const [isHost, setIsHost] = useState(true)
  const [started, setStarted] = useState(false)

  const handleStart = () => {
    setStarted(true)
    setTimeout(() => setStarted(false), 2000) // Reset after 2 seconds for demo
  }

  return (
    <>
      <FestiveBackground showSnow={true} />
      <div className="fixed top-4 left-4 z-50 flex flex-col gap-2">
        <Badge variant="secondary" className="text-xs">Demo Controls</Badge>
        <div className="flex gap-2">
          <Button
            variant={preset === 'full' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPreset('full')}
          >
            With Trivia
          </Button>
          <Button
            variant={preset === 'noTrivia' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPreset('noTrivia')}
          >
            No Trivia
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant={isHost ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsHost(true)}
          >
            Host View
          </Button>
          <Button
            variant={!isHost ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsHost(false)}
          >
            Player View
          </Button>
        </div>
        {started && (
          <Badge variant="default" className="bg-green-600 animate-pulse">
            Started!
          </Badge>
        )}
      </div>
      <QuizIntro
        settings={SETTINGS_PRESETS[preset]}
        isHost={isHost}
        onStart={handleStart}
      />
    </>
  )
}
