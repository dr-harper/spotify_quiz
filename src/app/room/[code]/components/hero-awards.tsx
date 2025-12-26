'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Award } from './award-reveal'

interface HeroAwardsProps {
  awards: Award[]
  onComplete: () => void
  onAwardRevealed?: (award: Award) => void
}

type RevealPhase = 'intro' | 'category' | 'recipient' | 'points'

export function HeroAwards({ awards, onComplete, onAwardRevealed }: HeroAwardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<RevealPhase>('intro')

  const currentAward = awards[currentIndex]
  const isLastAward = currentIndex === awards.length - 1
  const isPositive = currentAward?.points > 0
  const isNegative = currentAward?.points < 0

  // Auto-advance through phases
  useEffect(() => {
    if (phase === 'intro') {
      const timer = setTimeout(() => setPhase('category'), 4000)
      return () => clearTimeout(timer)
    }
    if (phase === 'category') {
      const timer = setTimeout(() => setPhase('recipient'), 1500)
      return () => clearTimeout(timer)
    }
    if (phase === 'recipient') {
      const timer = setTimeout(() => {
        setPhase('points')
        // Notify parent that award is revealed (for score updates)
        if (onAwardRevealed && currentAward) {
          onAwardRevealed(currentAward)
        }
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [phase, currentAward, onAwardRevealed])

  const handleNext = () => {
    if (isLastAward) {
      onComplete()
    } else {
      setCurrentIndex(prev => prev + 1)
      setPhase('category')
    }
  }

  if (!currentAward) {
    return null
  }

  // Intro screen
  if (phase === 'intro') {
    return (
      <main className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center space-y-6">
          <div className="text-8xl animate-bounce">🎖️</div>
          <div className="space-y-3">
            <p className="text-2xl text-muted-foreground">
              Before we crown the winner...
            </p>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
              Bonus Awards!
            </h1>
            <p className="text-lg text-muted-foreground">
              A few extra points up for grabs...
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-full max-w-md mx-auto px-6">
        {/* Progress indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {awards.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 w-8 rounded-full transition-all duration-300 ${
                idx < currentIndex
                  ? 'bg-primary'
                  : idx === currentIndex
                  ? 'bg-primary animate-pulse'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Award Card */}
        <div className="text-center space-y-6">
          {/* Emoji - always visible */}
          <div
            className={`text-8xl transition-all duration-500 ${
              phase === 'category'
                ? 'animate-bounce'
                : 'scale-90'
            }`}
          >
            {currentAward.emoji}
          </div>

          {/* Title */}
          <div
            className={`transition-all duration-500 ${
              phase === 'category'
                ? 'opacity-100 translate-y-0'
                : 'opacity-70 scale-95'
            }`}
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
              {currentAward.title}
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              {currentAward.description}
            </p>
          </div>

          {/* Recipient - revealed after delay */}
          {(phase === 'recipient' || phase === 'points') && (
            <div
              key={`recipient-${currentIndex}`}
              className="animate-in fade-in zoom-in duration-500"
            >
              <div className="flex flex-col items-center gap-3">
                <Avatar className="h-24 w-24 ring-4 ring-primary/50 shadow-lg shadow-primary/20">
                  <AvatarImage src={currentAward.recipient.avatar_url || undefined} />
                  <AvatarFallback className="text-3xl bg-primary/20">
                    {currentAward.recipient.display_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-2xl font-bold">
                  {currentAward.recipient.display_name}
                </span>
              </div>
            </div>
          )}

          {/* Points - revealed last */}
          {phase === 'points' && (
            <div
              key={`points-${currentIndex}`}
              className="animate-in fade-in zoom-in duration-500"
            >
              <div
                className={`text-5xl font-bold ${
                  isPositive
                    ? 'text-green-500'
                    : isNegative
                    ? 'text-red-500 animate-shake'
                    : 'text-muted-foreground'
                }`}
              >
                {isPositive ? '+' : ''}{currentAward.points}
              </div>
              <p className="text-sm text-muted-foreground mt-1">points</p>

              {/* Detail stat */}
              {currentAward.detail && (
                <p className="text-muted-foreground mt-4 text-sm italic">
                  {currentAward.detail}
                </p>
              )}
            </div>
          )}

          {/* Continue button - only show after points revealed */}
          {phase === 'points' && (
            <div className="pt-4 animate-in fade-in duration-300">
              <Button
                onClick={handleNext}
                size="lg"
                className="px-8"
              >
                {isLastAward ? 'See Final Results' : 'Next Award'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Custom shake animation for negative points */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </main>
  )
}
