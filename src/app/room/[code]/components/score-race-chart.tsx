'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Participant } from '@/types/database'

interface RoundScore {
  round: number
  [participantName: string]: number
}

interface RoundDetail {
  roundNumber: number
  trackName: string
  artistName: string
  albumArt: string | null
  correctParticipant: Participant
  correctVoters: Participant[] // Who voted correctly this round
}

interface ScoreRaceChartProps {
  participants: Participant[]
  scoreData: RoundScore[]
  roundDetails: RoundDetail[]
  onComplete: () => void
}

const PLAYER_COLOURS = [
  '#ef4444', // red
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
]

export function ScoreRaceChart({
  participants,
  scoreData,
  roundDetails,
  onComplete,
}: ScoreRaceChartProps) {
  const [displayedRounds, setDisplayedRounds] = useState(0)
  const [animationComplete, setAnimationComplete] = useState(scoreData.length === 0)
  const [isPaused, setIsPaused] = useState(false)

  const totalRounds = scoreData.length

  // Step through rounds slowly
  useEffect(() => {
    if (totalRounds === 0) return
    if (isPaused || animationComplete) return

    // Slower: 1.5 seconds per round
    const interval = 1500

    const timer = setInterval(() => {
      setDisplayedRounds(prev => {
        const next = prev + 1
        if (next >= totalRounds) {
          clearInterval(timer)
          setTimeout(() => setAnimationComplete(true), 1000)
          return totalRounds
        }
        return next
      })
    }, interval)

    // Start with first round after a brief delay
    if (displayedRounds === 0) {
      const startTimer = setTimeout(() => {
        setDisplayedRounds(1)
      }, 500)
      return () => {
        clearInterval(timer)
        clearTimeout(startTimer)
      }
    }

    return () => clearInterval(timer)
  }, [totalRounds, isPaused, animationComplete, displayedRounds])

  // Get data to display (only up to current round)
  const visibleData = scoreData.slice(0, displayedRounds)

  // Current round detail
  const currentRoundDetail = displayedRounds > 0 && roundDetails.length >= displayedRounds
    ? roundDetails[displayedRounds - 1]
    : null

  // Find max score for Y axis
  const maxScore = Math.max(
    ...scoreData.flatMap(round =>
      participants.map(p => (round[p.display_name] as number) || 0)
    ),
    100
  )

  // Get colour for a participant
  const getParticipantColour = (participantId: string) => {
    const index = participants.findIndex(p => p.id === participantId)
    return PLAYER_COLOURS[index % PLAYER_COLOURS.length]
  }

  if (totalRounds === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Chart Card - Much bigger */}
      <Card className="border-2 border-primary/30">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-3xl bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            Score Race
          </CardTitle>
          <p className="text-muted-foreground">
            {animationComplete
              ? 'Final scores!'
              : `Round ${displayedRounds} of ${totalRounds}`}
          </p>
        </CardHeader>
        <CardContent>
          {/* Much taller chart */}
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={visibleData}
                margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="round"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 14 }}
                  tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                  label={{ value: 'Round', position: 'bottom', offset: -5 }}
                />
                <YAxis
                  domain={[0, maxScore]}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 14 }}
                  tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                  label={{ value: 'Score', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                {participants.map((participant, index) => (
                  <Line
                    key={participant.id}
                    type="monotone"
                    dataKey={participant.display_name}
                    stroke={PLAYER_COLOURS[index % PLAYER_COLOURS.length]}
                    strokeWidth={4}
                    dot={{ fill: PLAYER_COLOURS[index % PLAYER_COLOURS.length], r: 6 }}
                    activeDot={{ r: 8 }}
                    animationDuration={500}
                    isAnimationActive={true}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {participants.map((participant, index) => (
              <div key={participant.id} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: PLAYER_COLOURS[index % PLAYER_COLOURS.length] }}
                />
                <span className="text-sm font-medium">{participant.display_name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Round Detail Card */}
      {currentRoundDetail && !animationComplete && (
        <Card className="border border-secondary/30 animate-in fade-in duration-300">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              {/* Album art */}
              {currentRoundDetail.albumArt && (
                <img
                  src={currentRoundDetail.albumArt}
                  alt=""
                  className="w-20 h-20 rounded-lg shadow-md flex-shrink-0"
                />
              )}

              <div className="flex-1 min-w-0">
                {/* Song info */}
                <p className="font-bold text-lg truncate">{currentRoundDetail.trackName}</p>
                <p className="text-muted-foreground truncate">{currentRoundDetail.artistName}</p>

                {/* Who picked it */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-muted-foreground">Picked by:</span>
                  <div className="flex items-center gap-1">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={currentRoundDetail.correctParticipant.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {currentRoundDetail.correctParticipant.display_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className="font-semibold text-sm"
                      style={{ color: getParticipantColour(currentRoundDetail.correctParticipant.id) }}
                    >
                      {currentRoundDetail.correctParticipant.display_name}
                    </span>
                  </div>
                </div>

                {/* Who voted correctly */}
                <div className="mt-3">
                  {currentRoundDetail.correctVoters.length > 0 ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground">Correct guesses:</span>
                      {currentRoundDetail.correctVoters.map(voter => (
                        <div
                          key={voter.id}
                          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${getParticipantColour(voter.id)}20`,
                            color: getParticipantColour(voter.id),
                          }}
                        >
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={voter.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {voter.display_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          {voter.display_name} +100
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">No correct guesses</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="flex gap-3">
        {!animationComplete ? (
          <>
            <Button
              onClick={() => setIsPaused(!isPaused)}
              variant="outline"
              className="flex-1"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              onClick={() => {
                setDisplayedRounds(totalRounds)
                setAnimationComplete(true)
              }}
              variant="ghost"
              className="flex-1"
            >
              Skip to End
            </Button>
          </>
        ) : (
          <Button onClick={onComplete} className="w-full h-14 text-lg">
            View Final Results
          </Button>
        )}
      </div>
    </div>
  )
}
