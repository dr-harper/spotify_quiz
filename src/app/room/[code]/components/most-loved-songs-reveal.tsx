'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Submission, Participant } from '@/types/database'

interface LovedSong {
  submission: Submission
  participant: Participant
  votes: number
}

interface MostLovedSongsRevealProps {
  songs: LovedSong[]
  onComplete: () => void
}

type RevealPhase = 'intro' | 'countdown' | 'reveal'

export function MostLovedSongsReveal({ songs, onComplete }: MostLovedSongsRevealProps) {
  const [phase, setPhase] = useState<RevealPhase>('intro')
  const [currentIndex, setCurrentIndex] = useState(songs.length - 1) // Start from 3rd place
  const [showDetails, setShowDetails] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const currentSong = songs[currentIndex]
  const isFirstPlace = currentIndex === 0
  const position = currentIndex + 1

  // Auto-advance from intro
  useEffect(() => {
    if (phase === 'intro') {
      const timer = setTimeout(() => setPhase('countdown'), 3000)
      return () => clearTimeout(timer)
    }
    if (phase === 'countdown') {
      const timer = setTimeout(() => {
        setPhase('reveal')
        setShowDetails(false)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [phase])

  // Show details after reveal
  useEffect(() => {
    if (phase === 'reveal' && !showDetails) {
      const timer = setTimeout(() => {
        setShowDetails(true)
        // Play audio for first place
        if (isFirstPlace && currentSong?.submission.preview_url && audioRef.current) {
          audioRef.current.volume = 0.5
          audioRef.current.play().catch(console.error)
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [phase, showDetails, isFirstPlace, currentSong])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  const handleNext = () => {
    // Stop audio if playing
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }

    if (currentIndex === 0) {
      onComplete()
    } else {
      setCurrentIndex(prev => prev - 1)
      setPhase('countdown')
      setShowDetails(false)
    }
  }

  if (!currentSong) {
    onComplete()
    return null
  }

  const positionEmoji = position === 1 ? '🥇' : position === 2 ? '🥈' : '🥉'
  const positionText = position === 1 ? '1st' : position === 2 ? '2nd' : '3rd'

  // Intro screen
  if (phase === 'intro') {
    return (
      <main className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center space-y-6">
          <div className="text-8xl animate-bounce">⭐</div>
          <div className="space-y-3">
            <p className="text-2xl text-muted-foreground">
              And the most loved songs are...
            </p>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent">
              Fan Favourites!
            </h1>
            <p className="text-lg text-muted-foreground">
              The songs you loved the most
            </p>
          </div>
        </div>
      </main>
    )
  }

  // Countdown screen
  if (phase === 'countdown') {
    return (
      <main className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center space-y-6">
          <div className="text-9xl animate-pulse">{positionEmoji}</div>
          <h1 className="text-4xl font-bold text-muted-foreground">
            {positionText} Place
          </h1>
        </div>
      </main>
    )
  }

  return (
    <main className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-50">
      {/* Hidden audio element for 1st place */}
      {isFirstPlace && currentSong.submission.preview_url && (
        <audio ref={audioRef} src={currentSong.submission.preview_url} />
      )}

      <div className="w-full max-w-md mx-auto px-6">
        {/* Progress indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {songs.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 w-8 rounded-full transition-all duration-300 ${
                idx > currentIndex
                  ? 'bg-yellow-500'
                  : idx === currentIndex
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Song reveal */}
        <div className="text-center space-y-6">
          {/* Position */}
          <div className="text-7xl">{positionEmoji}</div>

          {/* Album art */}
          <div className="animate-in fade-in zoom-in duration-500">
            {currentSong.submission.album_art_url ? (
              <img
                src={currentSong.submission.album_art_url}
                alt=""
                className={`w-48 h-48 mx-auto rounded-lg shadow-2xl ${
                  isFirstPlace ? 'ring-4 ring-yellow-500 shadow-yellow-500/30' : ''
                }`}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <div className="w-48 h-48 mx-auto rounded-lg bg-muted flex items-center justify-center">
                <span className="text-6xl">🎵</span>
              </div>
            )}
          </div>

          {/* Song details */}
          {showDetails && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
              <div>
                <h2 className="text-2xl font-bold truncate">
                  {currentSong.submission.track_name}
                </h2>
                <p className="text-lg text-muted-foreground truncate">
                  {currentSong.submission.artist_name}
                </p>
              </div>

              {/* Submitted by */}
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-muted-foreground">Submitted by</span>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={currentSong.participant.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {currentSong.participant.display_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">
                  {currentSong.participant.display_name}
                </span>
              </div>

              {/* Vote count */}
              <div className="text-3xl font-bold text-yellow-500">
                {currentSong.votes} {currentSong.votes === 1 ? 'vote' : 'votes'}
              </div>

              {/* Now playing indicator for 1st place */}
              {isFirstPlace && currentSong.submission.preview_url && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <span className="animate-pulse">🎵</span>
                  <span>Now playing</span>
                </div>
              )}

              {/* Continue button */}
              <div className="pt-4">
                <Button onClick={handleNext} size="lg" className="px-8">
                  {currentIndex === 0 ? 'Continue to Awards' : 'Next Song'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
