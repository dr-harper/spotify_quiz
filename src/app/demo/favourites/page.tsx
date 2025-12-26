'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import { FestiveBackground } from '@/components/festive-background'
import { Check } from 'lucide-react'

/**
 * Demo page for the favourites voting screen - used for UI testing
 * Access at /demo/favourites
 */

// Mock submissions data
const MOCK_SUBMISSIONS = [
  {
    id: '1',
    track_name: 'All I Want for Christmas Is You',
    artist_name: 'Mariah Carey',
    album_art_url: 'https://i.scdn.co/image/ab67616d0000b273f6e57d1a60b5dc1e28e49522',
    participant_id: 'other1',
  },
  {
    id: '2',
    track_name: 'Last Christmas',
    artist_name: 'Wham!',
    album_art_url: 'https://i.scdn.co/image/ab67616d0000b2732e3c95b3111eb79224c4e6ea',
    participant_id: 'other2',
  },
  {
    id: '3',
    track_name: 'Rockin\' Around the Christmas Tree',
    artist_name: 'Brenda Lee',
    album_art_url: 'https://i.scdn.co/image/ab67616d0000b273b8e8c9cce52f7ae3c2f9d051',
    participant_id: 'other3',
  },
  {
    id: '4',
    track_name: 'Jingle Bell Rock',
    artist_name: 'Bobby Helms',
    album_art_url: 'https://i.scdn.co/image/ab67616d0000b273f8ca9e64b4200a6e8e7eb22f',
    participant_id: 'other1',
  },
  {
    id: '5',
    track_name: 'It\'s Beginning to Look a Lot Like Christmas',
    artist_name: 'Michael Bublé',
    album_art_url: 'https://i.scdn.co/image/ab67616d0000b273119e4094f07a8123b471ac1d',
    participant_id: 'other2',
  },
  {
    id: '6',
    track_name: 'Santa Tell Me',
    artist_name: 'Ariana Grande',
    album_art_url: 'https://i.scdn.co/image/ab67616d0000b273c35f98a910fd5c5e5a841a7f',
    participant_id: 'other3',
  },
  {
    id: '7',
    track_name: 'Underneath the Tree',
    artist_name: 'Kelly Clarkson',
    album_art_url: 'https://i.scdn.co/image/ab67616d0000b273d98e4e9a7f9e2c6ef5f31fcb',
    participant_id: 'me', // This is the current user's song - should be filtered out
  },
  {
    id: '8',
    track_name: 'White Christmas',
    artist_name: 'Bing Crosby',
    album_art_url: 'https://i.scdn.co/image/ab67616d0000b2736ae75d9917d9c7e5f9e3d4b1',
    participant_id: 'other1',
  },
  {
    id: '9',
    track_name: 'Snowman',
    artist_name: 'Sia',
    album_art_url: 'https://i.scdn.co/image/ab67616d0000b273dc1a79de9b78a3c4f79b5c87',
    participant_id: 'other2',
  },
  {
    id: '10',
    track_name: 'Let It Snow! Let It Snow! Let It Snow!',
    artist_name: 'Dean Martin',
    album_art_url: 'https://i.scdn.co/image/ab67616d0000b273e3e3b64cea45a02436d2e1c8',
    participant_id: 'other3',
  },
  {
    id: '11',
    track_name: 'Feliz Navidad',
    artist_name: 'José Feliciano',
    album_art_url: 'https://i.scdn.co/image/ab67616d0000b273fb7c8a9e8e4dc4b9a3a69c7a',
    participant_id: 'me', // Current user's song
  },
  {
    id: '12',
    track_name: 'Have Yourself a Merry Little Christmas',
    artist_name: 'Frank Sinatra',
    album_art_url: 'https://i.scdn.co/image/ab67616d0000b273d9ae4c5ab5a44f0b9c9e5d3e',
    participant_id: 'other1',
  },
]

const MOCK_PARTICIPANTS = [
  { id: 'me', display_name: 'You', avatar_url: null },
  { id: 'other1', display_name: 'Alice', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice' },
  { id: 'other2', display_name: 'Bob', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob' },
  { id: 'other3', display_name: 'Carol', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carol' },
]

export default function DemoFavouritesPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hasVoted, setHasVoted] = useState(false)
  const [voterIds, setVoterIds] = useState<Set<string>>(new Set(['other1'])) // One person has already voted

  const MAX_SELECTIONS = 3
  const POINTS_PER_VOTE = 50
  const currentParticipantId = 'me'

  // Filter out current user's songs
  const eligibleSubmissions = MOCK_SUBMISSIONS.filter(
    s => s.participant_id !== currentParticipantId
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

  const handleSubmitVotes = () => {
    if (selectedIds.size !== MAX_SELECTIONS) return
    setHasVoted(true)
    setVoterIds(prev => new Set([...prev, currentParticipantId]))
  }

  const votedCount = voterIds.size
  const totalParticipants = MOCK_PARTICIPANTS.length

  return (
    <>
      <FestiveBackground showSnow={true} />
      <main className="flex min-h-screen flex-col items-center p-4 py-8">
        <div className="w-full max-w-2xl space-y-6">
          <GameBreadcrumbs currentStage="quiz" />

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

                    {/* Song info - anonymous */}
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
                  {MOCK_PARTICIPANTS.map((p) => {
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
              disabled={selectedIds.size !== MAX_SELECTIONS}
              className="w-full h-12 text-lg"
            >
              {selectedIds.size === MAX_SELECTIONS
                ? 'Submit My Favourites ⭐'
                : `Select ${MAX_SELECTIONS - selectedIds.size} more`
              }
            </Button>
          )}

          {/* Host Controls (demo - always shown) */}
          <Button
            variant={votedCount === totalParticipants ? 'default' : 'outline'}
            className="w-full h-12"
          >
            {votedCount === totalParticipants
              ? 'Continue to Results →'
              : `Continue to Results (${votedCount}/${totalParticipants} voted)`
            }
          </Button>
        </div>
      </main>
    </>
  )
}
