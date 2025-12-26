'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import { createClient } from '@/lib/supabase/client'
import { Check } from 'lucide-react'
import type { Room, Participant, Submission, FavouriteVoteInsert } from '@/types/database'

interface FavouritesViewProps {
  room: Room
  participants: Participant[]
  currentParticipant: Participant
  onFavouritesEnd: () => void
  onNavigateToLobby: () => void
}

interface SubmissionWithParticipant extends Submission {
  participant: Participant
}

export function FavouritesView({
  room,
  participants,
  currentParticipant,
  onFavouritesEnd,
  onNavigateToLobby,
}: FavouritesViewProps) {
  const [submissions, setSubmissions] = useState<SubmissionWithParticipant[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hasVoted, setHasVoted] = useState(false)
  const [voterIds, setVoterIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()
  const isHost = currentParticipant.is_host

  const MAX_SELECTIONS = 3
  const POINTS_PER_VOTE = 50

  // Fetch all submissions for the room
  const fetchSubmissions = useCallback(async () => {
    const participantIds = participants.map(p => p.id)

    const { data: submissionsData } = await supabase
      .from('submissions')
      .select('*')
      .in('participant_id', participantIds)
      .order('created_at', { ascending: true })

    if (submissionsData) {
      const withParticipants: SubmissionWithParticipant[] = submissionsData.map(sub => ({
        ...sub,
        participant: participants.find(p => p.id === sub.participant_id)!,
      }))
      setSubmissions(withParticipants)
    }

    // Check if current user has already voted
    const { data: existingVotes } = await supabase
      .from('favourite_votes')
      .select('id')
      .eq('room_id', room.id)
      .eq('voter_id', currentParticipant.id)

    if (existingVotes && existingVotes.length > 0) {
      setHasVoted(true)
    }

    // Fetch who has already voted
    const { data: allVotes } = await supabase
      .from('favourite_votes')
      .select('voter_id')
      .eq('room_id', room.id)

    if (allVotes) {
      const voterSet = new Set(allVotes.map(v => v.voter_id))
      setVoterIds(voterSet)
    }

    setIsLoading(false)
  }, [participants, room.id, currentParticipant.id, supabase])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  // Listen for new votes in real-time
  useEffect(() => {
    if (!room.id) return

    const channel = supabase
      .channel(`favourites-sync:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'favourite_votes',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const newVote = payload.new as { voter_id: string }
          setVoterIds(prev => new Set([...prev, newVote.voter_id]))
        }
      )
      .on('broadcast', { event: 'favourites_end' }, () => {
        onFavouritesEnd()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [room.id, supabase, onFavouritesEnd])

  // Filter out current user's submissions
  const eligibleSubmissions = submissions.filter(
    s => s.participant_id !== currentParticipant.id
  )

  const toggleSelection = (submissionId: string) => {
    if (hasVoted) return

    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(submissionId)) {
        next.delete(submissionId)
      } else if (next.size < MAX_SELECTIONS) {
        next.add(submissionId)
      }
      return next
    })
  }

  const handleSubmitVotes = async () => {
    if (selectedIds.size !== MAX_SELECTIONS || isSubmitting) return

    setIsSubmitting(true)

    const votes: FavouriteVoteInsert[] = Array.from(selectedIds).map(submissionId => ({
      room_id: room.id,
      voter_id: currentParticipant.id,
      submission_id: submissionId,
    }))

    const { error } = await supabase.from('favourite_votes').insert(votes)

    if (error) {
      console.error('Failed to submit votes:', error)
      setIsSubmitting(false)
      return
    }

    setHasVoted(true)
    setVoterIds(prev => new Set([...prev, currentParticipant.id]))
    setIsSubmitting(false)
  }

  const handleContinue = async () => {
    // Broadcast to all players that favourites round is ending
    await supabase.channel(`favourites-sync:${room.id}`).send({
      type: 'broadcast',
      event: 'favourites_end',
      payload: {},
    })
    onFavouritesEnd()
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-4xl animate-bounce">⭐</div>
          <div className="text-xl">Loading songs...</div>
        </div>
      </main>
    )
  }

  const votedCount = voterIds.size
  const totalParticipants = participants.length

  return (
    <main className="flex min-h-screen flex-col items-center p-4 py-8">
      <div className="w-full max-w-2xl space-y-6">
        <GameBreadcrumbs
          currentStage="quiz"
          canNavigate={isHost}
          onNavigate={(stage) => stage === 'lobby' && onNavigateToLobby()}
        />

        {/* Header */}
        <div className="text-center space-y-2">
          <Badge variant="secondary" className="text-lg px-4 py-1">
            ⭐ Pick Your Favourites
          </Badge>
          <h1 className="text-2xl font-bold">Vote for Your Top 3 Songs</h1>
          <p className="text-muted-foreground">
            Which songs did you love the most? ({POINTS_PER_VOTE} points per vote received)
          </p>
        </div>

        {/* Selection Counter */}
        <div className="flex justify-center">
          <Badge
            variant={selectedIds.size === MAX_SELECTIONS ? 'default' : 'outline'}
            className="text-lg px-4 py-2"
          >
            {selectedIds.size} / {MAX_SELECTIONS} selected
          </Badge>
        </div>

        {/* Song Grid */}
        {hasVoted ? (
          <Card className="border-2 border-green-500/30 bg-green-500/5">
            <CardContent className="py-8 text-center">
              <div className="text-4xl mb-4">✓</div>
              <p className="text-lg font-semibold text-green-600">Votes submitted!</p>
              <p className="text-muted-foreground mt-2">
                Waiting for other players...
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {eligibleSubmissions.map((submission) => {
              const isSelected = selectedIds.has(submission.id)
              const isDisabled = !isSelected && selectedIds.size >= MAX_SELECTIONS

              return (
                <button
                  key={submission.id}
                  onClick={() => toggleSelection(submission.id)}
                  disabled={isDisabled}
                  className={`
                    relative p-3 rounded-lg border-2 transition-all text-left
                    ${isSelected
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                      : 'border-border hover:border-muted-foreground/50'
                    }
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1">
                      <Check className="h-4 w-4" />
                    </div>
                  )}

                  {/* Album art */}
                  {submission.album_art_url ? (
                    <img
                      src={submission.album_art_url}
                      alt=""
                      className="w-full aspect-square rounded-md object-cover mb-2"
                      onError={(e) => {
                        // Replace broken image with fallback
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        target.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                  ) : null}
                  <div className={`w-full aspect-square rounded-md bg-muted flex items-center justify-center mb-2 ${submission.album_art_url ? 'hidden' : ''}`}>
                    <span className="text-3xl">🎵</span>
                  </div>

                  {/* Song info - anonymous, no submitter shown */}
                  <p className="font-medium text-sm truncate">{submission.track_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{submission.artist_name}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* Voting Status */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{votedCount}/{totalParticipants} voted</Badge>
              </div>
              <div className="flex -space-x-2">
                {participants.map((p) => {
                  const hasThisPersonVoted = voterIds.has(p.id)
                  return (
                    <Avatar
                      key={p.id}
                      className={`h-8 w-8 border-2 ${
                        hasThisPersonVoted
                          ? 'border-green-500'
                          : 'border-muted opacity-50'
                      }`}
                    >
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {p.display_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        {!hasVoted && (
          <Button
            onClick={handleSubmitVotes}
            disabled={selectedIds.size !== MAX_SELECTIONS || isSubmitting}
            className="w-full h-12 text-lg"
          >
            {isSubmitting
              ? 'Submitting...'
              : selectedIds.size === MAX_SELECTIONS
                ? 'Submit My Favourites ⭐'
                : `Select ${MAX_SELECTIONS - selectedIds.size} more`
            }
          </Button>
        )}

        {/* Host Controls */}
        {isHost && (
          <Button
            onClick={handleContinue}
            variant={votedCount === totalParticipants ? 'default' : 'outline'}
            className="w-full h-12"
          >
            {votedCount === totalParticipants
              ? 'Continue to Results →'
              : `Continue to Results (${votedCount}/${totalParticipants} voted)`
            }
          </Button>
        )}

        {/* Non-host waiting message */}
        {!isHost && hasVoted && (
          <p className="text-center text-muted-foreground">
            Waiting for host to continue...
          </p>
        )}
      </div>
    </main>
  )
}
