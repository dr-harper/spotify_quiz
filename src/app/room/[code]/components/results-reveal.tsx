'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { SongRevealCard } from './song-reveal-card'
import { Award, calculateAwards } from './award-reveal'
import { HeroAwards } from './hero-awards'
import { WinnerReveal } from './winner-reveal'
import { MostLovedSongsReveal } from './most-loved-songs-reveal'
import type { Participant, Submission } from '@/types/database'

interface SubmissionWithParticipant extends Submission {
  participant: Participant
}

interface ChameleonVotes {
  declaredTargetId: string | null  // Who the owner declared as their target
  targetVoterIds: string[]         // IDs of other voters who also voted for target
}

interface VoterGuess {
  guessedParticipant: Participant | null
  isCorrect: boolean
}

interface RoundDetail {
  roundNumber: number
  submission: Submission
  correctParticipant: Participant
  correctVoters: Participant[]
  allGuesses: Map<string, VoterGuess>  // participantId -> their guess
  chameleonVotes?: ChameleonVotes  // Only present for chameleon songs
}

// Chameleon scoring constants
const CHAMELEON_BONUS_PER_MATCH = 100  // Bonus for each player who guessed your declared target
const CHAMELEON_PENALTY_PER_CAUGHT = 125  // Penalty for each player who guessed you correctly

// Calculate chameleon points for a round
// New scoring: owner declares target, +100 for each match, -125 for each catch
function calculateChameleonPoints(
  round: RoundDetail
): { ownerId: string; points: number; matchCount: number; caughtCount: number; declaredTargetId: string | null } | null {
  if (!round.submission.is_chameleon) return null
  if (!round.chameleonVotes) return null

  const ownerId = round.correctParticipant.id
  const { declaredTargetId, targetVoterIds } = round.chameleonVotes

  // Matches: how many other players also voted for the owner's declared target
  const matchCount = targetVoterIds.length
  // Caught: how many players correctly guessed the owner
  const caughtCount = round.correctVoters.length

  const bonus = matchCount * CHAMELEON_BONUS_PER_MATCH
  const penalty = caughtCount * CHAMELEON_PENALTY_PER_CAUGHT
  const points = bonus - penalty

  return { ownerId, points, matchCount, caughtCount, declaredTargetId }
}

interface ResultsRevealProps {
  participants: Participant[]
  part1Rounds: RoundDetail[]
  part2Rounds: RoundDetail[]
  triviaScores: Record<string, number> // participantId -> trivia score
  favouriteVoteCounts: Record<string, number> // participantId -> vote count
  favouriteScores: Record<string, number> // participantId -> favourite points (50 per vote)
  favouriteVotesBySubmission: Record<string, number> // submissionId -> vote count
  submissions: Submission[] // For award popularity calculations
  onComplete: () => void
}

type Phase = 'part1' | 'trivia' | 'part2' | 'favourites' | 'awards' | 'winner'

const PLAYER_COLOURS = [
  '#ef4444', '#22c55e', '#3b82f6', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]

export function ResultsReveal({
  participants,
  part1Rounds,
  part2Rounds,
  triviaScores,
  favouriteVoteCounts,
  favouriteScores,
  favouriteVotesBySubmission,
  submissions,
  onComplete,
}: ResultsRevealProps) {
  const [phase, setPhase] = useState<Phase>('part1')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [liveScores, setLiveScores] = useState<Record<string, number>>(() => {
    // Initialise all participants with 0
    const initial: Record<string, number> = {}
    participants.forEach(p => { initial[p.id] = 0 })
    return initial
  })
  const [chartData, setChartData] = useState<Array<{ step: number; [key: string]: number }>>([])
  const [awards, setAwards] = useState<Award[]>([])
  const [visibleAwards, setVisibleAwards] = useState(0) // Number of awards revealed
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  const allRounds = useMemo(() => [...part1Rounds, ...part2Rounds], [part1Rounds, part2Rounds])

  // Check if trivia was actually played (has any non-zero scores)
  const hasTriviaScores = useMemo(() => {
    return Object.values(triviaScores).some(score => score > 0)
  }, [triviaScores])

  // Calculate awards once
  useEffect(() => {
    // Convert submissions to format expected by calculateAwards
    const submissionsWithParticipantId = submissions.map(s => ({
      participant_id: s.participant_id,
      popularity: s.popularity,
    }))
    const calculatedAwards = calculateAwards(
      participants,
      allRounds,
      submissionsWithParticipantId,
      favouriteVoteCounts,
      triviaScores
    )
    setAwards(calculatedAwards)
  }, [participants, allRounds, submissions, favouriteVoteCounts, triviaScores])

  // Calculate top 3 most loved songs for favourites reveal
  const mostLovedSongs = useMemo(() => {
    const songsWithVotes = submissions
      .filter(s => favouriteVotesBySubmission[s.id] > 0)
      .map(s => ({
        submission: s,
        participant: participants.find(p => p.id === s.participant_id)!,
        votes: favouriteVotesBySubmission[s.id] || 0,
      }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 3)
    return songsWithVotes
  }, [submissions, favouriteVotesBySubmission, participants])

  const hasFavouriteSongs = mostLovedSongs.length > 0

  // Pre-calculate final scores (used for skip and winner determination)
  const finalScoresCalculated = useMemo(() => {
    const scores: Record<string, number> = {}
    participants.forEach(p => { scores[p.id] = 0 })

    // Add round scores (100 points per correct guess)
    allRounds.forEach(round => {
      round.correctVoters.forEach(voter => {
        scores[voter.id] = (scores[voter.id] || 0) + 100
      })

      // Add chameleon scoring
      const chameleonResult = calculateChameleonPoints(round)
      if (chameleonResult) {
        scores[chameleonResult.ownerId] = (scores[chameleonResult.ownerId] || 0) + chameleonResult.points
      }
    })

    // Add trivia scores
    Object.entries(triviaScores).forEach(([id, score]) => {
      scores[id] = (scores[id] || 0) + score
    })

    // Add favourite scores (50 points per vote received)
    Object.entries(favouriteScores).forEach(([id, score]) => {
      scores[id] = (scores[id] || 0) + score
    })

    // Add award points
    const submissionsWithParticipantId = submissions.map(s => ({
      participant_id: s.participant_id,
      popularity: s.popularity,
    }))
    const calculatedAwards = calculateAwards(
      participants,
      allRounds,
      submissionsWithParticipantId,
      favouriteVoteCounts,
      triviaScores
    )
    calculatedAwards.forEach(award => {
      scores[award.recipient.id] = (scores[award.recipient.id] || 0) + award.points
    })

    return scores
  }, [participants, allRounds, triviaScores, favouriteScores, favouriteVoteCounts, submissions])

  // Sort participants by current score for leaderboard display
  const sortedParticipants = useMemo(() => {
    return [...participants].sort(
      (a, b) => (liveScores[b.id] || 0) - (liveScores[a.id] || 0)
    )
  }, [participants, liveScores])

  // Update chart data whenever scores change
  useEffect(() => {
    setChartData(prev => {
      const newPoint: { step: number; [key: string]: number } = { step: prev.length + 1 }
      participants.forEach(p => {
        newPoint[p.display_name] = liveScores[p.id] || 0
      })
      return [...prev, newPoint]
    })
  }, [liveScores, participants])

  // Handle advancing to next item
  const advanceToNext = useCallback(() => {
    if (phase === 'part1') {
      // Update scores for current round
      const round = part1Rounds[currentIndex]
      if (round) {
        setLiveScores(prev => {
          const next = { ...prev }
          // Regular scoring for correct guesses
          round.correctVoters.forEach(voter => {
            next[voter.id] = (next[voter.id] || 0) + 100
          })
          // Chameleon scoring
          const chameleonResult = calculateChameleonPoints(round)
          if (chameleonResult) {
            next[chameleonResult.ownerId] = (next[chameleonResult.ownerId] || 0) + chameleonResult.points
          }
          return next
        })
      }

      if (currentIndex < part1Rounds.length - 1) {
        setCurrentIndex(prev => prev + 1)
      } else {
        // Move to trivia phase if trivia was played, otherwise skip to part2
        if (hasTriviaScores) {
          setPhase('trivia')
          setCurrentIndex(0)
        } else if (part2Rounds.length > 0) {
          setPhase('part2')
          setCurrentIndex(0)
        } else {
          // No trivia and no part2, go to winner
          setPhase('winner')
        }
      }
    } else if (phase === 'trivia') {
      // Add all trivia scores in one go
      setLiveScores(prev => {
        const next = { ...prev }
        Object.entries(triviaScores).forEach(([id, score]) => {
          next[id] = (next[id] || 0) + score
        })
        return next
      })
      setPhase('part2')
      setCurrentIndex(0)
    } else if (phase === 'part2') {
      // Update scores for current round
      const round = part2Rounds[currentIndex]
      if (round) {
        setLiveScores(prev => {
          const next = { ...prev }
          // Regular scoring for correct guesses
          round.correctVoters.forEach(voter => {
            next[voter.id] = (next[voter.id] || 0) + 100
          })
          // Chameleon scoring
          const chameleonResult = calculateChameleonPoints(round)
          if (chameleonResult) {
            next[chameleonResult.ownerId] = (next[chameleonResult.ownerId] || 0) + chameleonResult.points
          }
          return next
        })
      }

      if (currentIndex < part2Rounds.length - 1) {
        setCurrentIndex(prev => prev + 1)
      } else {
        // Go to favourites phase if there are favourite songs
        if (hasFavouriteSongs) {
          setPhase('favourites')
        } else if (awards.length > 0) {
          setPhase('awards')
        } else {
          setPhase('winner')
        }
      }
    }
  }, [phase, currentIndex, part1Rounds, part2Rounds, triviaScores, awards, hasTriviaScores, hasFavouriteSongs, participants])

  // Get current content based on phase
  const getCurrentContent = () => {
    if (phase === 'part1') {
      const round = part1Rounds[currentIndex]
      if (!round) return null
      const chameleonResult = calculateChameleonPoints(round)
      return (
        <SongRevealCard
          submission={round.submission}
          pickedBy={round.correctParticipant}
          correctVoters={round.correctVoters}
          allGuesses={round.allGuesses}
          roundNumber={currentIndex + 1}
          totalRounds={part1Rounds.length}
          phase="part1"
          onAudioEnd={isAutoPlaying ? advanceToNext : undefined}
          chameleonResult={chameleonResult}
          participants={participants}
        />
      )
    }

    if (phase === 'trivia') {
      return (
        <Card className="border-2 border-purple-500/30 animate-in fade-in zoom-in duration-500">
          <CardContent className="py-8 text-center">
            <div className="text-5xl mb-4">🧠</div>
            <h2 className="text-2xl font-bold mb-2">Adding Trivia Scores...</h2>
            <div className="space-y-2 mt-4">
              {participants.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-center gap-2 animate-in fade-in duration-300"
                  style={{ animationDelay: `${idx * 200}ms` }}
                >
                  <span className="text-muted-foreground">{p.display_name}:</span>
                  <span className="font-bold text-purple-500">
                    +{triviaScores[p.id] || 0}
                  </span>
                </div>
              ))}
            </div>
            <Button
              onClick={advanceToNext}
              className="mt-6"
            >
              Continue to Part 2 →
            </Button>
          </CardContent>
        </Card>
      )
    }

    if (phase === 'part2') {
      const round = part2Rounds[currentIndex]
      if (!round) return null
      const chameleonResult = calculateChameleonPoints(round)
      return (
        <SongRevealCard
          submission={round.submission}
          pickedBy={round.correctParticipant}
          correctVoters={round.correctVoters}
          allGuesses={round.allGuesses}
          roundNumber={currentIndex + 1}
          totalRounds={part2Rounds.length}
          phase="part2"
          onAudioEnd={isAutoPlaying ? advanceToNext : undefined}
          chameleonResult={chameleonResult}
          participants={participants}
        />
      )
    }

    if (phase === 'favourites') {
      // Full-screen most loved songs reveal
      return (
        <MostLovedSongsReveal
          songs={mostLovedSongs}
          onComplete={() => {
            if (awards.length > 0) {
              setPhase('awards')
            } else {
              setPhase('winner')
            }
          }}
        />
      )
    }

    if (phase === 'awards') {
      // Full-screen hero awards reveal
      const handleAwardRevealed = (award: Award) => {
        // Update live scores when each award is revealed
        setLiveScores(prev => ({
          ...prev,
          [award.recipient.id]: (prev[award.recipient.id] || 0) + award.points,
        }))
        setVisibleAwards(prev => prev + 1)
      }

      return (
        <HeroAwards
          awards={awards}
          onComplete={() => setPhase('winner')}
          onAwardRevealed={handleAwardRevealed}
        />
      )
    }

    if (phase === 'winner') {
      // Find winner using pre-calculated final scores (stable)
      const sortedByScore = [...participants].sort(
        (a, b) => (finalScoresCalculated[b.id] || 0) - (finalScoresCalculated[a.id] || 0)
      )
      const winner = sortedByScore[0]
      return (
        <WinnerReveal
          winner={winner}
          finalScore={finalScoresCalculated[winner.id] || 0}
          onComplete={onComplete}
        />
      )
    }

    return null
  }

  // Calculate max score for Y axis
  const maxScore = Math.max(...Object.values(liveScores), 100)

  // Progress calculation (songs + trivia (if any) + awards + winner)
  const triviaSteps = hasTriviaScores ? 1 : 0
  const totalSteps = part1Rounds.length + triviaSteps + part2Rounds.length + awards.length + 1
  const currentStep =
    phase === 'part1' ? currentIndex + 1 :
    phase === 'trivia' ? part1Rounds.length + 1 :
    phase === 'part2' ? part1Rounds.length + triviaSteps + currentIndex + 1 :
    phase === 'awards' ? part1Rounds.length + triviaSteps + part2Rounds.length + visibleAwards :
    part1Rounds.length + triviaSteps + part2Rounds.length + awards.length + 1

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <div className="w-full max-w-lg flex flex-col flex-1">
        {/* Content - Song Card */}
        <div className="flex-1 flex flex-col justify-center">
          {getCurrentContent()}
        </div>

        {/* Chart & Leaderboard - Hidden on winner/awards phase */}
        {phase !== 'winner' && phase !== 'awards' && phase !== 'favourites' && (
          <>
            {/* Chart - Below Song Card */}
            <div className="flex-shrink-0 mt-4">
              <Card className="border border-primary/20">
                <CardContent className="py-3">
                  <div className="h-[120px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                      >
                        <XAxis
                          dataKey="step"
                          domain={[1, totalSteps]}
                          tick={false}
                          axisLine={false}
                        />
                        <YAxis
                          domain={[0, maxScore + 100]}
                          tick={false}
                          axisLine={false}
                          width={0}
                        />
                        {participants.map((participant, index) => (
                          <Line
                            key={participant.id}
                            type="monotone"
                            dataKey={participant.display_name}
                            stroke={PLAYER_COLOURS[index % PLAYER_COLOURS.length]}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Leaderboard - Below Chart */}
            <div className="flex-shrink-0 mt-2">
              <Card className="border border-primary/20">
                <CardContent className="py-3 px-4">
                  <div className="space-y-2">
                    {sortedParticipants.map((participant, index) => {
                      const colourIndex = participants.findIndex(p => p.id === participant.id)
                      return (
                        <div
                          key={participant.id}
                          className="flex items-center gap-3 transition-all duration-500 ease-out"
                        >
                          {/* Rank */}
                          <span className="w-5 text-center text-sm font-medium text-muted-foreground">
                            {index + 1}
                          </span>

                          {/* Colour indicator matching chart line */}
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: PLAYER_COLOURS[colourIndex % PLAYER_COLOURS.length] }}
                          />

                          {/* Avatar */}
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={participant.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {participant.display_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          {/* Name */}
                          <span className="flex-1 text-sm font-medium truncate">
                            {participant.display_name}
                          </span>

                          {/* Score */}
                          <span className="text-sm font-bold tabular-nums text-primary">
                            {liveScores[participant.id] || 0}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Controls - Bottom Section */}
        <div className="flex-shrink-0 mt-4">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {currentStep}/{totalSteps}
            </span>
          </div>

          {/* Control Buttons */}
          <div className="flex gap-2">
            {phase !== 'winner' && phase !== 'trivia' && phase !== 'awards' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                  className="flex-1"
                >
                  {isAutoPlaying ? 'Pause' : 'Auto-play'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={advanceToNext}
                  className="flex-1"
                >
                  Next →
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Skip to awards phase (scores before awards)
                const scoresBeforeAwards: Record<string, number> = {}
                participants.forEach(p => { scoresBeforeAwards[p.id] = 0 })

                // Add all round scores
                allRounds.forEach(round => {
                  round.correctVoters.forEach(voter => {
                    scoresBeforeAwards[voter.id] = (scoresBeforeAwards[voter.id] || 0) + 100
                  })
                  const chameleonResult = calculateChameleonPoints(round)
                  if (chameleonResult) {
                    scoresBeforeAwards[chameleonResult.ownerId] = (scoresBeforeAwards[chameleonResult.ownerId] || 0) + chameleonResult.points
                  }
                })

                // Add trivia scores
                Object.entries(triviaScores).forEach(([id, score]) => {
                  scoresBeforeAwards[id] = (scoresBeforeAwards[id] || 0) + score
                })

                setLiveScores(scoresBeforeAwards)
                // Go to favourites if available, otherwise awards
                if (hasFavouriteSongs) {
                  setPhase('favourites')
                } else {
                  setPhase('awards')
                }
              }}
              className="text-muted-foreground"
            >
              Skip to {hasFavouriteSongs ? 'Fan Favourites' : 'Awards'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
