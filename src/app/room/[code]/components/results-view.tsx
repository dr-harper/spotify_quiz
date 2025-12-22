'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ResultsReveal } from './results-reveal'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import type { Room, Participant, Submission } from '@/types/database'

interface ResultsViewProps {
  room: Room
  participants: Participant[]
  currentParticipant: Participant
  onPlayAgain: () => void
}

interface RoundResult {
  submission: Submission
  correctParticipant: Participant
  myGuess: Participant | null
  wasCorrect: boolean
}

interface RoundScore {
  round: number
  [participantName: string]: number
}

interface RoundDetail {
  roundNumber: number
  submission: Submission
  correctParticipant: Participant
  correctVoters: Participant[]
}

export function ResultsView({
  room,
  participants,
  currentParticipant,
  onPlayAgain,
}: ResultsViewProps) {
  const [phase, setPhase] = useState<'reveal' | 'results'>('reveal')
  const [part1Rounds, setPart1Rounds] = useState<RoundDetail[]>([])
  const [part2Rounds, setPart2Rounds] = useState<RoundDetail[]>([])
  const [triviaScores, setTriviaScores] = useState<Record<string, number>>({})
  const [finalScores, setFinalScores] = useState<Participant[]>([])
  const [roundResults, setRoundResults] = useState<RoundResult[]>([])
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)
  const [showAnswers, setShowAnswers] = useState(false)
  const [hasSpotify, setHasSpotify] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const isHost = currentParticipant.is_host

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

          // Find correct voter IDs
          const correctVoterIds: string[] = []
          roundVotes.forEach(vote => {
            if (vote.is_correct) {
              correctVoterIds.push(vote.voter_id)
            }
          })

          // Build round detail
          const submission = round.submission as Submission
          const correctParticipant = participants.find(p => p.id === submission.participant_id)!
          const correctVoters = participants.filter(p => correctVoterIds.includes(p.id))

          details.push({
            roundNumber: round.round_number,
            submission,
            correctParticipant,
            correctVoters,
          })
        })

        // Split into part1 and part2
        const midpoint = Math.ceil(details.length / 2)
        setPart1Rounds(details.slice(0, midpoint))
        setPart2Rounds(details.slice(midpoint))

        // Fetch my votes for round results
        const myVotes = allVotes?.filter(v => v.voter_id === currentParticipant.id) || []

        const results: RoundResult[] = quizRounds.map((round: { submission: Submission; id: string }) => {
          const submission = round.submission as Submission
          const correctParticipant = participants.find(p => p.id === submission.participant_id)!
          const myVote = myVotes.find(v => v.round_id === round.id)
          const myGuess = myVote ? participants.find(p => p.id === myVote.guessed_participant_id) || null : null

          return {
            submission,
            correctParticipant,
            myGuess,
            wasCorrect: myVote?.is_correct || false,
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
    try {
      const response = await fetch('/api/spotify/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          playlistName: `Festive Frequencies - ${room.room_code}`,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setPlaylistUrl(data.playlistUrl)
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
    await supabase
      .from('participants')
      .update({ score: 0, has_submitted: false })
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
    router.push('/lobby')
  }

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

  const correctCount = roundResults.filter(r => r.wasCorrect).length

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
        onComplete={() => setPhase('results')}
      />
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <GameBreadcrumbs currentStage="results" />

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            Quiz Complete!
          </h1>
          <p className="text-muted-foreground">
            You got {correctCount} out of {roundResults.length} correct
          </p>
        </div>

        {/* Leaderboard */}
        <Card className="border-2 border-secondary/30">
          <CardHeader>
            <CardTitle className="text-center">Final Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {finalScores.map((participant, index) => (
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
                    <p className="font-semibold">
                      {participant.display_name}
                      {participant.id === currentParticipant.id && (
                        <span className="text-muted-foreground text-sm ml-2">(You)</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-secondary">{participant.score}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Show/Hide Answers */}
        <Button
          onClick={() => setShowAnswers(!showAnswers)}
          variant="outline"
          className="w-full"
        >
          {showAnswers ? 'Hide Answers' : 'Show All Answers'}
        </Button>

        {/* Answers */}
        {showAnswers && (
          <Card>
            <CardHeader>
              <CardTitle className="text-center text-lg">Round by Round</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {roundResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    result.wasCorrect ? 'border-accent/50 bg-accent/10' : 'border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {result.submission.album_art_url && (
                      <img
                        src={result.submission.album_art_url}
                        alt=""
                        className="w-12 h-12 rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {result.submission.track_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {result.submission.artist_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">Picked by:</span>
                        <span className="text-xs font-semibold text-secondary">
                          {result.correctParticipant.display_name}
                        </span>
                      </div>
                      {result.myGuess && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">You guessed:</span>
                          <span className={`text-xs font-semibold ${result.wasCorrect ? 'text-accent' : 'text-destructive'}`}>
                            {result.myGuess.display_name}
                            {result.wasCorrect ? ' ✓' : ' ✗'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Create Playlist */}
        <Card className="border-2 border-accent/30">
          <CardContent className="pt-6">
            {playlistUrl ? (
              <div className="text-center space-y-3">
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
                {isCreatingPlaylist ? 'Creating Playlist...' : 'Save All Songs to Spotify Playlist'}
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
    </main>
  )
}
