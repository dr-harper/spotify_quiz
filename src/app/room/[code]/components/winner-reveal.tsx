'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { Participant } from '@/types/database'

interface WinnerRevealProps {
  winner: Participant
  finalScore: number
  onComplete: () => void
}

export function WinnerReveal({ winner, finalScore, onComplete }: WinnerRevealProps) {
  const [phase, setPhase] = useState<'building' | 'reveal' | 'celebrate'>('building')
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    // "And the winner is..." phase
    const revealTimer = setTimeout(() => setPhase('reveal'), 2000)
    // Celebrate phase
    const celebrateTimer = setTimeout(() => setPhase('celebrate'), 3500)

    return () => {
      clearTimeout(revealTimer)
      clearTimeout(celebrateTimer)
    }
  }, [])

  // Play celebration music when winner is revealed
  useEffect(() => {
    if (phase === 'reveal' && audioRef.current) {
      audioRef.current.volume = 0.5
      audioRef.current.play().catch(console.error)
    }
  }, [phase])

  return (
    <Card className="border-2 border-yellow-500/50 bg-gradient-to-b from-yellow-500/10 to-transparent relative overflow-hidden">
      {/* Winner Celebration Music */}
      <audio ref={audioRef} src="/winner-music.mp3" preload="auto" />

      {/* Confetti Effect */}
      {phase === 'celebrate' && <ConfettiEffect />}

      <CardContent className="pt-8 pb-8 text-center relative z-10">
        {phase === 'building' && (
          <div className="animate-pulse">
            <p className="text-2xl font-bold text-muted-foreground">
              And the winner is...
            </p>
            <div className="text-6xl mt-4">🥁</div>
          </div>
        )}

        {(phase === 'reveal' || phase === 'celebrate') && (
          <div className="animate-in fade-in zoom-in duration-500">
            {/* Trophy */}
            <div className="text-7xl mb-4 animate-bounce">🏆</div>

            {/* Winner Avatar */}
            <Avatar className="h-28 w-28 mx-auto ring-4 ring-yellow-500 shadow-lg shadow-yellow-500/30">
              <AvatarImage src={winner.avatar_url || undefined} />
              <AvatarFallback className="text-4xl bg-yellow-500/20">
                {winner.display_name.charAt(0)}
              </AvatarFallback>
            </Avatar>

            {/* Winner Name */}
            <h1 className="text-3xl font-bold mt-4 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent">
              {winner.display_name}
            </h1>

            {/* Final Score */}
            <div className="mt-3">
              <span className="text-5xl font-bold text-yellow-500">{finalScore}</span>
              <span className="text-xl text-muted-foreground ml-2">points</span>
            </div>

            {/* Congratulations */}
            <p className="text-muted-foreground mt-4 text-lg">
              Congratulations! 🎉
            </p>

            {/* Continue Button */}
            {phase === 'celebrate' && (
              <Button
                onClick={onComplete}
                className="mt-6 h-12 px-8 text-lg animate-in fade-in duration-500"
                style={{ animationDelay: '500ms' }}
              >
                View Full Results
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Simple CSS-based confetti effect
function ConfettiEffect() {
  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 2}s`,
    colour: ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'][
      Math.floor(Math.random() * 6)
    ],
  }))

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute w-2 h-2 rounded-full animate-confetti"
          style={{
            left: piece.left,
            backgroundColor: piece.colour,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation-name: confetti;
          animation-timing-function: ease-out;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  )
}
