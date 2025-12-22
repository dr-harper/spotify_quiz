'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { Participant } from '@/types/database'

export interface Award {
  id: string
  emoji: string
  title: string
  description: string
  points: number
  recipient: Participant
  detail?: string // e.g., "3 songs unguessed" for Mystery DJ
}

interface AwardRevealProps {
  award: Award
  index: number
  total: number
}

export function AwardReveal({ award, index, total }: AwardRevealProps) {
  const isPositive = award.points > 0
  const isNegative = award.points < 0

  return (
    <Card className="border-2 border-primary/30 animate-in fade-in zoom-in-95 duration-500">
      <CardContent className="pt-6">
        {/* Award Header */}
        <div className="text-center mb-6">
          <Badge variant="secondary" className="mb-3 text-xs">
            Award {index + 1} of {total}
          </Badge>
          <div className="text-6xl mb-3 animate-bounce">{award.emoji}</div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            {award.title}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">{award.description}</p>
        </div>

        {/* Recipient */}
        <div className="flex flex-col items-center gap-3">
          <Avatar className="h-20 w-20 ring-4 ring-primary/30">
            <AvatarImage src={award.recipient.avatar_url || undefined} />
            <AvatarFallback className="text-2xl">
              {award.recipient.display_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="font-bold text-xl">{award.recipient.display_name}</span>

          {/* Points */}
          <div
            className={`text-3xl font-bold animate-in zoom-in duration-500 ${
              isPositive
                ? 'text-green-500'
                : isNegative
                ? 'text-red-500'
                : 'text-muted-foreground'
            }`}
            style={{ animationDelay: '300ms' }}
          >
            {isPositive ? '+' : ''}{award.points} points
          </div>

          {/* Detail (if any) */}
          {award.detail && (
            <p className="text-sm text-muted-foreground italic">{award.detail}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Compact award badge for side-by-side display
interface AwardBadgeProps {
  award: Award
  isVisible: boolean
  delay: number
}

export function AwardBadge({ award, isVisible, delay }: AwardBadgeProps) {
  if (!isVisible) {
    return (
      <div className="flex-1 min-w-[100px] h-24 rounded-lg border border-dashed border-muted-foreground/30" />
    )
  }

  return (
    <div
      className="flex-1 min-w-[100px] flex flex-col items-center gap-1 p-3 rounded-lg bg-primary/10 border border-primary/30 animate-in fade-in zoom-in-95 duration-300"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-2xl">{award.emoji}</span>
      <span className="text-xs font-semibold text-center leading-tight">{award.title}</span>
      <span className="text-xs text-muted-foreground truncate max-w-full">{award.recipient.display_name}</span>
      <span className="text-sm font-bold text-green-500">+{award.points}</span>
    </div>
  )
}

// Award calculation helpers
export function calculateAwards(
  participants: Participant[],
  roundDetails: Array<{
    correctParticipant: Participant
    correctVoters: Participant[]
  }>,
  triviaScores: Record<string, number>
): Award[] {
  const awards: Award[] = []

  if (participants.length < 2) return awards

  // Calculate stats for each participant
  const stats = participants.map(p => {
    // How many times they guessed correctly
    const correctGuesses = roundDetails.filter(r =>
      r.correctVoters.some(v => v.id === p.id)
    ).length

    // How many of their songs were guessed by anyone
    const theirSongs = roundDetails.filter(r => r.correctParticipant.id === p.id)
    const songsGuessedCorrectly = theirSongs.filter(r => r.correctVoters.length > 0).length

    // Trivia score
    const triviaScore = triviaScores[p.id] || 0

    return {
      participant: p,
      correctGuesses,
      songsGuessedCorrectly,
      triviaScore,
      totalSongs: theirSongs.length,
    }
  })

  // Track used participants to avoid duplicates
  const usedParticipantIds = new Set<string>()

  // Best Guesser - Most correct guesses (+150)
  const bestGuesser = [...stats].sort((a, b) => b.correctGuesses - a.correctGuesses)[0]
  if (bestGuesser.correctGuesses > 0) {
    awards.push({
      id: 'best-guesser',
      emoji: '🎯',
      title: 'Best Guesser',
      description: 'Got the most correct guesses!',
      points: 150,
      recipient: bestGuesser.participant,
      detail: `${bestGuesser.correctGuesses} correct guesses`,
    })
    usedParticipantIds.add(bestGuesser.participant.id)
  }

  // Crowd Pleaser - Their songs were guessed the most (+100)
  const crowdPleaser = [...stats]
    .filter(s => !usedParticipantIds.has(s.participant.id))
    .sort((a, b) => b.songsGuessedCorrectly - a.songsGuessedCorrectly)[0]
  if (crowdPleaser && crowdPleaser.songsGuessedCorrectly > 0) {
    awards.push({
      id: 'crowd-pleaser',
      emoji: '👏',
      title: 'Crowd Pleaser',
      description: 'Everyone knew your taste!',
      points: 100,
      recipient: crowdPleaser.participant,
      detail: `${crowdPleaser.songsGuessedCorrectly} songs guessed correctly`,
    })
    usedParticipantIds.add(crowdPleaser.participant.id)
  }

  // Trivia Champion - Highest trivia score (+75)
  const triviaChampion = [...stats]
    .filter(s => !usedParticipantIds.has(s.participant.id))
    .sort((a, b) => b.triviaScore - a.triviaScore)[0]
  if (triviaChampion && triviaChampion.triviaScore > 0) {
    awards.push({
      id: 'trivia-champion',
      emoji: '🧠',
      title: 'Trivia Champ',
      description: 'The brainiest player!',
      points: 75,
      recipient: triviaChampion.participant,
      detail: `${triviaChampion.triviaScore} trivia points`,
    })
  }

  return awards
}
