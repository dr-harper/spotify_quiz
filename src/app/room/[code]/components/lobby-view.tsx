'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { createClient } from '@/lib/supabase/client'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import type { Room, Participant } from '@/types/database'
import { DEFAULT_GAME_SETTINGS } from '@/types/database'
import { LOBBY_NAME_MAX_LENGTH } from '@/constants/rooms'

interface LobbyViewProps {
  room: Room
  participants: Participant[]
  currentParticipant: Participant
  onStartGame: () => void
  onPickSongs: () => void
  onUpdateRoomName: (name: string | null) => Promise<void> | void
  onRemoveParticipant?: (participantId: string) => Promise<void>
}

export function LobbyView({
  room,
  participants,
  currentParticipant,
  onStartGame,
  onPickSongs,
  onUpdateRoomName,
  onRemoveParticipant,
}: LobbyViewProps) {
  const router = useRouter()
  const supabase = createClient()
  const isHost = currentParticipant.is_host
  const [copied, setCopied] = useState(false)
  const [roomNameInput, setRoomNameInput] = useState(room.name ?? '')
  const [isSavingName, setIsSavingName] = useState(false)
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null)
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)
  const [hasSpotify, setHasSpotify] = useState(false)
  const [mySubmissions, setMySubmissions] = useState<Array<{
    track_id: string
    track_name: string
    artist_name: string
    album_art_url: string | null
  }>>([])

  // Check if user has Spotify connected
  useEffect(() => {
    const checkSpotify = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setHasSpotify(!!session?.provider_token)
    }
    checkSpotify()
  }, [supabase.auth])

  // Fetch user's submitted songs
  useEffect(() => {
    if (!currentParticipant.has_submitted) {
      setMySubmissions([])
      return
    }

    const fetchSubmissions = async () => {
      const { data } = await supabase
        .from('submissions')
        .select('track_id, track_name, artist_name, album_art_url')
        .eq('participant_id', currentParticipant.id)
        .order('submission_order', { ascending: true })

      if (data) {
        setMySubmissions(data)
      }
    }

    fetchSubmissions()
  }, [currentParticipant.has_submitted, currentParticipant.id, supabase])

  const handleRemoveParticipant = async (participantId: string) => {
    if (!onRemoveParticipant) return
    setRemovingParticipantId(participantId)
    try {
      await onRemoveParticipant(participantId)
    } finally {
      setRemovingParticipantId(null)
    }
  }

  const submittedCount = participants.filter(p => p.has_submitted).length
  const hasSubmitted = currentParticipant.has_submitted
  // Need at least 2 players who have submitted to start the quiz
  const canStartQuiz = submittedCount >= 2

  const settings = room.settings || DEFAULT_GAME_SETTINGS
  const displayName = room.name?.trim() || room.room_code

  useEffect(() => {
    setRoomNameInput(room.name ?? '')
  }, [room.name])

  const copyRoomLink = () => {
    const url = `${window.location.origin}/room/${room.room_code}`
    const inviteText = `🎵 ${displayName}

Pick your favourite songs, we'll shuffle them into a playlist, then guess who chose what!

Join: ${url}`
    navigator.clipboard.writeText(inviteText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNameBlur = async () => {
    if (!isHost) {
      setRoomNameInput(room.name ?? '')
      return
    }

    const normalized = roomNameInput.trim().replace(/\s+/g, ' ')
    const limitedName = normalized ? normalized.slice(0, LOBBY_NAME_MAX_LENGTH) : ''

    if (limitedName === (room.name ?? '')) {
      setRoomNameInput(room.name ?? '')
      return
    }

    try {
      setIsSavingName(true)
      await onUpdateRoomName(limitedName || null)
      setRoomNameInput(limitedName)
    } finally {
      setIsSavingName(false)
    }
  }

  const handleCreatePlaylist = async () => {
    setIsCreatingPlaylist(true)
    try {
      const response = await fetch('/api/spotify/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          playlistName: `Festive Frequencies - ${displayName}`,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setPlaylistUrl(data.playlistUrl)
      } else {
        console.error('Playlist error:', data.error)
      }
    } catch (error) {
      console.error('Playlist error:', error)
    } finally {
      setIsCreatingPlaylist(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 pt-8">
      <div className="w-full max-w-4xl">
        <div className="max-w-md mx-auto lg:max-w-none">
          <GameBreadcrumbs currentStage="lobby" />
        </div>

        <div className="text-center space-y-1 my-6">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Lobby</p>
          <h1 className="text-3xl font-bold text-foreground">{displayName}</h1>
          <p className="font-mono text-sm text-muted-foreground">Code: {room.room_code}</p>
        </div>

        {/* Two-column layout on larger screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-md mx-auto lg:max-w-none">
          {/* Left Column - Lobby Details & Players */}
          <div className="space-y-4">
            {/* Lobby Details */}
            <Card className="border-2 border-primary/30 bg-card/50">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg text-muted-foreground">Lobby details & invites</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-left">
                  <Label htmlFor="room-name" className="text-sm">Lobby name</Label>
                  <Input
                    id="room-name"
                    value={roomNameInput}
                    onChange={(e) => setRoomNameInput(e.target.value.slice(0, LOBBY_NAME_MAX_LENGTH))}
                    onBlur={handleNameBlur}
                    placeholder="Name your lobby"
                    disabled={!isHost || isSavingName}
                    maxLength={LOBBY_NAME_MAX_LENGTH}
                    autoComplete="off"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {isSavingName
                        ? 'Saving lobby name...'
                        : isHost
                          ? 'Only the host can edit this name'
                          : 'Only the host can edit this name'}
                    </span>
                    <span>{roomNameInput.trim().length}/{LOBBY_NAME_MAX_LENGTH}</span>
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <button
                    onClick={copyRoomLink}
                    className="text-4xl font-mono font-bold tracking-[0.3em] text-secondary hover:text-secondary/80 transition-colors w-full"
                    title="Click to copy invite"
                  >
                    {room.room_code}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {copied ? `✓ Copied invite for "${displayName}"` : `Click to copy invite for "${displayName}"`}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Players List */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span>Players</span>
                  <Badge variant="secondary">
                    {submittedCount}/{participants.length} ready
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        participant.id === currentParticipant.id
                          ? 'bg-primary/10 border border-primary/20'
                          : ''
                      }`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={participant.avatar_url || undefined} />
                        <AvatarFallback>
                          {participant.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 font-medium text-sm">
                        {participant.display_name}
                        {participant.id === currentParticipant.id && (
                          <span className="text-muted-foreground text-xs ml-2">(You)</span>
                        )}
                      </span>
                      {participant.is_host && (
                        <Badge variant="outline" className="text-primary border-primary text-xs">
                          Host
                        </Badge>
                      )}
                      {/* Submission status */}
                      {participant.has_submitted ? (
                        <Badge variant="default" className="bg-green-600 text-xs">Ready</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Not ready</Badge>
                      )}
                      {/* Remove button for hosts (can't remove self or other hosts) */}
                      {isHost && !participant.is_host && participant.id !== currentParticipant.id && onRemoveParticipant && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveParticipant(participant.id)}
                          disabled={removingParticipantId === participant.id}
                          title="Remove player"
                        >
                          {removingParticipantId === participant.id ? (
                            <span className="animate-spin">⏳</span>
                          ) : (
                            <span>✕</span>
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {participants.length < 2 && (
                  <p className="text-sm text-muted-foreground text-center mt-3">
                    Waiting for more players to join...
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Pick Your Songs / My Songs Card */}
            <Card className={`border-2 ${hasSubmitted ? 'border-green-500/30' : 'border-secondary/30'}`}>
              {hasSubmitted ? (
                <>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="text-green-500">✓</span>
                        My Songs
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onPickSongs}
                      >
                        Edit
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {mySubmissions.map((track, index) => (
                        <div
                          key={track.track_id}
                          className="flex items-center gap-2 p-1.5 rounded bg-muted/30"
                        >
                          <span className="text-xs text-muted-foreground w-4">{index + 1}.</span>
                          {track.album_art_url && (
                            <img
                              src={track.album_art_url}
                              alt=""
                              className="w-8 h-8 rounded flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{track.track_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{track.artist_name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </>
              ) : (
                <CardContent className="pt-4">
                  <Button
                    onClick={onPickSongs}
                    className="w-full h-12 text-lg"
                    variant="secondary"
                  >
                    🎵 Pick Your Songs
                  </Button>
                </CardContent>
              )}
            </Card>

            {/* Start Quiz Button - visible on mobile, hidden on desktop (shown at bottom of right column) */}
            <div className="lg:hidden">
              {isHost ? (
                <div className="space-y-2">
                  {!canStartQuiz && (
                    <p className="text-center text-sm text-muted-foreground">
                      Need at least 2 players with songs to start
                    </p>
                  )}
                  <Button
                    onClick={onStartGame}
                    disabled={!canStartQuiz}
                    className="w-full h-14 text-lg"
                    size="lg"
                  >
                    Start Quiz →
                  </Button>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  {canStartQuiz
                    ? 'Waiting for host to start the quiz...'
                    : 'Pick your songs, then wait for host to start...'}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Game Settings */}
          <div className="flex flex-col gap-4 lg:h-full">
            {/* Game Settings - Read Only */}
            <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Game Settings</span>
              {isHost && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/room/${room.room_code}/settings`)}
                >
                  Edit
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Songs per player</span>
                <span className="font-medium">{settings.songsRequired}</span>
              </div>
              {(settings.christmasSongsRequired ?? 0) > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Christmas songs required</span>
                  <span className="font-medium">
                    {settings.christmasSongsRequired === settings.songsRequired
                      ? 'All'
                      : settings.christmasSongsRequired}
                  </span>
                </div>
              )}
              {(settings.recentSongsRequired ?? 0) > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Songs from this year</span>
                  <span className="font-medium">{settings.recentSongsRequired}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Preview length</span>
                <span className="font-medium">{settings.previewLengthSeconds}s</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Guess timer</span>
                <span className="font-medium">
                  {settings.guessTimerSeconds ? `${settings.guessTimerSeconds}s` : 'Off'}
                </span>
              </div>
              {settings.chameleonMode && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Chameleon Mode</span>
                  <span className="font-medium text-secondary">On</span>
                </div>
              )}
              {settings.revealAfterEachRound && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Reveal answers</span>
                  <span className="font-medium text-secondary">On</span>
                </div>
              )}
              {settings.allowDuplicateSongs && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Duplicates allowed</span>
                  <span className="font-medium text-secondary">On</span>
                </div>
              )}
              {settings.triviaEnabled && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Trivia round</span>
                  <span className="font-medium">{settings.triviaQuestionCount} questions</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

            {/* Spotify Playlist Card */}
            <Card className="border-[#1DB954]/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-[#1DB954]">♫</span>
                  <span>Spotify Playlist</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Progress indicator */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Songs collected</span>
                    <span className="font-medium">
                      {submittedCount * settings.songsRequired} / {participants.length * settings.songsRequired}
                    </span>
                  </div>
                  <Progress
                    value={(submittedCount / participants.length) * 100}
                    className="h-2"
                  />
                </div>

                {playlistUrl ? (
                  <Button
                    asChild
                    className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-white"
                  >
                    <a href={playlistUrl} target="_blank" rel="noopener noreferrer">
                      Open in Spotify
                    </a>
                  </Button>
                ) : submittedCount >= 2 ? (
                  hasSpotify ? (
                    <Button
                      onClick={handleCreatePlaylist}
                      disabled={isCreatingPlaylist}
                      className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-white"
                    >
                      {isCreatingPlaylist ? 'Creating...' : 'Create Playlist'}
                    </Button>
                  ) : (
                    <p className="text-center text-xs text-muted-foreground">
                      Connect Spotify to create playlists
                    </p>
                  )
                ) : (
                  <p className="text-center text-xs text-muted-foreground">
                    Need at least 2 players with songs to create playlist
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Spacer to push Start Quiz to bottom on desktop */}
            <div className="hidden lg:flex lg:flex-grow" />

            {/* Start Quiz Button - hidden on mobile, visible on desktop */}
            <div className="hidden lg:block">
              {isHost ? (
                <div className="space-y-2">
                  {!canStartQuiz && (
                    <p className="text-center text-sm text-muted-foreground">
                      Need at least 2 players with songs to start
                    </p>
                  )}
                  <Button
                    onClick={onStartGame}
                    disabled={!canStartQuiz}
                    className="w-full h-14 text-lg"
                    size="lg"
                  >
                    Start Quiz →
                  </Button>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  {canStartQuiz
                    ? 'Waiting for host to start the quiz...'
                    : 'Pick your songs, then wait for host to start...'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
