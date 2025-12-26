'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ResultsReveal } from './results-reveal'
import { SongLibrary } from './song-library'
import { StatsView } from './stats-view'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import { calculateAwards } from './award-reveal'
import { Badge } from '@/components/ui/badge'
import type { Room, Participant, Submission } from '@/types/database'

// Chameleon scoring constants (must match results-reveal.tsx)
const CHAMELEON_BONUS_PER_MATCH = 100  // Bonus for each player who guessed your declared target
const CHAMELEON_PENALTY_PER_CAUGHT = 125  // Penalty for each player who guessed you correctly

interface SubmissionWithParticipant extends Submission {
  participant: Participant
}

interface ResultsViewProps {
  room: Room
  participants: Participant[]
  currentParticipant: Participant
  onPlayAgain: () => void
}

interface RoundResult {
  submission: Submission
  correctParticipant: Participant
  allGuesses: Map<string, { guessedParticipant: Participant | null; isCorrect: boolean }>
}

interface RoundScore {
  round: number
  [participantName: string]: number
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

export function ResultsView({
  room,
  participants,
  currentParticipant,
  onPlayAgain,
}: ResultsViewProps) {
  const [phase, setPhase] = useState<'reveal' | 'results' | 'library' | 'stats'>('reveal')
  const [part1Rounds, setPart1Rounds] = useState<RoundDetail[]>([])
  const [part2Rounds, setPart2Rounds] = useState<RoundDetail[]>([])
  const [triviaScores, setTriviaScores] = useState<Record<string, number>>({})
  const [favouriteScores, setFavouriteScores] = useState<Record<string, number>>({})
  const [favouriteVoteCounts, setFavouriteVoteCounts] = useState<Record<string, number>>({})
  const [favouriteVotesBySubmission, setFavouriteVotesBySubmission] = useState<Record<string, number>>({})
  const [finalScores, setFinalScores] = useState<Participant[]>([])
  const [roundResults, setRoundResults] = useState<RoundResult[]>([])
  const [allSubmissions, setAllSubmissions] = useState<SubmissionWithParticipant[]>([])
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [coverRevealed, setCoverRevealed] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const [hasSpotify, setHasSpotify] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const celebrationAudioRef = useRef<HTMLAudioElement | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const isHost = currentParticipant.is_host

  // Prepare celebration audio
  useEffect(() => {
    const audio = new Audio('/winner-music.mp3')
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = 0.5
    celebrationAudioRef.current = audio

    return () => {
      audio.pause()
    }
  }, [])

  const startVictoryMusic = useCallback(() => {
    if (!celebrationAudioRef.current) return
    celebrationAudioRef.current.currentTime = 0
    celebrationAudioRef.current.play().catch(console.error)
  }, [])

  const stopVictoryMusic = useCallback(() => {
    celebrationAudioRef.current?.pause()
  }, [])

  // Check if user has Spotify connected
  useEffect(() => {
    const checkSpotify = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setHasSpotify(!!session?.provider_token)
    }
    checkSpotify()
  }, [supabase.auth])

  useEffect(() => {
    const fetchResults = async () => {
      // Fetch final scores
      const { data: scoresData } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', room.id)
        .order('score', { ascending: false })

      if (scoresData) {
        setFinalScores(scoresData as Participant[])
      }

      // Fetch all submissions with participant info for song library
      const participantIds = participants.map(p => p.id)
      const { data: submissionsData } = await supabase
        .from('submissions')
        .select('*')
        .in('participant_id', participantIds)
        .order('submission_order', { ascending: true })

      if (submissionsData) {
        const submissionsWithParticipant: SubmissionWithParticipant[] = submissionsData.map(sub => ({
          ...sub,
          participant: participants.find(p => p.id === sub.participant_id)!,
        }))
        setAllSubmissions(submissionsWithParticipant)
      }

      // Fetch round results with votes
      const { data: quizRounds } = await supabase
        .from('quiz_rounds')
        .select('*, submission:submissions(*)')
        .eq('room_id', room.id)
        .order('round_number', { ascending: true })

      // Fetch trivia answers to calculate trivia scores
      const { data: triviaAnswers } = await supabase
        .from('trivia_answers')
        .select('participant_id, points_awarded')
        .in('participant_id', participants.map(p => p.id))

      // Calculate trivia scores per participant
      const triviaScoreMap: Record<string, number> = {}
      participants.forEach(p => { triviaScoreMap[p.id] = 0 })
      triviaAnswers?.forEach(answer => {
        triviaScoreMap[answer.participant_id] = (triviaScoreMap[answer.participant_id] || 0) + (answer.points_awarded || 0)
      })
      setTriviaScores(triviaScoreMap)

      // Fetch favourite votes and calculate favourite scores (50 points per vote received)
      const { data: favouriteVotes } = await supabase
        .from('favourite_votes')
        .select('submission_id')
        .eq('room_id', room.id)

      const favouriteScoreMap: Record<string, number> = {}
      const favouriteVoteCountMap: Record<string, number> = {}
      const favouriteVotesBySubmissionMap: Record<string, number> = {}
      participants.forEach(p => {
        favouriteScoreMap[p.id] = 0
        favouriteVoteCountMap[p.id] = 0
      })
      if (favouriteVotes && submissionsData) {
        favouriteVotes.forEach(vote => {
          // Track votes by submission
          favouriteVotesBySubmissionMap[vote.submission_id] =
            (favouriteVotesBySubmissionMap[vote.submission_id] || 0) + 1

          const submission = submissionsData.find(s => s.id === vote.submission_id)
          if (submission) {
            favouriteScoreMap[submission.participant_id] =
              (favouriteScoreMap[submission.participant_id] || 0) + 50
            favouriteVoteCountMap[submission.participant_id] =
              (favouriteVoteCountMap[submission.participant_id] || 0) + 1
          }
        })
      }
      setFavouriteScores(favouriteScoreMap)
      setFavouriteVoteCounts(favouriteVoteCountMap)
      setFavouriteVotesBySubmission(favouriteVotesBySubmissionMap)

      if (quizRounds && quizRounds.length > 0) {
        // Fetch all votes for the room's rounds
        const roundIds = quizRounds.map((r: { id: string }) => r.id)
        const { data: allVotes } = await supabase
          .from('votes')
          .select('*')
          .in('round_id', roundIds)

        const details: RoundDetail[] = []

        quizRounds.forEach((round: { id: string; round_number: number; submission: Submission }) => {
          // Find all votes for this round
          const roundVotes = allVotes?.filter(v => v.round_id === round.id) || []

          // Find correct voter IDs (voters who guessed the owner)
          const correctVoterIds: string[] = []
          roundVotes.forEach(vote => {
            if (vote.is_correct === true) {
              correctVoterIds.push(vote.voter_id)
            }
          })

          // Build round detail
          const submission = round.submission as Submission
          const correctParticipant = participants.find(p => p.id === submission.participant_id)!
          const correctVoters = participants.filter(p => correctVoterIds.includes(p.id))

          // Build allGuesses map
          const allGuesses = new Map<string, VoterGuess>()
          participants.forEach(p => {
            const vote = roundVotes.find(v => v.voter_id === p.id)
            if (vote) {
              const guessedParticipant = vote.guessed_participant_id
                ? participants.find(gp => gp.id === vote.guessed_participant_id) || null
                : null
              allGuesses.set(p.id, { guessedParticipant, isCorrect: vote.is_correct === true })
            } else {
              allGuesses.set(p.id, { guessedParticipant: null, isCorrect: false })
            }
          })

          // Build chameleon votes info if this is a chameleon song
          let chameleonVotes: ChameleonVotes | undefined
          if (submission.is_chameleon) {
            // Find owner's vote (is_correct = null indicates target declaration)
            const ownerVote = roundVotes.find(
              v => v.voter_id === correctParticipant.id && v.is_correct === null
            )
            const declaredTargetId = ownerVote?.guessed_participant_id || null

            // Find other voters who voted for the same target
            const targetVoterIds: string[] = []
            if (declaredTargetId) {
              roundVotes.forEach(vote => {
                // Non-owner votes that guessed the same target
                if (vote.voter_id !== correctParticipant.id &&
                    vote.guessed_participant_id === declaredTargetId) {
                  targetVoterIds.push(vote.voter_id)
                }
              })
            }

            chameleonVotes = { declaredTargetId, targetVoterIds }
          }

          details.push({
            roundNumber: round.round_number,
            submission,
            correctParticipant,
            correctVoters,
            allGuesses,
            chameleonVotes,
          })
        })

        // Split into part1 and part2
        const midpoint = Math.ceil(details.length / 2)
        setPart1Rounds(details.slice(0, midpoint))
        setPart2Rounds(details.slice(midpoint))

        // Build results with everyone's guesses
        const results: RoundResult[] = quizRounds.map((round: { submission: Submission; id: string }) => {
          const submission = round.submission as Submission
          const correctParticipant = participants.find(p => p.id === submission.participant_id)!
          const roundVotes = allVotes?.filter(v => v.round_id === round.id) || []

          // Map of participant ID -> their guess
          const allGuesses = new Map<string, { guessedParticipant: Participant | null; isCorrect: boolean }>()
          participants.forEach(p => {
            const vote = roundVotes.find(v => v.voter_id === p.id)
            if (vote) {
              const guessedParticipant = vote.guessed_participant_id
                ? participants.find(gp => gp.id === vote.guessed_participant_id) || null
                : null
              allGuesses.set(p.id, { guessedParticipant, isCorrect: vote.is_correct })
            } else {
              allGuesses.set(p.id, { guessedParticipant: null, isCorrect: false })
            }
          })

          return {
            submission,
            correctParticipant,
            allGuesses,
          }
        })

        setRoundResults(results)
      } else {
        // No rounds, skip reveal
        setPhase('results')
      }

      setIsLoading(false)
    }

    fetchResults()
  }, [room.id, currentParticipant.id, participants, supabase])

  const handleCreatePlaylist = async () => {
    setIsCreatingPlaylist(true)
    setCoverRevealed(false)
    try {
      const response = await fetch('/api/spotify/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          playlistName: `Festive Frequencies - ${room.name || room.room_code}`,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setPlaylistUrl(data.playlistUrl)
        if (data.coverImage) {
          setCoverImage(data.coverImage)
          // Trigger reveal animation after a brief delay
          setTimeout(() => setCoverRevealed(true), 100)
        }
      } else {
        alert(data.error || 'Failed to create playlist')
      }
    } catch (error) {
      console.error('Playlist error:', error)
      alert('Failed to create playlist. Please try again.')
    } finally {
      setIsCreatingPlaylist(false)
    }
  }

  const handlePlayAgain = async () => {
    stopVictoryMusic()
    // Reset all participants: score, submission status, and spectator status
    await supabase
      .from('participants')
      .update({ score: 0, has_submitted: false, is_spectator: false })
      .eq('room_id', room.id)

    const participantIds = participants.map(p => p.id)
    await supabase
      .from('submissions')
      .delete()
      .in('participant_id', participantIds)

    await supabase
      .from('quiz_rounds')
      .delete()
      .eq('room_id', room.id)

    onPlayAgain()
  }

  const handleBackToLobby = () => {
    stopVictoryMusic()
    router.push('/lobby')
  }

  // Calculate final scores including chameleon points and awards
  const calculatedScores = useMemo(() => {
    const allRounds = [...part1Rounds, ...part2Rounds]
    const scores: Record<string, number> = {}
    participants.forEach(p => { scores[p.id] = 0 })

    // Add round scores (100 points per correct guess)
    allRounds.forEach(round => {
      round.correctVoters.forEach(voter => {
        scores[voter.id] = (scores[voter.id] || 0) + 100
      })

      // Add chameleon scoring
      if (round.submission.is_chameleon && round.chameleonVotes) {
        const ownerId = round.correctParticipant.id
        const { targetVoterIds } = round.chameleonVotes
        const matchCount = targetVoterIds.length  // Players who matched owner's target
        const caughtCount = round.correctVoters.length  // Players who guessed owner

        const bonus = matchCount * CHAMELEON_BONUS_PER_MATCH
        const penalty = caughtCount * CHAMELEON_PENALTY_PER_CAUGHT
        scores[ownerId] = (scores[ownerId] || 0) + bonus - penalty
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
    const submissionsWithParticipantId = allSubmissions.map(s => ({
      participant_id: s.participant_id,
      popularity: s.popularity,
    }))
    const awards = calculateAwards(
      participants,
      allRounds,
      submissionsWithParticipantId,
      favouriteVoteCounts,
      triviaScores
    )
    awards.forEach(award => {
      scores[award.recipient.id] = (scores[award.recipient.id] || 0) + award.points
    })

    return scores
  }, [participants, part1Rounds, part2Rounds, triviaScores, favouriteScores, favouriteVoteCounts, allSubmissions])

  // Sort participants by calculated score
  const sortedParticipants = useMemo(() => {
    return [...participants].sort(
      (a, b) => (calculatedScores[b.id] || 0) - (calculatedScores[a.id] || 0)
    )
  }, [participants, calculatedScores])

  const getRankEmoji = (index: number) => {
    switch (index) {
      case 0: return '🥇'
      case 1: return '🥈'
      case 2: return '🥉'
      default: return `${index + 1}`
    }
  }

  const getRankStyle = (index: number) => {
    switch (index) {
      case 0: return 'bg-yellow-500/20 border-yellow-500/50'
      case 1: return 'bg-slate-300/20 border-slate-400/50'
      case 2: return 'bg-amber-700/20 border-amber-700/50'
      default: return ''
    }
  }

  const correctCount = roundResults.filter(r => {
    const myGuess = r.allGuesses.get(currentParticipant.id)
    return myGuess?.isCorrect || false
  }).length

  // Show loading state
  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="animate-pulse text-2xl">Loading results...</div>
      </main>
    )
  }

  // Show reveal phase first
  if (phase === 'reveal' && (part1Rounds.length > 0 || part2Rounds.length > 0)) {
    return (
      <ResultsReveal
        participants={participants}
        part1Rounds={part1Rounds}
        part2Rounds={part2Rounds}
        triviaScores={triviaScores}
        favouriteVoteCounts={favouriteVoteCounts}
        favouriteScores={favouriteScores}
        favouriteVotesBySubmission={favouriteVotesBySubmission}
        submissions={allSubmissions}
        onComplete={() => setPhase('results')}
        onWinnerCelebrationStart={startVictoryMusic}
      />
    )
  }

  // Show song library
  if (phase === 'library') {
    return (
      <main className="min-h-screen p-4 py-8">
        <div className="max-w-6xl mx-auto">
          <SongLibrary
            roomId={room.id}
            roomCode={room.room_code}
            submissions={allSubmissions}
            hasSpotify={hasSpotify}
            onClose={() => setPhase('results')}
          />
        </div>
      </main>
    )
  }

  // Show stats view
  if (phase === 'stats') {
    return (
      <StatsView
        participants={participants}
        currentParticipant={currentParticipant}
        roundResults={roundResults}
        allSubmissions={allSubmissions}
        favouriteVotesByPerson={favouriteVoteCounts}
        favouriteVotesBySubmission={favouriteVotesBySubmission}
        onClose={() => setPhase('results')}
      />
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 py-8">
      <div className="w-full max-w-6xl">
        <div className="max-w-md mx-auto lg:max-w-none">
          <GameBreadcrumbs currentStage="results" />
        </div>

        {/* Header */}
        <div className="text-center space-y-2 mt-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            Quiz Complete!
          </h1>
          <p className="text-muted-foreground">
            You got {correctCount} out of {roundResults.length} correct
          </p>
        </div>

        {/* Two-column layout on larger screens */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column - Scores & Actions (2/5 width on lg) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Leaderboard */}
            <Card className="border-2 border-secondary/30">
              <CardHeader>
                <CardTitle className="text-center">Final Scores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sortedParticipants.map((participant, index) => (
                    <div
                      key={participant.id}
                      className={`flex items-center gap-4 p-3 rounded-lg border ${getRankStyle(index)} ${
                        participant.id === currentParticipant.id ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      <span className="text-2xl w-10 text-center">
                        {getRankEmoji(index)}
                      </span>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={participant.avatar_url || undefined} />
                        <AvatarFallback>
                          {participant.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold flex items-center gap-2">
                          {participant.display_name}
                          {participant.id === currentParticipant.id && (
                            <span className="text-muted-foreground text-sm">(You)</span>
                          )}
                          {participant.is_spectator && (
                            <Badge variant="outline" className="text-muted-foreground text-xs">👁</Badge>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-secondary">{calculatedScores[participant.id] || 0}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* View Options */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowAnswers(!showAnswers)}
                  variant="outline"
                  className="flex-1 lg:hidden"
                >
                  {showAnswers ? 'Hide Answers' : 'Show Answers'}
                </Button>
                <Button
                  onClick={() => setPhase('library')}
                  variant="outline"
                  className="flex-1"
                >
                  Song Library
                </Button>
              </div>
              <Button
                onClick={() => setPhase('stats')}
                variant="outline"
                className="w-full"
              >
                📊 View Statistics
              </Button>
            </div>

            {/* Create Playlist */}
            <Card className="border-2 border-accent/30">
              <CardContent className="pt-6">
                {isCreatingPlaylist ? (
                  <div className="text-center space-y-4 py-4">
                    <div className="relative w-32 h-32 mx-auto">
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 animate-pulse" />
                      <div className="absolute inset-2 rounded bg-card flex items-center justify-center">
                        <span className="text-4xl animate-bounce">🎨</span>
                      </div>
                    </div>
                    <p className="text-muted-foreground animate-pulse">
                      Creating your cover art...
                    </p>
                  </div>
                ) : playlistUrl ? (
                  <div className="text-center space-y-4">
                    {coverImage && (
                      <div className="relative">
                        <img
                          src={`data:image/png;base64,${coverImage}`}
                          alt="Playlist cover"
                          className={`w-full max-w-[200px] mx-auto rounded-lg shadow-lg transition-all duration-700 ${
                            coverRevealed
                              ? 'opacity-100 scale-100'
                              : 'opacity-0 scale-95'
                          }`}
                        />
                      </div>
                    )}
                    <p className="text-accent font-semibold">Playlist created!</p>
                    <Button
                      asChild
                      className="w-full h-12 bg-[#1DB954] hover:bg-[#1ed760] text-white"
                    >
                      <a href={playlistUrl} target="_blank" rel="noopener noreferrer">
                        Open in Spotify
                      </a>
                    </Button>
                  </div>
                ) : hasSpotify ? (
                  <Button
                    onClick={handleCreatePlaylist}
                    disabled={isCreatingPlaylist}
                    variant="secondary"
                    className="w-full h-12"
                  >
                    Save All Songs to Spotify Playlist
                  </Button>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-2">
                    Connect Spotify from the menu to save playlists
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-3">
              {isHost && (
                <Button onClick={handlePlayAgain} className="w-full h-12 text-lg">
                  Play Again
                </Button>
              )}
              <Button
                onClick={handleBackToLobby}
                variant="outline"
                className="w-full h-12"
              >
                Back to Lobby
              </Button>
            </div>
          </div>

          {/* Right Column - Answers Table (3/5 width on lg, always visible on lg) */}
          <div className={`lg:col-span-3 ${showAnswers ? 'block' : 'hidden lg:block'}`}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-center text-lg">Round by Round</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Song</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Answer</th>
                        {sortedParticipants.map(p => (
                          <th key={p.id} className="text-center py-2 px-2 font-medium text-muted-foreground">
                            <div className="flex flex-col items-center gap-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={p.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">{p.display_name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span className="text-xs truncate max-w-[60px] flex items-center gap-0.5" title={p.display_name}>
                                {p.id === currentParticipant.id ? 'You' : p.display_name.split(' ')[0]}
                                {p.is_spectator && <span className="text-muted-foreground">👁</span>}
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {roundResults.map((result, index) => (
                        <tr key={index} className="border-b border-border/50 last:border-0">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              {result.submission.album_art_url && (
                                <img
                                  src={result.submission.album_art_url}
                                  alt=""
                                  className="w-8 h-8 rounded flex-shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                <p className="font-medium truncate max-w-[100px]" title={result.submission.track_name}>
                                  {result.submission.track_name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate max-w-[100px]" title={result.submission.artist_name}>
                                  {result.submission.artist_name}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-medium text-secondary whitespace-nowrap">
                              {result.correctParticipant.display_name}
                            </span>
                          </td>
                          {sortedParticipants.map(p => {
                            const guess = result.allGuesses.get(p.id)
                            const guessedName = guess?.guessedParticipant?.display_name
                            return (
                              <td key={p.id} className="py-2 px-2 text-center">
                                {guess?.guessedParticipant ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className={`text-xs font-medium truncate max-w-[60px] ${guess.isCorrect ? 'text-accent' : 'text-destructive'}`} title={guessedName}>
                                      {guessedName?.split(' ')[0]}
                                    </span>
                                    <span className={`text-sm ${guess.isCorrect ? 'text-accent' : 'text-destructive'}`}>
                                      {guess.isCorrect ? '✓' : '✗'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
