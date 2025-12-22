'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { SongRevealCard } from './song-reveal-card'
import { AwardBadge, Award, calculateAwards } from './award-reveal'
import { WinnerReveal } from './winner-reveal'
import type { Participant, Submission } from '@/types/database'

interface RoundDetail {
  roundNumber: number
  submission: Submission
  correctParticipant: Participant
  correctVoters: Participant[]
}

// Chameleon scoring constants
const CHAMELEON_BONUS_PER_WRONG_GUESS = 75  // Bonus for each player you fooled
const CHAMELEON_PENALTY_PER_CORRECT_GUESS = 50  // Penalty for each player who caught you

// Calculate chameleon points for a round
function calculateChameleonPoints(
  round: RoundDetail,
  totalSubmittedParticipants: number
): { ownerId: string; points: number; wrongGuesses: number; correctGuesses: number } | null {
  if (!round.submission.is_chameleon) return null

  const ownerId = round.correctParticipant.id
  const correctGuesses = round.correctVoters.length
  // Potential voters = all participants except the owner (who can't vote on their own song)
  const potentialVoters = totalSubmittedParticipants - 1
  const wrongGuesses = potentialVoters - correctGuesses

  const bonus = wrongGuesses * CHAMELEON_BONUS_PER_WRONG_GUESS
  const penalty = correctGuesses * CHAMELEON_PENALTY_PER_CORRECT_GUESS
  const points = bonus - penalty

  return { ownerId, points, wrongGuesses, correctGuesses }
}

interface ResultsRevealProps {
  participants: Participant[]
  part1Rounds: RoundDetail[]
  part2Rounds: RoundDetail[]
  triviaScores: Record<string, number> // participantId -> trivia score
  onComplete: () => void
}

type Phase = 'part1' | 'trivia' | 'part2' | 'winner'

const PLAYER_COLOURS = [
  '#ef4444', '#22c55e', '#3b82f6', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]

export function ResultsReveal({
  participants,
  part1Rounds,
  part2Rounds,
  triviaScores,
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
    const calculatedAwards = calculateAwards(participants, allRounds, triviaScores)
    setAwards(calculatedAwards)
  }, [participants, allRounds, triviaScores])

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
      const chameleonResult = calculateChameleonPoints(round, participants.length)
      if (chameleonResult) {
        scores[chameleonResult.ownerId] = (scores[chameleonResult.ownerId] || 0) + chameleonResult.points
      }
    })

    // Add trivia scores
    Object.entries(triviaScores).forEach(([id, score]) => {
      scores[id] = (scores[id] || 0) + score
    })

    // Add award points
    const calculatedAwards = calculateAwards(participants, allRounds, triviaScores)
    calculatedAwards.forEach(award => {
      scores[award.recipient.id] = (scores[award.recipient.id] || 0) + award.points
    })

    return scores
  }, [participants, allRounds, triviaScores])

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
          const chameleonResult = calculateChameleonPoints(round, participants.length)
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
          const chameleonResult = calculateChameleonPoints(round, participants.length)
          if (chameleonResult) {
            next[chameleonResult.ownerId] = (next[chameleonResult.ownerId] || 0) + chameleonResult.points
          }
          return next
        })
      }

      if (currentIndex < part2Rounds.length - 1) {
        setCurrentIndex(prev => prev + 1)
      } else {
        // Start revealing awards, then go to winner
        if (awards.length > 0) {
          // Start auto-revealing awards one by one
          let awardIndex = 0
          const revealInterval = setInterval(() => {
            if (awardIndex < awards.length) {
              const award = awards[awardIndex]
              setLiveScores(prev => ({
                ...prev,
                [award.recipient.id]: (prev[award.recipient.id] || 0) + award.points,
              }))
              setVisibleAwards(awardIndex + 1)
              awardIndex++
            } else {
              clearInterval(revealInterval)
              // Go to winner after all awards shown
              setTimeout(() => setPhase('winner'), 1500)
            }
          }, 1000)
        } else {
          setPhase('winner')
        }
      }
    }
  }, [phase, currentIndex, part1Rounds, part2Rounds, triviaScores, awards, hasTriviaScores, participants])

  // Get current content based on phase
  const getCurrentContent = () => {
    if (phase === 'part1') {
      const round = part1Rounds[currentIndex]
      if (!round) return null
      const chameleonResult = calculateChameleonPoints(round, participants.length)
      return (
        <SongRevealCard
          submission={round.submission}
          pickedBy={round.correctParticipant}
          correctVoters={round.correctVoters}
          roundNumber={currentIndex + 1}
          totalRounds={part1Rounds.length}
          phase="part1"
          onAudioEnd={isAutoPlaying ? advanceToNext : undefined}
          chameleonResult={chameleonResult}
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
      const chameleonResult = calculateChameleonPoints(round, participants.length)
      return (
        <SongRevealCard
          submission={round.submission}
          pickedBy={round.correctParticipant}
          correctVoters={round.correctVoters}
          roundNumber={currentIndex + 1}
          totalRounds={part2Rounds.length}
          phase="part2"
          onAudioEnd={isAutoPlaying ? advanceToNext : undefined}
          chameleonResult={chameleonResult}
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
  const maxScore = Math.max(
    ...Object.values(liveScores),
    100
  )

  // Progress calculation (songs + trivia (if any) + awards + winner)
  const triviaSteps = hasTriviaScores ? 1 : 0
  const totalSteps = part1Rounds.length + triviaSteps + part2Rounds.length + awards.length + 1
  const currentStep =
    phase === 'part1' ? currentIndex + 1 :
    phase === 'trivia' ? part1Rounds.length + 1 :
    phase === 'part2' ? part1Rounds.length + triviaSteps + currentIndex + 1 :
    part1Rounds.length + triviaSteps + part2Rounds.length + visibleAwards + (phase === 'winner' ? 1 : 0)

  return (
    <div className="min-h-screen flex flex-col p-4">
      {/* Chart - Top Section */}
      <div className="flex-shrink-0 mb-4">
        <Card className="border border-primary/20">
          <CardContent className="pt-4">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="step"
                    domain={[1, totalSteps]}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickLine={false}
                    type="number"
                    allowDataOverflow={false}
                  />
                  <YAxis
                    domain={[0, maxScore + 100]}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickLine={false}
                    width={40}
                  />
                  {participants.map((participant, index) => (
                    <Line
                      key={participant.id}
                      type="monotone"
                      dataKey={participant.display_name}
                      stroke={PLAYER_COLOURS[index % PLAYER_COLOURS.length]}
                      strokeWidth={3}
                      dot={{ fill: PLAYER_COLOURS[index % PLAYER_COLOURS.length], r: 4 }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-3 mt-2 pb-2">
              {participants.map((participant, index) => (
                <div key={participant.id} className="flex items-center gap-1.5 text-sm">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: PLAYER_COLOURS[index % PLAYER_COLOURS.length] }}
                  />
                  <span>{participant.display_name}</span>
                  <span className="text-muted-foreground font-mono">
                    ({liveScores[participant.id] || 0})
                  </span>
                </div>
              ))}
            </div>

            {/* Awards - Show after Part 2 */}
            {awards.length > 0 && (phase === 'part2' && currentIndex === part2Rounds.length - 1 || phase === 'winner' || visibleAwards > 0) && (
              <div className="flex gap-2 mt-3 pt-3 border-t">
                {awards.map((award, index) => (
                  <AwardBadge
                    key={award.id}
                    award={award}
                    isVisible={index < visibleAwards}
                    delay={index * 100}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content - Middle Section */}
      <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full">
        {getCurrentContent()}
      </div>

      {/* Controls - Bottom Section */}
      <div className="flex-shrink-0 mt-4 max-w-lg mx-auto w-full">
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
          {phase !== 'winner' && phase !== 'trivia' && (
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
              setVisibleAwards(awards.length)
              // Set to pre-calculated final scores (stable calculation)
              setLiveScores(finalScoresCalculated)
              setPhase('winner')
            }}
            className="text-muted-foreground"
          >
            Skip All
          </Button>
        </div>
      </div>
    </div>
  )
}
