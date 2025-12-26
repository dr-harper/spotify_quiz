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

// Submission with participant info for popularity calculation
interface SubmissionWithParticipant {
  participant_id: string
  popularity: number | null
}

// Award calculation helpers
export function calculateAwards(
  participants: Participant[],
  roundDetails: Array<{
    correctParticipant: Participant
    correctVoters: Participant[]
  }>,
  submissions: SubmissionWithParticipant[],
  favouriteVoteCounts?: Record<string, number>,  // participant_id -> vote count
  triviaScores?: Record<string, number>  // participant_id -> trivia points
): Award[] {
  const awards: Award[] = []

  if (participants.length < 2) return awards

  // Song submitters are participants who submitted songs (not spectators)
  // Song-related awards can only go to song submitters
  const songSubmitters = participants.filter(p => !p.is_spectator)

  // Calculate stats for each song submitter (song-related awards)
  const songStats = songSubmitters.map(p => {
    // Their rounds (songs they submitted that were played)
    const theirRounds = roundDetails.filter(r => r.correctParticipant.id === p.id)

    // Calculate % of correct guesses on their songs
    // Each round, (participants - 1) people can guess
    const totalGuessOpportunities = theirRounds.length * (participants.length - 1)
    const correctGuessesOnThem = theirRounds.reduce(
      (sum, r) => sum + r.correctVoters.length,
      0
    )
    const guessedPercentage = totalGuessOpportunities > 0
      ? (correctGuessesOnThem / totalGuessOpportunities) * 100
      : 0

    // Their average song popularity
    const theirSubmissions = submissions.filter(s => s.participant_id === p.id)
    const popularitySum = theirSubmissions.reduce(
      (sum, s) => sum + (s.popularity || 0),
      0
    )
    const avgPopularity = theirSubmissions.length > 0
      ? popularitySum / theirSubmissions.length
      : 0

    return {
      participant: p,
      guessedPercentage,
      avgPopularity,
      favouriteVotes: favouriteVoteCounts?.[p.id] || 0,
    }
  })

  // Only calculate song-related awards if there are song submitters
  if (songStats.length >= 2) {
    // 📖 Open Book - Highest % guessed correctly (+150)
    // Consolation for being predictable
    const openBook = songStats.reduce((max, s) =>
      s.guessedPercentage > max.guessedPercentage ? s : max
    )
    awards.push({
      id: 'open-book',
      emoji: '📖',
      title: 'Open Book',
      description: 'Everyone knows your taste!',
      points: 150,
      recipient: openBook.participant,
      detail: `${Math.round(openBook.guessedPercentage)}% of guesses correct`,
    })

    // 🎉 Crowd Pleaser - Highest average popularity (+150)
    // Reward for accessible picks
    const crowdPleaser = songStats.reduce((max, s) =>
      s.avgPopularity > max.avgPopularity ? s : max
    )
    awards.push({
      id: 'crowd-pleaser',
      emoji: '🎉',
      title: 'Crowd Pleaser',
      description: 'Thanks for the bangers!',
      points: 150,
      recipient: crowdPleaser.participant,
      detail: `${Math.round(crowdPleaser.avgPopularity)} avg popularity`,
    })

    // 🎭 Poker Face - Lowest % guessed correctly (-100)
    // Penalty for unfair advantage
    const pokerFace = songStats.reduce((min, s) =>
      s.guessedPercentage < min.guessedPercentage ? s : min
    )
    awards.push({
      id: 'poker-face',
      emoji: '🎭',
      title: 'Poker Face',
      description: 'Too sneaky for your own good',
      points: -100,
      recipient: pokerFace.participant,
      detail: `Only ${Math.round(pokerFace.guessedPercentage)}% guessed correctly`,
    })

    // ⭐ People's Favourite - Most favourite votes received (+200)
    // Only add if there were favourite votes (spectators can't receive this - no songs)
    if (favouriteVoteCounts && Object.values(favouriteVoteCounts).some(v => v > 0)) {
      const maxVotes = Math.max(...songStats.map(s => s.favouriteVotes))
      // Find all song submitters tied for most votes
      const favouriteWinners = songStats.filter(s => s.favouriteVotes === maxVotes && maxVotes > 0)

      // Award to all tied winners
      favouriteWinners.forEach(winner => {
        awards.push({
          id: `peoples-favourite-${winner.participant.id}`,
          emoji: '⭐',
          title: "People's Favourite",
          description: 'Your songs were loved!',
          points: 200,
          recipient: winner.participant,
          detail: `${winner.favouriteVotes} votes received`,
        })
      })
    }
  }

  // 🧠 Trivia Champ - Highest trivia score (+150)
  // All participants (including spectators) can win this
  if (triviaScores && Object.values(triviaScores).some(v => v > 0)) {
    const triviaStats = participants.map(p => ({
      participant: p,
      triviaScore: triviaScores[p.id] || 0,
    }))
    const triviaChamp = triviaStats.reduce((max, s) =>
      s.triviaScore > max.triviaScore ? s : max
    )
    if (triviaChamp.triviaScore > 0) {
      awards.push({
        id: 'trivia-champ',
        emoji: '🧠',
        title: 'Trivia Champ',
        description: 'Christmas music expert!',
        points: 150,
        recipient: triviaChamp.participant,
        detail: `${triviaChamp.triviaScore} trivia points`,
      })
    }
  }

  return awards
}
