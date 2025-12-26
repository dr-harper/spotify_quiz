'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import { createClient } from '@/lib/supabase/client'
import type { Room, Participant, Submission, QuizRound } from '@/types/database'
import { DEFAULT_GAME_SETTINGS } from '@/types/database'

interface QuizViewProps {
  room: Room
  participants: Participant[]
  currentParticipant: Participant
  roundType: 'round1' | 'round2'
  onRoundEnd: () => void
  onNavigateToLobby: () => void
}

interface RoundData {
  round: QuizRound
  submission: Submission
  correctParticipant: Participant
}

interface VoteRecord {
  roundIndex: number
  guessedId: string
  correctId: string
  isCorrect: boolean
  submission: Submission
}

export function QuizView({
  room,
  participants,
  currentParticipant,
  roundType,
  onRoundEnd,
  onNavigateToLobby,
}: QuizViewProps) {
  const settings = room.settings || DEFAULT_GAME_SETTINGS
  // Only include participants who have submitted songs
  const submittedParticipants = participants.filter(p => p.has_submitted)
  const [rounds, setRounds] = useState<RoundData[]>([])
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0)
  const [hasVoted, setHasVoted] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [votes, setVotes] = useState<VoteRecord[]>([])
  const [waitingForOthers, setWaitingForOthers] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [roundVoters, setRoundVoters] = useState<Set<string>>(new Set())
  const audioRef = useRef<HTMLAudioElement>(null)
  const initRef = useRef(false)
  const creatingRoundsRef = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()
  const isHost = currentParticipant.is_host

  // Initialise rounds (host creates them, others fetch them)
  const initRounds = useCallback(async () => {
    // Prevent concurrent calls
    if (creatingRoundsRef.current) return

    // Always check for existing rounds first
    const { data: existingRounds } = await supabase
      .from('quiz_rounds')
      .select('*')
      .eq('room_id', room.id)

    if (existingRounds && existingRounds.length > 0) {
      await fetchRounds()
      return
    }

    // Only host creates rounds if none exist
    if (isHost) {
      // Lock to prevent double creation
      if (creatingRoundsRef.current) {
        await fetchRounds()
        return
      }
      creatingRoundsRef.current = true

      try {
        // Delete any existing rounds first (clean slate)
        await supabase
          .from('quiz_rounds')
          .delete()
          .eq('room_id', room.id)

        const { data: submissions } = await supabase
          .from('submissions')
          .select('*')
          .in('participant_id', submittedParticipants.map(p => p.id))

        if (!submissions || submissions.length === 0) {
          console.error('No submissions found')
          return
        }

        console.log('Creating rounds for', submissions.length, 'submissions')

        const shuffled = [...submissions].sort(() => Math.random() - 0.5)
        const roundsToCreate = shuffled.map((sub, index) => ({
          room_id: room.id,
          submission_id: sub.id,
          round_number: index + 1,
        }))

        await supabase.from('quiz_rounds').insert(roundsToCreate)
      } finally {
        creatingRoundsRef.current = false
      }
    }

    await fetchRounds()
  }, [isHost, room.id, submittedParticipants, supabase])

  const fetchRounds = useCallback(async () => {
    const { data: quizRounds } = await supabase
      .from('quiz_rounds')
      .select('*')
      .eq('room_id', room.id)
      .order('round_number', { ascending: true })

    if (!quizRounds || quizRounds.length === 0) {
      setTimeout(fetchRounds, 1000)
      return
    }

    // Split rounds into two halves based on roundType
    const totalRounds = quizRounds.length
    const midpoint = Math.ceil(totalRounds / 2)
    const filteredRounds = roundType === 'round1'
      ? quizRounds.slice(0, midpoint)
      : quizRounds.slice(midpoint)

    const submissionIds = filteredRounds.map(r => r.submission_id)
    const { data: submissions } = await supabase
      .from('submissions')
      .select('*')
      .in('id', submissionIds)

    if (!submissions) return

    const roundData: RoundData[] = filteredRounds.map(round => {
      const submission = submissions.find(s => s.id === round.submission_id)!
      const correctParticipant = submittedParticipants.find(p => p.id === submission.participant_id)!
      return { round, submission, correctParticipant }
    })

    setRounds(roundData)
    setIsLoading(false)
  }, [room.id, submittedParticipants, supabase, roundType])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    initRounds()
  }, [initRounds])

  useEffect(() => {
    if (rounds.length > 0 && audioRef.current) {
      const audio = audioRef.current
      audio.currentTime = 0
      audio.play().catch(console.error)

      // Stop playback after preview length if configured
      const previewLength = settings.previewLengthSeconds || 30
      const stopTimer = setTimeout(() => {
        if (audio && !audio.paused) {
          audio.pause()
        }
      }, previewLength * 1000)

      return () => clearTimeout(stopTimer)
    }
  }, [currentRoundIndex, rounds, settings.previewLengthSeconds])

  // Guess timer countdown
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Only start timer if setting is enabled and player hasn't voted
    if (!settings.guessTimerSeconds || hasVoted || isLoading || rounds.length === 0) {
      setTimeRemaining(null)
      return
    }

    // Start countdown
    setTimeRemaining(settings.guessTimerSeconds)

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          // Time's up - clear interval
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [currentRoundIndex, hasVoted, isLoading, rounds.length, settings.guessTimerSeconds])

  // Note: Chameleon song owners CAN vote - their vote declares who they were trying to imitate

  // Handle time expiry - auto-skip vote
  useEffect(() => {
    if (timeRemaining === 0 && !hasVoted && rounds[currentRoundIndex]) {
      // Time's up - mark as voted with no selection (missed guess)
      setHasVoted(true)
      setWaitingForOthers(true)

      // Record a "missed" vote in the database (no points)
      const currentRound = rounds[currentRoundIndex]
      supabase.from('votes').insert({
        round_id: currentRound.round.id,
        voter_id: currentParticipant.id,
        guessed_participant_id: null, // No guess made
        is_correct: false,
        points_awarded: 0,
      })

      // Record locally as missed
      setVotes(prev => [...prev, {
        roundIndex: currentRoundIndex,
        guessedId: '',
        correctId: currentRound.correctParticipant.id,
        isCorrect: false,
        submission: currentRound.submission,
      }])
    }
  }, [timeRemaining, hasVoted, currentRoundIndex, rounds, currentParticipant.id, supabase])

  // Listen for round changes from host (broadcast)
  useEffect(() => {
    if (!room.id) return

    const channel = supabase
      .channel(`quiz-sync:${room.id}:${roundType}`)
      .on('broadcast', { event: 'next_round' }, ({ payload }) => {
        if (payload.roundIndex !== undefined) {
          setCurrentRoundIndex(payload.roundIndex)
          setHasVoted(false)
          setSelectedParticipant(null)
          setWaitingForOthers(false)
          setRoundVoters(new Set()) // Reset voters for new round
        }
      })
      .on('broadcast', { event: 'round_end' }, () => {
        onRoundEnd()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [room.id, supabase, onRoundEnd, roundType])

  // Fetch and subscribe to votes for current round
  useEffect(() => {
    if (!rounds[currentRoundIndex]) return

    const currentRound = rounds[currentRoundIndex]

    // Fetch existing votes for this round
    const fetchVotes = async () => {
      const { data: existingVotes } = await supabase
        .from('votes')
        .select('voter_id')
        .eq('round_id', currentRound.round.id)

      if (existingVotes) {
        setRoundVoters(new Set(existingVotes.map(v => v.voter_id)))
      }
    }

    fetchVotes()

    // Subscribe to new votes
    const channel = supabase
      .channel(`votes:${currentRound.round.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'votes',
          filter: `round_id=eq.${currentRound.round.id}`,
        },
        (payload) => {
          const newVote = payload.new as { voter_id: string }
          setRoundVoters(prev => new Set([...prev, newVote.voter_id]))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentRoundIndex, rounds, supabase])

  const handleVote = async (participantId: string) => {
    if (hasVoted || !rounds[currentRoundIndex]) return

    setSelectedParticipant(participantId)
    setHasVoted(true)
    setWaitingForOthers(true)

    const currentRound = rounds[currentRoundIndex]

    // Check if this is the owner voting on their own chameleon song
    const isOwnChameleon = settings.chameleonMode &&
      currentRound.submission.is_chameleon &&
      currentRound.submission.participant_id === currentParticipant.id

    if (isOwnChameleon) {
      // Owner is declaring their target - no points awarded directly
      // Chameleon scoring happens during results reveal
      setVotes(prev => [...prev, {
        roundIndex: currentRoundIndex,
        guessedId: participantId,
        correctId: currentRound.correctParticipant.id,
        isCorrect: false, // Not a guess, just target declaration
        submission: currentRound.submission,
      }])

      // Save vote to database - marks the owner's declared target
      await supabase.from('votes').insert({
        round_id: currentRound.round.id,
        voter_id: currentParticipant.id,
        guessed_participant_id: participantId,
        is_correct: null, // null indicates this is a chameleon target declaration
        points_awarded: 0,
      })
    } else {
      // Normal vote - check if correct
      const isCorrect = participantId === currentRound.correctParticipant.id

      // Record vote locally
      setVotes(prev => [...prev, {
        roundIndex: currentRoundIndex,
        guessedId: participantId,
        correctId: currentRound.correctParticipant.id,
        isCorrect,
        submission: currentRound.submission,
      }])

      // Save vote to database
      await supabase.from('votes').insert({
        round_id: currentRound.round.id,
        voter_id: currentParticipant.id,
        guessed_participant_id: participantId,
        is_correct: isCorrect,
        points_awarded: isCorrect ? 100 : 0,
      })

      // Update score
      if (isCorrect) {
        await supabase
          .from('participants')
          .update({ score: currentParticipant.score + 100 })
          .eq('id', currentParticipant.id)
      }
    }
  }

  const handleNextRound = async () => {
    if (currentRoundIndex < rounds.length - 1) {
      const nextIndex = currentRoundIndex + 1
      // Broadcast to all players
      await supabase.channel(`quiz-sync:${room.id}:${roundType}`).send({
        type: 'broadcast',
        event: 'next_round',
        payload: { roundIndex: nextIndex },
      })
      setCurrentRoundIndex(nextIndex)
      setHasVoted(false)
      setSelectedParticipant(null)
      setWaitingForOthers(false)
    } else {
      // Round finished - broadcast end
      await supabase.channel(`quiz-sync:${room.id}:${roundType}`).send({
        type: 'broadcast',
        event: 'round_end',
        payload: {},
      })
      onRoundEnd()
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="animate-pulse text-2xl">Loading quiz...</div>
      </main>
    )
  }

  if (rounds.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-xl">Preparing rounds...</div>
      </main>
    )
  }

  const currentRound = rounds[currentRoundIndex]
  const progress = ((currentRoundIndex + 1) / rounds.length) * 100

  // Check if this is the current player's chameleon song
  const isOwnChameleonSong = settings.chameleonMode &&
    currentRound.submission.is_chameleon &&
    currentRound.submission.participant_id === currentParticipant.id

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <GameBreadcrumbs
          currentStage="quiz"
          canNavigate={isHost}
          onNavigate={(stage) => stage === 'lobby' && onNavigateToLobby()}
        />

        {/* Progress */}
        <div className="space-y-2">
          <div className="text-sm text-center">
            <Badge variant="secondary" className="mb-2">
              {roundType === 'round1' ? '🎵 Part 1' : '🎶 Part 2'}
            </Badge>
            <p className="text-muted-foreground">
              Song {currentRoundIndex + 1} of {rounds.length}
            </p>
          </div>
          <Progress value={progress} />
        </div>

        {/* Audio Player & Song Info */}
        <Card className="border-2 border-primary/30">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              {currentRound.submission.album_art_url && (
                <img
                  src={currentRound.submission.album_art_url}
                  alt="Album art"
                  className="w-48 h-48 rounded-lg shadow-lg"
                />
              )}

              <div className="text-center">
                <p className="font-bold text-lg">{currentRound.submission.track_name}</p>
                <p className="text-muted-foreground">{currentRound.submission.artist_name}</p>
              </div>

              <audio
                ref={audioRef}
                src={currentRound.submission.preview_url}
                autoPlay
                className="w-full"
                controls
              />
            </div>
          </CardContent>
        </Card>

        {/* Voting */}
        <Card>
          <CardHeader>
            {isOwnChameleonSong ? (
              <>
                <div className="flex justify-center mb-2">
                  <Badge variant="secondary" className="text-lg px-4 py-1 bg-gradient-to-r from-green-500/20 to-yellow-500/20">
                    🦎 Your Chameleon Song
                  </Badge>
                </div>
                <CardTitle className="text-center">
                  Who were you trying to imitate?
                </CardTitle>
                <p className="text-center text-sm text-muted-foreground mt-1">
                  +100 pts for each player who also picks them, −125 pts if someone guesses you
                </p>
              </>
            ) : (
              <>
                <CardTitle className="text-center">Who picked this song?</CardTitle>
                {/* Timer display */}
                {timeRemaining !== null && !hasVoted && (
                  <div className="flex justify-center mt-2">
                    <Badge
                      variant={timeRemaining <= 5 ? "destructive" : "secondary"}
                      className={`text-lg px-4 py-1 ${timeRemaining <= 5 ? 'animate-pulse' : ''}`}
                    >
                      {timeRemaining}s
                    </Badge>
                  </div>
                )}
                {timeRemaining === 0 && hasVoted && !selectedParticipant && (
                  <p className="text-center text-destructive text-sm mt-2">
                    Time&apos;s up! No guess made.
                  </p>
                )}
              </>
            )}
          </CardHeader>
          <CardContent>
            {isOwnChameleonSong && !hasVoted ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {participants
                    .filter(p => p.id !== currentParticipant.id) // Can't pick yourself
                    .map(participant => (
                      <Button
                        key={participant.id}
                        variant={selectedParticipant === participant.id ? "default" : "outline"}
                        className="h-auto py-3 flex items-center gap-2"
                        onClick={() => setSelectedParticipant(participant.id)}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={participant.avatar_url || undefined} />
                          <AvatarFallback>{participant.display_name[0]}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{participant.display_name}</span>
                      </Button>
                    ))}
                </div>
                <Button
                  onClick={() => selectedParticipant && handleVote(selectedParticipant)}
                  disabled={!selectedParticipant}
                  className="w-full"
                >
                  Confirm Target
                </Button>
              </div>
            ) : isOwnChameleonSong && hasVoted ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  You declared <strong>{participants.find(p => p.id === selectedParticipant)?.display_name || 'your target'}</strong> as your imitation target.
                </p>
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {roundVoters.size}/{submittedParticipants.length} voted
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Waiting for others to guess...
                </p>
                {isHost && (
                  <Button
                    onClick={handleNextRound}
                    className="w-full mt-4"
                  >
                    {currentRoundIndex < rounds.length - 1
                      ? 'Next Song →'
                      : roundType === 'round1'
                        ? settings.triviaEnabled
                          ? 'Continue to Trivia →'
                          : 'Continue to Part 2 →'
                        : 'See Results →'}
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Vote confirmation */}
                {hasVoted && selectedParticipant && (
                  <div className="text-center mb-3 space-y-2">
                    <p className="text-sm">
                      You guessed <strong className="text-primary">{submittedParticipants.find(p => p.id === selectedParticipant)?.display_name}</strong>
                    </p>
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      {roundVoters.size}/{submittedParticipants.length} voted
                    </Badge>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {submittedParticipants.map((participant) => (
                    <Button
                      key={participant.id}
                      onClick={() => handleVote(participant.id)}
                      disabled={hasVoted}
                      variant={selectedParticipant === participant.id ? 'default' : 'outline'}
                      className="h-auto py-3 flex flex-col items-center gap-2"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={participant.avatar_url || undefined} />
                        <AvatarFallback>{participant.display_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{participant.display_name}</span>
                    </Button>
                  ))}
                </div>

                {waitingForOthers && !isHost && !hasVoted && (
                  <p className="text-center text-muted-foreground text-sm mt-4">
                    Waiting for host to continue...
                  </p>
                )}

                {hasVoted && isHost && (
                  <Button
                    onClick={handleNextRound}
                    className="w-full mt-4"
                  >
                    {currentRoundIndex < rounds.length - 1
                      ? 'Next Song →'
                      : roundType === 'round1'
                        ? settings.triviaEnabled
                          ? 'Continue to Trivia →'
                          : 'Continue to Part 2 →'
                        : 'See Results →'}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Players Status */}
        <Card className="border border-muted">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              <span>Players</span>
              <Badge variant="outline" className="text-xs">
                {roundVoters.size}/{submittedParticipants.length} voted
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {submittedParticipants.map((participant) => {
                const hasVotedThisRound = roundVoters.has(participant.id)
                return (
                  <div
                    key={participant.id}
                    className={`flex items-center gap-2 px-2 py-1 rounded-full text-sm ${
                      hasVotedThisRound
                        ? 'bg-accent/20 text-accent-foreground'
                        : 'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={participant.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {participant.display_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-20">{participant.display_name}</span>
                    {hasVotedThisRound ? (
                      <span className="text-accent">✓</span>
                    ) : (
                      <span className="animate-pulse">...</span>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Progress indicator */}
        <div className="flex justify-center gap-1">
          {rounds.map((_, idx) => (
            <div
              key={idx}
              className={`w-2 h-2 rounded-full ${
                idx < currentRoundIndex
                  ? 'bg-primary'
                  : idx === currentRoundIndex
                  ? 'bg-primary animate-pulse'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
