'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ProcessingResultsProps {
  narrative: string[]
  isLoading: boolean
  onComplete: () => void
}

const LOADING_MESSAGES = [
  "Crunching the numbers...",
  "Analysing musical genius...",
  "Tallying the votes...",
  "Calculating final scores...",
  "Determining the champion...",
  "Processing results...",
]

export function ProcessingResults({ narrative, isLoading, onComplete }: ProcessingResultsProps) {
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const [visibleParagraphs, setVisibleParagraphs] = useState(0)
  const [showButton, setShowButton] = useState(false)

  // Cycle through loading messages
  useEffect(() => {
    if (!isLoading) return

    const interval = setInterval(() => {
      setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length)
    }, 2000)

    return () => clearInterval(interval)
  }, [isLoading])

  // Reveal paragraphs one by one after loading completes
  useEffect(() => {
    if (isLoading || narrative.length === 0) return

    // Reset when narrative changes
    setVisibleParagraphs(0)
    setShowButton(false)

    // Reveal first paragraph after a brief pause
    const firstTimer = setTimeout(() => setVisibleParagraphs(1), 800)

    // Reveal subsequent paragraphs with delays (4 seconds between each for longer paragraphs)
    const timers = narrative.slice(1).map((_, index) => {
      return setTimeout(() => {
        setVisibleParagraphs(index + 2)
      }, 800 + (index + 1) * 4000)
    })

    // Show button after all paragraphs with extra pause for final paragraph to sink in
    const buttonTimer = setTimeout(() => {
      setShowButton(true)
    }, 800 + narrative.length * 4000 + 1500)

    return () => {
      clearTimeout(firstTimer)
      timers.forEach(clearTimeout)
      clearTimeout(buttonTimer)
    }
  }, [isLoading, narrative])

  if (isLoading) {
    return (
      <Card className="border-2 border-primary/30 bg-gradient-to-b from-primary/5 to-transparent">
        <CardContent className="py-12 text-center">
          {/* Spinning vinyl animation */}
          <div className="relative mx-auto w-32 h-32 mb-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 animate-spin-slow shadow-xl">
              {/* Vinyl grooves */}
              <div className="absolute inset-3 rounded-full border border-slate-700" />
              <div className="absolute inset-6 rounded-full border border-slate-700" />
              <div className="absolute inset-9 rounded-full border border-slate-700" />
              {/* Centre label */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-slate-900" />
                </div>
              </div>
            </div>
            {/* Musical notes floating */}
            <div className="absolute -top-2 -right-2 text-2xl animate-bounce" style={{ animationDelay: '0s' }}>
              🎵
            </div>
            <div className="absolute -bottom-2 -left-2 text-2xl animate-bounce" style={{ animationDelay: '0.5s' }}>
              🎶
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Processing Results
          </h2>

          {/* Animated loading message */}
          <p className="text-lg text-muted-foreground animate-pulse">
            {LOADING_MESSAGES[loadingMessageIndex]}
          </p>

          {/* Progress bar */}
          <div className="mt-6 w-48 mx-auto h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-purple-500 animate-progress" />
          </div>

          <style jsx>{`
            @keyframes spin-slow {
              from {
                transform: rotate(0deg);
              }
              to {
                transform: rotate(360deg);
              }
            }
            .animate-spin-slow {
              animation: spin-slow 3s linear infinite;
            }
            @keyframes progress {
              0% {
                width: 0%;
              }
              50% {
                width: 70%;
              }
              100% {
                width: 100%;
              }
            }
            .animate-progress {
              animation: progress 4s ease-in-out infinite;
            }
          `}</style>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-yellow-500/30 bg-gradient-to-b from-yellow-500/5 to-transparent">
      <CardContent className="py-8 text-center">
        {/* Header */}
        <div className="mb-8">
          <div className="text-5xl mb-3">⭐</div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent">
            And the winner is...
          </h2>
        </div>

        {/* Narrative paragraphs */}
        <div className="space-y-6 max-w-md mx-auto text-left">
          {narrative.map((paragraph, index) => (
            <div
              key={index}
              className={`transition-all duration-700 ${
                index < visibleParagraphs
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <p className="text-muted-foreground leading-relaxed">
                {paragraph}
              </p>
            </div>
          ))}
        </div>

        {/* Reveal button */}
        {showButton && (
          <div className="mt-8 animate-in fade-in zoom-in duration-500">
            <Button
              onClick={onComplete}
              size="lg"
              className="h-14 px-8 text-lg bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold shadow-lg shadow-yellow-500/25"
            >
              <span className="mr-2">🏆</span>
              Reveal the Winner
              <span className="ml-2">🏆</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
