'use client'

import { useEffect, useRef, useState } from 'react'
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
import type { Room, Participant, PlaylistSummary, TriviaFact } from '@/types/database'
import { DEFAULT_GAME_SETTINGS } from '@/types/database'
import { LOBBY_NAME_MAX_LENGTH } from '@/constants/rooms'
import { useBackgroundMusic } from '@/components/background-music'
import { Play, Pause, Eye, EyeOff, RefreshCw, X } from 'lucide-react'

interface TriviaQuestion {
  trackName: string
  question: string
  options: string[]
}

interface TriviaStatus {
  totalSongs: number
  songsWithTrivia: number
  questions: TriviaQuestion[]
}

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
  const [togglingSpectatorId, setTogglingSpectatorId] = useState<string | null>(null)
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)
  const [hasSpotify, setHasSpotify] = useState(false)
  const [mySubmissions, setMySubmissions] = useState<Array<{
    track_id: string
    track_name: string
    artist_name: string
    album_art_url: string | null
    preview_url: string | null
  }>>([])
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null)
  const [playlistSummary, setPlaylistSummary] = useState<PlaylistSummary | null>(room.playlist_summary || null)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [triviaStatus, setTriviaStatus] = useState<TriviaStatus | null>(null)
  const [isLoadingTrivia, setIsLoadingTrivia] = useState(false)
  const [isRegeneratingTrivia, setIsRegeneratingTrivia] = useState(false)
  const [showTriviaPreview, setShowTriviaPreview] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const backgroundWasPlayingRef = useRef(false)
  const { isPlaying: isBackgroundPlaying, stop: stopBackgroundMusic, play: resumeBackgroundMusic } = useBackgroundMusic()

  // Check if user has Spotify connected (and try to refresh if expired)
  useEffect(() => {
    const checkSpotify = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.provider_token) {
        setHasSpotify(true)
        return
      }

      // Token might be expired - try refreshing the session
      const { data: refreshData } = await supabase.auth.refreshSession()
      if (refreshData?.session?.provider_token) {
        setHasSpotify(true)
        return
      }

      setHasSpotify(false)
    }
    checkSpotify()
  }, [supabase.auth])

  const handleReconnectSpotify = async () => {
    const redirectUrl = `${window.location.origin}/auth/callback?room=${room.room_code}`
    await supabase.auth.signInWithOAuth({
      provider: 'spotify',
      options: {
        redirectTo: redirectUrl,
        scopes: 'user-read-email user-read-private playlist-modify-private playlist-modify-public ugc-image-upload',
      },
    })
  }

  // Fetch user's submitted songs
  useEffect(() => {
    if (!currentParticipant.has_submitted) {
      setMySubmissions([])
      return
    }

    const fetchSubmissions = async () => {
      const { data } = await supabase
        .from('submissions')
        .select('track_id, track_name, artist_name, album_art_url, preview_url')
        .eq('participant_id', currentParticipant.id)
        .order('submission_order', { ascending: true })

      if (data) {
        setMySubmissions(data)
      }
    }

    fetchSubmissions()
  }, [currentParticipant.has_submitted, currentParticipant.id, supabase])

  // Count players (excluding spectators) vs spectators
  const players = participants.filter(p => !p.is_spectator)
  const spectators = participants.filter(p => p.is_spectator)

  // Generate playlist summary when all players (excluding spectators) have submitted
  const allPlayersSubmitted = players.length >= 2 && players.every(p => p.has_submitted)

  useEffect(() => {
    // Only generate if:
    // - All players have submitted
    // - We don't already have a summary
    // - We're not currently generating
    if (!allPlayersSubmitted || playlistSummary || isGeneratingSummary) return

    const generateSummary = async () => {
      setIsGeneratingSummary(true)
      try {
        const response = await fetch('/api/summarise-playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: room.id }),
        })
        const data = await response.json()
        if (data.summary) {
          setPlaylistSummary(data.summary)
        }
      } catch (error) {
        console.error('Failed to generate playlist summary:', error)
      } finally {
        setIsGeneratingSummary(false)
      }
    }

    generateSummary()
  }, [allPlayersSubmitted, playlistSummary, isGeneratingSummary, room.id])

  // Update summary from room prop if it changes
  useEffect(() => {
    if (room.playlist_summary && !playlistSummary) {
      setPlaylistSummary(room.playlist_summary)
    }
  }, [room.playlist_summary, playlistSummary])

  // Fetch trivia status when all players have submitted (host only)
  useEffect(() => {
    if (!isHost || !allPlayersSubmitted || triviaStatus) return

    const fetchTriviaStatus = async () => {
      setIsLoadingTrivia(true)
      try {
        // Get all submissions with trivia facts for this room
        const { data: submissions } = await supabase
          .from('submissions')
          .select('track_name, trivia_facts, participants!inner(room_id)')
          .eq('participants.room_id', room.id)

        if (submissions) {
          const totalSongs = submissions.length
          const songsWithTrivia = submissions.filter(s => s.trivia_facts && (s.trivia_facts as TriviaFact[]).length > 0).length

          // Extract questions for preview (shuffled options, no correct answer marked)
          const questions: TriviaQuestion[] = []
          for (const sub of submissions) {
            if (sub.trivia_facts && Array.isArray(sub.trivia_facts)) {
              for (const fact of sub.trivia_facts as TriviaFact[]) {
                if (fact.question && fact.correct_answer && fact.wrong_answers) {
                  // Shuffle options
                  const options = [fact.correct_answer, ...fact.wrong_answers]
                    .sort(() => Math.random() - 0.5)
                  questions.push({
                    trackName: sub.track_name,
                    question: fact.question,
                    options,
                  })
                }
              }
            }
          }

          setTriviaStatus({ totalSongs, songsWithTrivia, questions })
        }
      } catch (error) {
        console.error('Failed to fetch trivia status:', error)
      } finally {
        setIsLoadingTrivia(false)
      }
    }

    fetchTriviaStatus()
  }, [isHost, allPlayersSubmitted, triviaStatus, room.id, supabase])

  // Regenerate trivia for all submissions
  const handleRegenerateTrivia = async () => {
    setIsRegeneratingTrivia(true)
    try {
      // Get all participants and their submissions
      const { data: allSubmissions } = await supabase
        .from('submissions')
        .select('id, track_id, track_name, artist_name, release_year, participant_id, participants!inner(room_id)')
        .eq('participants.room_id', room.id)

      if (!allSubmissions) return

      // Group by participant
      const byParticipant = new Map<string, typeof allSubmissions>()
      for (const sub of allSubmissions) {
        if (!byParticipant.has(sub.participant_id)) {
          byParticipant.set(sub.participant_id, [])
        }
        byParticipant.get(sub.participant_id)!.push(sub)
      }

      // Regenerate for each participant
      for (const [participantId, subs] of byParticipant) {
        await fetch('/api/trivia/generate-facts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tracks: subs.map(s => ({
              id: s.track_id,
              name: s.track_name,
              artist: s.artist_name,
              releaseYear: s.release_year,
            })),
            participantId,
          }),
        })
      }

      // Refresh status
      setTriviaStatus(null) // This will trigger a re-fetch
    } catch (error) {
      console.error('Failed to regenerate trivia:', error)
    } finally {
      setIsRegeneratingTrivia(false)
    }
  }

  const handleRemoveParticipant = async (participantId: string) => {
    if (!onRemoveParticipant) return
    setRemovingParticipantId(participantId)
    try {
      await onRemoveParticipant(participantId)
    } finally {
      setRemovingParticipantId(null)
    }
  }

  const toggleSpectator = async (participantId: string, makeSpectator: boolean) => {
    setTogglingSpectatorId(participantId)
    try {
      await supabase
        .from('participants')
        .update({
          is_spectator: makeSpectator,
          // Spectators are treated as "submitted" so they're included in voting
          has_submitted: makeSpectator ? true : undefined,
        })
        .eq('id', participantId)
    } catch (error) {
      console.error('Failed to toggle spectator status:', error)
    } finally {
      setTogglingSpectatorId(null)
    }
  }

  const submittedCount = players.filter(p => p.has_submitted).length
  const hasSubmitted = currentParticipant.has_submitted
  // Need at least 2 players who have submitted to start the quiz
  const canStartQuiz = submittedCount >= 2

  const settings = room.settings || DEFAULT_GAME_SETTINGS
  const displayName = room.name?.trim() || room.room_code

  const togglePlay = (track: { track_id: string, preview_url: string | null }) => {
    if (!track.preview_url) return

    if (playingTrackId === track.track_id) {
      audioRef.current?.pause()
      setPlayingTrackId(null)
      if (backgroundWasPlayingRef.current) {
        resumeBackgroundMusic()
        backgroundWasPlayingRef.current = false
      }
    } else {
      if (audioRef.current) {
        if (isBackgroundPlaying) {
          backgroundWasPlayingRef.current = true
          stopBackgroundMusic()
        }
        audioRef.current.src = track.preview_url
        audioRef.current.play()
          .then(() => setPlayingTrackId(track.track_id))
          .catch(error => {
            console.error('Audio playback failed:', error)
            setPlayingTrackId(null)
          })
      }
    }
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleEnded = () => {
      setPlayingTrackId(null)
      if (backgroundWasPlayingRef.current) {
        resumeBackgroundMusic()
        backgroundWasPlayingRef.current = false
      }
    }
    audio.addEventListener('ended', handleEnded)
    return () => audio.removeEventListener('ended', handleEnded)
  }, [resumeBackgroundMusic])

  useEffect(() => {
    return () => {
      if (backgroundWasPlayingRef.current) {
        resumeBackgroundMusic()
        backgroundWasPlayingRef.current = false
      }
    }
  }, [resumeBackgroundMusic])

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
      {/* Hidden audio element for song previews */}
      <audio ref={audioRef} />

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
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {submittedCount}/{players.length} ready
                    </Badge>
                    {spectators.length > 0 && (
                      <Badge variant="outline" className="text-muted-foreground">
                        👁 {spectators.length}
                      </Badge>
                    )}
                  </div>
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
                      {/* Spectator badge */}
                      {participant.is_spectator && (
                        <Badge variant="outline" className="text-muted-foreground text-xs">
                          👁 Spectator
                        </Badge>
                      )}
                      {/* Submission status - only show for non-spectators */}
                      {!participant.is_spectator && (
                        participant.has_submitted ? (
                          <Badge variant="default" className="bg-green-600 text-xs">Ready</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Not ready</Badge>
                        )
                      )}
                      {/* Host controls: spectator toggle and remove */}
                      {isHost && !participant.is_host && participant.id !== currentParticipant.id && (
                        <>
                          {/* Toggle spectator button */}
                          <Button
                            variant={participant.is_spectator ? 'default' : 'outline'}
                            size="sm"
                            className={`h-6 px-2 text-xs ${
                              participant.is_spectator
                                ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                                : 'text-muted-foreground'
                            }`}
                            onClick={() => toggleSpectator(participant.id, !participant.is_spectator)}
                            disabled={togglingSpectatorId === participant.id}
                          >
                            {togglingSpectatorId === participant.id ? (
                              <span className="animate-spin">⏳</span>
                            ) : participant.is_spectator ? (
                              <>
                                <Eye className="w-3 h-3 mr-1" />
                                Spectator
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3 mr-1" />
                                Spectate
                              </>
                            )}
                          </Button>
                          {/* Remove button */}
                          {onRemoveParticipant && (
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
                                <X className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </>
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
                          className={`flex items-center gap-2 p-1.5 rounded bg-muted/30 ${
                            playingTrackId === track.track_id ? 'ring-1 ring-primary/50' : ''
                          }`}
                        >
                          <span className="text-xs text-muted-foreground w-4">{index + 1}.</span>
                          <div className="relative flex-shrink-0">
                            {track.album_art_url ? (
                              <img
                                src={track.album_art_url}
                                alt={track.track_name}
                                className={`w-10 h-10 rounded ${track.preview_url ? 'ring-1 ring-border/40' : ''}`}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                <span className="text-muted-foreground text-[10px]">No art</span>
                              </div>
                            )}
                            <button
                              onClick={() => togglePlay(track)}
                              disabled={!track.preview_url}
                              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded opacity-0 hover:opacity-100 transition-opacity disabled:opacity-50"
                              aria-label={playingTrackId === track.track_id ? 'Pause preview' : 'Play preview'}
                            >
                              {playingTrackId === track.track_id ? (
                                <Pause className="w-4 h-4 text-white" />
                              ) : (
                                <Play className="w-4 h-4 text-white" />
                              )}
                            </button>
                          </div>
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
                      {submittedCount * settings.songsRequired} / {players.length * settings.songsRequired}
                    </span>
                  </div>
                  <Progress
                    value={players.length > 0 ? (submittedCount / players.length) * 100 : 0}
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
                    <div className="space-y-2">
                      <p className="text-center text-xs text-muted-foreground">
                        Spotify connection expired
                      </p>
                      <Button
                        onClick={handleReconnectSpotify}
                        variant="outline"
                        size="sm"
                        className="w-full text-[#1DB954] border-[#1DB954] hover:bg-[#1DB954]/10"
                      >
                        Reconnect Spotify
                      </Button>
                    </div>
                  )
                ) : (
                  <p className="text-center text-xs text-muted-foreground">
                    Need at least 2 players with songs to create playlist
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Playlist Summary Card - shown when all players have submitted */}
            {(playlistSummary || isGeneratingSummary) && (
              <Card className="border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-pink-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span>✨</span>
                    <span>Playlist Vibes</span>
                    {playlistSummary && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {playlistSummary.vibe}
                      </Badge>
                    )}
                    {isHost && playlistSummary && !isGeneratingSummary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 ml-1"
                        onClick={async () => {
                          setIsGeneratingSummary(true)
                          setPlaylistSummary(null)
                          try {
                            const response = await fetch('/api/summarise-playlist', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ roomId: room.id }),
                            })
                            const data = await response.json()
                            if (data.summary) {
                              setPlaylistSummary(data.summary)
                            }
                          } catch (error) {
                            console.error('Failed to regenerate summary:', error)
                          } finally {
                            setIsGeneratingSummary(false)
                          }
                        }}
                        title="Regenerate summary"
                      >
                        🔄
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isGeneratingSummary ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-pulse text-muted-foreground">
                        Analysing your playlist...
                      </div>
                    </div>
                  ) : playlistSummary ? (
                    <>
                      <p className="text-sm text-foreground/90">
                        {playlistSummary.description}
                      </p>
                      {playlistSummary.funFacts.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-border/50">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fun Facts</p>
                          <ul className="space-y-1">
                            {playlistSummary.funFacts.map((fact, index) => (
                              <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                                <span className="text-purple-400">•</span>
                                <span>{fact}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {/* Trivia Status Card - shown to host when trivia is enabled and all players submitted */}
            {isHost && settings.triviaEnabled && allPlayersSubmitted && (
              <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span>🎯</span>
                    <span>Trivia Questions</span>
                    {triviaStatus && (
                      <Badge
                        variant={triviaStatus.songsWithTrivia > 0 ? 'default' : 'secondary'}
                        className="ml-auto text-xs"
                      >
                        {triviaStatus.questions.length} ready
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoadingTrivia ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-pulse text-muted-foreground">
                        Loading trivia status...
                      </div>
                    </div>
                  ) : triviaStatus ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">AI questions generated</span>
                          <span className="font-medium">
                            {triviaStatus.songsWithTrivia} / {triviaStatus.totalSongs} songs
                          </span>
                        </div>
                        <Progress
                          value={(triviaStatus.songsWithTrivia / triviaStatus.totalSongs) * 100}
                          className="h-2"
                        />
                        <p className="text-xs text-muted-foreground">
                          + data-driven questions (release years, popularity, etc.)
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setShowTriviaPreview(true)}
                          disabled={triviaStatus.questions.length === 0}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={handleRegenerateTrivia}
                          disabled={isRegeneratingTrivia}
                        >
                          <RefreshCw className={`w-4 h-4 mr-1 ${isRegeneratingTrivia ? 'animate-spin' : ''}`} />
                          {isRegeneratingTrivia ? 'Generating...' : 'Regenerate'}
                        </Button>
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            )}

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

      {/* Trivia Preview Modal */}
      {showTriviaPreview && triviaStatus && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-lg shadow-lg max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Trivia Preview</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTriviaPreview(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              {triviaStatus.questions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No AI-generated questions yet. Try regenerating.
                </p>
              ) : (
                triviaStatus.questions.map((q, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Re: {q.trackName}
                    </p>
                    <p className="font-medium text-sm">{q.question}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {q.options.map((opt, i) => (
                        <div
                          key={i}
                          className="text-xs bg-muted/50 rounded px-2 py-1.5"
                        >
                          {String.fromCharCode(65 + i)}) {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t text-center">
              <p className="text-xs text-muted-foreground">
                Correct answers are hidden. Good luck!
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
