'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { Participant, Submission } from '@/types/database'

interface VoterGuess {
  guessedParticipant: Participant | null
  isCorrect: boolean
}

interface RoundResult {
  submission: Submission
  correctParticipant: Participant
  allGuesses: Map<string, VoterGuess>
}

interface SubmissionWithParticipant extends Submission {
  participant: Participant
}

interface StatsViewProps {
  participants: Participant[]
  currentParticipant: Participant
  roundResults: RoundResult[]
  allSubmissions: SubmissionWithParticipant[]
  favouriteVotesByPerson: Record<string, number>
  favouriteVotesBySubmission: Record<string, number>
  onClose: () => void
}

const CHART_COLOURS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]

export function StatsView({
  participants,
  currentParticipant,
  roundResults,
  allSubmissions,
  favouriteVotesByPerson,
  favouriteVotesBySubmission,
  onClose,
}: StatsViewProps) {
  // Calculate all statistics
  const stats = useMemo(() => {
    // Song submitters are participants who actually submitted songs (not spectators)
    const songSubmitters = participants.filter(p => !p.is_spectator)

    // 1. Guessing accuracy per opponent (for current player) - only track song submitters
    const myGuessAccuracy: Record<string, { correct: number; total: number }> = {}
    songSubmitters.forEach(p => {
      if (p.id !== currentParticipant.id) {
        myGuessAccuracy[p.id] = { correct: 0, total: 0 }
      }
    })

    // 2. How hard each player is to guess (only song submitters have songs to guess)
    const hardToGuess: Record<string, { correctGuesses: number; totalGuesses: number }> = {}
    songSubmitters.forEach(p => {
      hardToGuess[p.id] = { correctGuesses: 0, totalGuesses: 0 }
    })

    // 3. Who guessed who correctly (full matrix for compatibility)
    const guessMatrix: Record<string, Record<string, { correct: number; total: number }>> = {}
    participants.forEach(guesser => {
      guessMatrix[guesser.id] = {}
      participants.forEach(target => {
        if (guesser.id !== target.id) {
          guessMatrix[guesser.id][target.id] = { correct: 0, total: 0 }
        }
      })
    })

    // Process all rounds
    roundResults.forEach(round => {
      const songOwnerId = round.correctParticipant.id

      round.allGuesses.forEach((guess, guesserId) => {
        // Skip if guesser is the song owner
        if (guesserId === songOwnerId) return

        // Update hard to guess stats
        hardToGuess[songOwnerId].totalGuesses++
        if (guess.isCorrect) {
          hardToGuess[songOwnerId].correctGuesses++
        }

        // Update guess matrix
        if (guessMatrix[guesserId]?.[songOwnerId]) {
          guessMatrix[guesserId][songOwnerId].total++
          if (guess.isCorrect) {
            guessMatrix[guesserId][songOwnerId].correct++
          }
        }

        // Update my accuracy if I'm the guesser
        if (guesserId === currentParticipant.id && myGuessAccuracy[songOwnerId]) {
          myGuessAccuracy[songOwnerId].total++
          if (guess.isCorrect) {
            myGuessAccuracy[songOwnerId].correct++
          }
        }
      })
    })

    // Calculate percentages and find insights
    const myAccuracyData = Object.entries(myGuessAccuracy)
      .map(([id, data]) => {
        const participant = participants.find(p => p.id === id)!
        const percentage = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
        return {
          id,
          name: participant.display_name,
          avatar: participant.avatar_url,
          correct: data.correct,
          total: data.total,
          percentage,
        }
      })
      .sort((a, b) => b.percentage - a.percentage)

    const hardToGuessData = Object.entries(hardToGuess)
      .map(([id, data]) => {
        const participant = participants.find(p => p.id === id)!
        const percentage = data.totalGuesses > 0
          ? Math.round((data.correctGuesses / data.totalGuesses) * 100)
          : 0
        return {
          id,
          name: participant.display_name,
          avatar: participant.avatar_url,
          guessedCorrectly: data.correctGuesses,
          totalGuesses: data.totalGuesses,
          percentage, // Lower = harder to guess
        }
      })
      .sort((a, b) => a.percentage - b.percentage) // Sort by hardest first

    // Find musical soulmate (who you guess best, excluding yourself)
    const soulmate = myAccuracyData.length > 0 ? myAccuracyData[0] : null

    // Find your nemesis (who you're worst at guessing)
    const nemesis = myAccuracyData.length > 0 ? myAccuracyData[myAccuracyData.length - 1] : null

    // Find who's best at guessing YOU
    const whoGuessesMeBest = Object.entries(guessMatrix)
      .filter(([guesserId]) => guesserId !== currentParticipant.id)
      .map(([guesserId, targets]) => {
        const myData = targets[currentParticipant.id]
        const participant = participants.find(p => p.id === guesserId)!
        const percentage = myData?.total > 0 ? Math.round((myData.correct / myData.total) * 100) : 0
        return {
          id: guesserId,
          name: participant.display_name,
          avatar: participant.avatar_url,
          percentage,
          correct: myData?.correct || 0,
          total: myData?.total || 0,
        }
      })
      .sort((a, b) => b.percentage - a.percentage)

    // Popularity insights per player (only song submitters have songs)
    const popularityByPlayer = songSubmitters.map(p => {
      const theirSongs = allSubmissions.filter(s => s.participant_id === p.id)
      const avgPopularity = theirSongs.length > 0
        ? Math.round(theirSongs.reduce((sum, s) => sum + (s.popularity || 0), 0) / theirSongs.length)
        : 0
      return {
        id: p.id,
        name: p.display_name,
        avatar: p.avatar_url,
        avgPopularity,
        isCurrentUser: p.id === currentParticipant.id,
        isSpectator: p.is_spectator,
      }
    }).sort((a, b) => b.avgPopularity - a.avgPopularity)

    // Song guess rates - ALL songs ranked by guess percentage
    const songGuessRates = roundResults.map(round => {
      let correctCount = 0
      let totalCount = 0
      round.allGuesses.forEach((guess, guesserId) => {
        if (guesserId !== round.correctParticipant.id) {
          totalCount++
          if (guess.isCorrect) correctCount++
        }
      })
      return {
        submission: round.submission,
        owner: round.correctParticipant,
        guessRate: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
        correctCount,
        totalCount,
      }
    })

    // Sort for chart (most guessed to least guessed)
    const songGuessRatesSorted = [...songGuessRates].sort((a, b) => b.guessRate - a.guessRate)

    // Format for bar chart
    const songGuessChartData = songGuessRatesSorted.map(item => ({
      name: item.submission.track_name.length > 20
        ? item.submission.track_name.substring(0, 18) + '...'
        : item.submission.track_name,
      fullName: item.submission.track_name,
      artist: item.submission.artist_name,
      owner: item.owner.display_name,
      guessRate: item.guessRate,
      albumArt: item.submission.album_art_url,
    }))

    const mostSurprising = [...songGuessRates].sort((a, b) => a.guessRate - b.guessRate).slice(0, 3)
    const mostObvious = [...songGuessRates].sort((a, b) => b.guessRate - a.guessRate).slice(0, 3)

    // Favourite votes by song - ranked list
    const favouriteSongRanking = allSubmissions
      .map(sub => ({
        submission: sub,
        owner: sub.participant,
        votes: favouriteVotesBySubmission[sub.id] || 0,
      }))
      .filter(item => item.votes > 0)
      .sort((a, b) => b.votes - a.votes)

    // Favourite votes by person - ranked list
    const favouritePersonRanking = participants
      .map(p => ({
        participant: p,
        votes: favouriteVotesByPerson[p.id] || 0,
        isCurrentUser: p.id === currentParticipant.id,
      }))
      .sort((a, b) => b.votes - a.votes)

    // Check if there are any favourite votes
    const hasFavouriteVotes = Object.values(favouriteVotesBySubmission).some(v => v > 0)

    // BLAME MAGNET - who got falsely accused the most
    const falseAccusations: Record<string, number> = {}
    participants.forEach(p => { falseAccusations[p.id] = 0 })

    roundResults.forEach(round => {
      const correctId = round.correctParticipant.id
      round.allGuesses.forEach((guess, guesserId) => {
        if (guesserId === correctId) return // Skip song owner
        if (guess.guessedParticipant && !guess.isCorrect) {
          // This person was wrongly accused
          falseAccusations[guess.guessedParticipant.id]++
        }
      })
    })

    const blameMagnet = Object.entries(falseAccusations)
      .map(([id, count]) => ({
        participant: participants.find(p => p.id === id)!,
        falseAccusations: count,
      }))
      .sort((a, b) => b.falseAccusations - a.falseAccusations)[0]

    // CONTRARIAN - who voted against the majority most often
    const contrarianCounts: Record<string, { against: number; total: number }> = {}
    participants.forEach(p => { contrarianCounts[p.id] = { against: 0, total: 0 } })

    roundResults.forEach(round => {
      const correctId = round.correctParticipant.id
      // Count votes for each guess
      const voteCounts: Record<string, number> = {}
      round.allGuesses.forEach((guess, guesserId) => {
        if (guesserId === correctId) return
        if (guess.guessedParticipant) {
          voteCounts[guess.guessedParticipant.id] = (voteCounts[guess.guessedParticipant.id] || 0) + 1
        }
      })

      // Find the majority vote
      const majorityVote = Object.entries(voteCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0]

      if (majorityVote) {
        round.allGuesses.forEach((guess, guesserId) => {
          if (guesserId === correctId) return
          contrarianCounts[guesserId].total++
          if (guess.guessedParticipant && guess.guessedParticipant.id !== majorityVote) {
            contrarianCounts[guesserId].against++
          }
        })
      }
    })

    const contrarian = Object.entries(contrarianCounts)
      .filter(([, data]) => data.total > 0)
      .map(([id, data]) => ({
        participant: participants.find(p => p.id === id)!,
        percentage: Math.round((data.against / data.total) * 100),
        against: data.against,
        total: data.total,
      }))
      .sort((a, b) => b.percentage - a.percentage)[0]

    // COMEBACK KID - Split rounds into Part 1 and Part 2, find biggest improvement
    const midpoint = Math.ceil(roundResults.length / 2)
    const part1Rounds = roundResults.slice(0, midpoint)
    const part2Rounds = roundResults.slice(midpoint)

    const comebackData = participants.map(p => {
      let part1Correct = 0, part1Total = 0
      let part2Correct = 0, part2Total = 0

      part1Rounds.forEach(round => {
        if (round.correctParticipant.id === p.id) return
        const guess = round.allGuesses.get(p.id)
        if (guess) {
          part1Total++
          if (guess.isCorrect) part1Correct++
        }
      })

      part2Rounds.forEach(round => {
        if (round.correctParticipant.id === p.id) return
        const guess = round.allGuesses.get(p.id)
        if (guess) {
          part2Total++
          if (guess.isCorrect) part2Correct++
        }
      })

      const part1Pct = part1Total > 0 ? (part1Correct / part1Total) * 100 : 0
      const part2Pct = part2Total > 0 ? (part2Correct / part2Total) * 100 : 0

      return {
        participant: p,
        part1Pct: Math.round(part1Pct),
        part2Pct: Math.round(part2Pct),
        improvement: Math.round(part2Pct - part1Pct),
      }
    }).sort((a, b) => b.improvement - a.improvement)

    const comebackKid = comebackData[0]?.improvement > 0 ? comebackData[0] : null

    // SONG AGE TIMELINE - release years by person (only song submitters have songs)
    const songAgeByPerson = songSubmitters.map(p => {
      const theirSongs = allSubmissions.filter(s => s.participant_id === p.id)
      const years = theirSongs
        .map(s => s.release_year)
        .filter((y): y is number => y !== null)
        .sort((a, b) => a - b)

      const avgYear = years.length > 0
        ? Math.round(years.reduce((sum, y) => sum + y, 0) / years.length)
        : null

      return {
        participant: p,
        years,
        avgYear,
        oldestYear: years[0] || null,
        newestYear: years[years.length - 1] || null,
        isCurrentUser: p.id === currentParticipant.id,
      }
    }).sort((a, b) => (a.avgYear || 2000) - (b.avgYear || 2000))

    return {
      myAccuracyData,
      hardToGuessData,
      soulmate,
      nemesis,
      whoGuessesMeBest,
      popularityByPlayer,
      songGuessChartData,
      mostSurprising,
      mostObvious,
      favouriteSongRanking,
      favouritePersonRanking,
      hasFavouriteVotes,
      blameMagnet,
      contrarian,
      comebackKid,
      songAgeByPerson,
    }
  }, [participants, currentParticipant, roundResults, allSubmissions, favouriteVotesByPerson, favouriteVotesBySubmission])

  return (
    <main className="flex min-h-screen flex-col items-center p-4 py-8">
      <div className="w-full max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Game Statistics</h1>
          <Button variant="outline" onClick={onClose}>
            Back to Results
          </Button>
        </div>

        {/* Top Row - Key Insights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Musical Soulmate */}
          {stats.soulmate && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground mb-2">Musical Soulmate</p>
                <Avatar className="h-12 w-12 mx-auto mb-2">
                  <AvatarImage src={stats.soulmate.avatar || undefined} />
                  <AvatarFallback>{stats.soulmate.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <p className="font-semibold text-sm truncate">{stats.soulmate.name}</p>
                <p className="text-green-500 font-bold">{stats.soulmate.percentage}%</p>
                <p className="text-xs text-muted-foreground">accuracy</p>
              </CardContent>
            </Card>
          )}

          {/* Nemesis */}
          {stats.nemesis && stats.nemesis.id !== stats.soulmate?.id && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground mb-2">Your Nemesis</p>
                <Avatar className="h-12 w-12 mx-auto mb-2">
                  <AvatarImage src={stats.nemesis.avatar || undefined} />
                  <AvatarFallback>{stats.nemesis.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <p className="font-semibold text-sm truncate">{stats.nemesis.name}</p>
                <p className="text-red-500 font-bold">{stats.nemesis.percentage}%</p>
                <p className="text-xs text-muted-foreground">accuracy</p>
              </CardContent>
            </Card>
          )}

          {/* Most Mysterious Player */}
          {stats.hardToGuessData[0] && (
            <Card className="border-purple-500/30 bg-purple-500/5">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground mb-2">Most Mysterious</p>
                <Avatar className="h-12 w-12 mx-auto mb-2">
                  <AvatarImage src={stats.hardToGuessData[0].avatar || undefined} />
                  <AvatarFallback>{stats.hardToGuessData[0].name.charAt(0)}</AvatarFallback>
                </Avatar>
                <p className="font-semibold text-sm truncate">{stats.hardToGuessData[0].name}</p>
                <p className="text-purple-500 font-bold">{stats.hardToGuessData[0].percentage}%</p>
                <p className="text-xs text-muted-foreground">guessed correctly</p>
              </CardContent>
            </Card>
          )}

          {/* Who Knows You Best */}
          {stats.whoGuessesMeBest[0] && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground mb-2">Knows You Best</p>
                <Avatar className="h-12 w-12 mx-auto mb-2">
                  <AvatarImage src={stats.whoGuessesMeBest[0].avatar || undefined} />
                  <AvatarFallback>{stats.whoGuessesMeBest[0].name.charAt(0)}</AvatarFallback>
                </Avatar>
                <p className="font-semibold text-sm truncate">{stats.whoGuessesMeBest[0].name}</p>
                <p className="text-blue-500 font-bold">{stats.whoGuessesMeBest[0].percentage}%</p>
                <p className="text-xs text-muted-foreground">accuracy on you</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Second Row - Fun Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Blame Magnet */}
          {stats.blameMagnet && stats.blameMagnet.falseAccusations > 0 && (
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground mb-2">🎯 Blame Magnet</p>
                <Avatar className="h-12 w-12 mx-auto mb-2">
                  <AvatarImage src={stats.blameMagnet.participant.avatar_url || undefined} />
                  <AvatarFallback>{stats.blameMagnet.participant.display_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <p className="font-semibold text-sm truncate">{stats.blameMagnet.participant.display_name}</p>
                <p className="text-orange-500 font-bold">{stats.blameMagnet.falseAccusations}×</p>
                <p className="text-xs text-muted-foreground">falsely accused</p>
              </CardContent>
            </Card>
          )}

          {/* Contrarian */}
          {stats.contrarian && stats.contrarian.percentage > 0 && (
            <Card className="border-pink-500/30 bg-pink-500/5">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground mb-2">🦊 The Contrarian</p>
                <Avatar className="h-12 w-12 mx-auto mb-2">
                  <AvatarImage src={stats.contrarian.participant.avatar_url || undefined} />
                  <AvatarFallback>{stats.contrarian.participant.display_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <p className="font-semibold text-sm truncate">{stats.contrarian.participant.display_name}</p>
                <p className="text-pink-500 font-bold">{stats.contrarian.percentage}%</p>
                <p className="text-xs text-muted-foreground">against the crowd</p>
              </CardContent>
            </Card>
          )}

          {/* Comeback Kid */}
          {stats.comebackKid && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground mb-2">📈 Comeback Kid</p>
                <Avatar className="h-12 w-12 mx-auto mb-2">
                  <AvatarImage src={stats.comebackKid.participant.avatar_url || undefined} />
                  <AvatarFallback>{stats.comebackKid.participant.display_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <p className="font-semibold text-sm truncate">{stats.comebackKid.participant.display_name}</p>
                <p className="text-emerald-500 font-bold">+{stats.comebackKid.improvement}%</p>
                <p className="text-xs text-muted-foreground">Part 1 → Part 2</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Song Age Timeline */}
        {stats.songAgeByPerson.some(p => p.avgYear !== null) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">📅 Song Release Years by Player</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.songAgeByPerson.map((player) => {
                  if (!player.avgYear) return null
                  const minYear = Math.min(...stats.songAgeByPerson.flatMap(p => p.years))
                  const maxYear = Math.max(...stats.songAgeByPerson.flatMap(p => p.years))
                  const range = maxYear - minYear || 1

                  return (
                    <div key={player.participant.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={player.participant.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">{player.participant.display_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className={`text-sm font-medium ${player.isCurrentUser ? 'text-primary' : ''}`}>
                          {player.participant.display_name}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          avg: {player.avgYear}
                        </span>
                      </div>
                      <div className="relative h-6 bg-muted rounded-full overflow-hidden">
                        {/* Year markers */}
                        {player.years.map((year, idx) => (
                          <div
                            key={idx}
                            className="absolute top-1 bottom-1 w-2 rounded-full bg-primary"
                            style={{
                              left: `${((year - minYear) / range) * 100}%`,
                              transform: 'translateX(-50%)',
                            }}
                            title={`${year}`}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
                {/* Year scale */}
                <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span>{Math.min(...stats.songAgeByPerson.flatMap(p => p.years))}</span>
                  <span>{Math.max(...stats.songAgeByPerson.flatMap(p => p.years))}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Song Guess Rate Chart - Full Width */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Song Guess Rates (Most → Least Guessed)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.songGuessChartData} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-popover border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold">{data.fullName}</p>
                            <p className="text-sm text-muted-foreground">{data.artist}</p>
                            <p className="text-sm mt-1">Picked by: <span className="font-medium">{data.owner}</span></p>
                            <p className="text-sm font-bold text-primary mt-1">{data.guessRate}% guessed correctly</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="guessRate" radius={[0, 4, 4, 0]}>
                    {stats.songGuessChartData.map((_, index) => (
                      <Cell
                        key={index}
                        fill={CHART_COLOURS[index % CHART_COLOURS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Your Guessing Accuracy Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Your Guessing Accuracy by Player</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.myAccuracyData} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, 'Accuracy']}
                    labelFormatter={(name) => `Guessing ${name}`}
                  />
                  <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                    {stats.myAccuracyData.map((entry, index) => (
                      <Cell
                        key={entry.id}
                        fill={CHART_COLOURS[index % CHART_COLOURS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-muted-foreground text-center">
              {stats.myAccuracyData.map(d => `${d.name}: ${d.correct}/${d.total}`).join(' · ')}
            </div>
          </CardContent>
        </Card>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hardest to Guess */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Hardest to Guess</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.hardToGuessData.map((player, index) => (
                  <div key={player.id} className="flex items-center gap-3">
                    <span className="text-lg w-6">{index === 0 ? '🎭' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}</span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={player.avatar || undefined} />
                      <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{player.name}</p>
                      <div className="w-full bg-muted rounded-full h-2 mt-1">
                        <div
                          className="bg-purple-500 h-2 rounded-full transition-all"
                          style={{ width: `${player.percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-purple-500">{player.percentage}%</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Lower % = harder to guess
              </p>
            </CardContent>
          </Card>

          {/* Song Popularity by Player */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Average Song Popularity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.popularityByPlayer.map((player, index) => (
                  <div key={player.id} className="flex items-center gap-3">
                    <span className="text-lg w-6">{index === 0 ? '🎉' : ''}</span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={player.avatar || undefined} />
                      <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm truncate ${player.isCurrentUser ? 'text-primary' : ''}`}>
                        {player.name} {player.isCurrentUser && '(You)'}
                      </p>
                      <div className="w-full bg-muted rounded-full h-2 mt-1">
                        <div
                          className="bg-amber-500 h-2 rounded-full transition-all"
                          style={{ width: `${player.avgPopularity}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-amber-500">{player.avgPopularity}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Spotify popularity score (0-100)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Surprising Songs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Most Surprising */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">🤯 Most Surprising Picks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.mostSurprising.map((item, index) => (
                  <div key={item.submission.id} className="flex items-center gap-3">
                    <span className="text-lg w-6">{index + 1}</span>
                    {item.submission.album_art_url && (
                      <img
                        src={item.submission.album_art_url}
                        alt=""
                        className="w-10 h-10 rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.submission.track_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.owner.display_name} · {item.guessRate}% guessed
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Most Obvious */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">😅 Dead Giveaways</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.mostObvious.map((item, index) => (
                  <div key={item.submission.id} className="flex items-center gap-3">
                    <span className="text-lg w-6">{index + 1}</span>
                    {item.submission.album_art_url && (
                      <img
                        src={item.submission.album_art_url}
                        alt=""
                        className="w-10 h-10 rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.submission.track_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.owner.display_name} · {item.guessRate}% guessed
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Favourite Votes Section */}
        {stats.hasFavouriteVotes && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Most Loved Songs */}
            <Card className="border-yellow-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">⭐ Most Loved Songs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.favouriteSongRanking.slice(0, 5).map((item, index) => (
                    <div key={item.submission.id} className="flex items-center gap-3">
                      <span className="text-lg w-6">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                      </span>
                      {item.submission.album_art_url && (
                        <img
                          src={item.submission.album_art_url}
                          alt=""
                          className="w-10 h-10 rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.submission.track_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.owner.display_name}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-yellow-500">{item.votes} votes</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Votes Received by Person */}
            <Card className="border-yellow-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">👑 Crowd Pleasers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.favouritePersonRanking.map((item, index) => (
                    <div key={item.participant.id} className="flex items-center gap-3">
                      <span className="text-lg w-6">
                        {index === 0 ? '👑' : ''}
                      </span>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={item.participant.avatar_url || undefined} />
                        <AvatarFallback>{item.participant.display_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm truncate ${item.isCurrentUser ? 'text-primary' : ''}`}>
                          {item.participant.display_name} {item.isCurrentUser && '(You)'}
                        </p>
                        <div className="w-full bg-muted rounded-full h-2 mt-1">
                          <div
                            className="bg-yellow-500 h-2 rounded-full transition-all"
                            style={{ width: `${(item.votes / Math.max(...stats.favouritePersonRanking.map(p => p.votes), 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-yellow-500">{item.votes}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Total votes received for all songs
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Button variant="outline" onClick={onClose} className="w-full">
          Back to Results
        </Button>
      </div>
    </main>
  )
}
