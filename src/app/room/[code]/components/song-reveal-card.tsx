'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { Participant, Submission } from '@/types/database'

interface SongRevealCardProps {
  submission: Submission
  pickedBy: Participant
  correctVoters: Participant[]
  roundNumber: number
  totalRounds: number
  phase: 'part1' | 'part2'
  onAudioEnd?: () => void
}

const PLAYER_COLOURS = [
  '#ef4444', '#22c55e', '#3b82f6', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]

export function SongRevealCard({
  submission,
  pickedBy,
  correctVoters,
  roundNumber,
  totalRounds,
  phase,
  onAudioEnd,
}: SongRevealCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const onAudioEndRef = useRef(onAudioEnd)

  // Keep callback ref updated
  useEffect(() => {
    onAudioEndRef.current = onAudioEnd
  }, [onAudioEnd])

  // Play up to 30 seconds of preview, but auto-advance after 5 seconds
  useEffect(() => {
    const audio = audioRef.current
    const advanceTimerRef = { current: null as NodeJS.Timeout | null }
    const audioStopTimerRef = { current: null as NodeJS.Timeout | null }

    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (submission.preview_url && audio) {
      // Reset audio state
      audio.pause()
      audio.currentTime = 0

      // Play when ready
      const handleCanPlay = () => {
        audio.play().catch(err => {
          console.error('Audio play failed:', err)
        })
      }

      audio.addEventListener('canplaythrough', handleCanPlay, { once: true })

      // Load the audio
      audio.load()

      // Auto-advance to next page after 5 seconds (audio keeps playing)
      advanceTimerRef.current = setTimeout(() => {
        onAudioEndRef.current?.()
      }, 5000)

      // Stop audio after 30 seconds max
      audioStopTimerRef.current = setTimeout(() => {
        if (audio) {
          audio.pause()
        }
      }, 30000)

      return () => {
        audio.removeEventListener('canplaythrough', handleCanPlay)
        audio.pause()
        if (advanceTimerRef.current) {
          clearTimeout(advanceTimerRef.current)
        }
        if (audioStopTimerRef.current) {
          clearTimeout(audioStopTimerRef.current)
        }
      }
    } else {
      // No preview, trigger end callback after short delay
      timerRef.current = setTimeout(() => onAudioEndRef.current?.(), 3000)
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
        }
      }
    }
  }, [submission.preview_url, submission.id])

  return (
    <Card className="border-2 border-primary/30 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardContent className="pt-6">
        <div className="flex gap-4">
          {/* Album Art */}
          {submission.album_art_url && (
            <img
              src={submission.album_art_url}
              alt={submission.track_name}
              className="w-24 h-24 rounded-lg shadow-lg flex-shrink-0"
            />
          )}

          <div className="flex-1 min-w-0">
            {/* Phase Badge */}
            <Badge variant="secondary" className="mb-2 text-xs">
              {phase === 'part1' ? '🎵 Part 1' : '🎶 Part 2'} • Song {roundNumber} of {totalRounds}
            </Badge>

            {/* Song Info */}
            <h3 className="font-bold text-lg truncate">{submission.track_name}</h3>
            <p className="text-muted-foreground truncate">{submission.artist_name}</p>

            {/* Picked By */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-muted-foreground">Picked by:</span>
              <div className="flex items-center gap-1.5">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={pickedBy.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {pickedBy.display_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold text-sm">{pickedBy.display_name}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Correct Guessers */}
        <div className="mt-4 pt-4 border-t">
          {correctVoters.length > 0 ? (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Correct guesses:</span>
              <div className="flex flex-wrap gap-2">
                {correctVoters.map((voter, index) => (
                  <div
                    key={voter.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium animate-in fade-in zoom-in duration-300"
                    style={{
                      backgroundColor: `${PLAYER_COLOURS[index % PLAYER_COLOURS.length]}20`,
                      color: PLAYER_COLOURS[index % PLAYER_COLOURS.length],
                      animationDelay: `${index * 100}ms`,
                    }}
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={voter.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {voter.display_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{voter.display_name}</span>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      +100
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Nobody guessed correctly! 🎭
            </p>
          )}
        </div>

        {/* Hidden Audio Element */}
        {submission.preview_url && (
          <audio
            ref={audioRef}
            preload="auto"
          >
            <source src={submission.preview_url} type="audio/mpeg" />
          </audio>
        )}
      </CardContent>
    </Card>
  )
}
