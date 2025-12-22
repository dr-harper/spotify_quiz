'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import { createClient } from '@/lib/supabase/client'
import type { Room, Participant, Track } from '@/types/database'
import { DEFAULT_GAME_SETTINGS } from '@/types/database'

interface SubmissionViewProps {
  room: Room
  participants: Participant[]
  currentParticipant: Participant
  onAllSubmitted: () => void
  onNavigateToLobby: () => void
}

interface ChristmasValidation {
  [trackId: string]: {
    isChristmasSong: boolean
    confidence: 'high' | 'medium' | 'low'
    reason: string
    validated: boolean
  }
}

export function SubmissionView({
  room,
  participants,
  currentParticipant,
  onAllSubmitted,
  onNavigateToLobby,
}: SubmissionViewProps) {
  const settings = room.settings || DEFAULT_GAME_SETTINGS
  const REQUIRED_SONGS = settings.songsRequired
  const REQUIRED_CHRISTMAS = settings.christmasSongsRequired || 0
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Track[]>([])
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(currentParticipant.has_submitted)
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null)
  const [christmasValidation, setChristmasValidation] = useState<ChristmasValidation>({})
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submittedFromDb, setSubmittedFromDb] = useState<Track[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const supabase = createClient()

  // Fetch submitted songs from database (for page refresh persistence)
  useEffect(() => {
    if (!currentParticipant.has_submitted) return

    const fetchSubmissions = async () => {
      const { data } = await supabase
        .from('submissions')
        .select('*')
        .eq('participant_id', currentParticipant.id)
        .order('submission_order', { ascending: true })

      if (data && data.length > 0) {
        const tracks: Track[] = data.map(sub => ({
          id: sub.track_id,
          name: sub.track_name,
          artist: sub.artist_name,
          albumName: null,
          albumArt: sub.album_art_url,
          releaseDate: null,
          releaseYear: null,
          durationMs: null,
          popularity: null,
          explicit: false,
          previewUrl: sub.preview_url,
          hasPreview: !!sub.preview_url,
          isLikelyChristmas: false,
          christmasKeywordMatches: [],
        }))
        setSubmittedFromDb(tracks)
      }
    }

    fetchSubmissions()
  }, [currentParticipant.has_submitted, currentParticipant.id, supabase])

  // Count Christmas songs (using keyword heuristic + AI validation)
  const christmasSongCount = selectedTracks.filter(track => {
    const validation = christmasValidation[track.id]
    // If validated by AI, use that result
    if (validation?.validated) return validation.isChristmasSong
    // Otherwise fall back to keyword detection
    return track.isLikelyChristmas
  }).length

  const meetsChristmasRequirement = christmasSongCount >= REQUIRED_CHRISTMAS

  const togglePlay = (track: Track) => {
    if (!track.previewUrl) return

    if (playingTrackId === track.id) {
      // Stop playing
      audioRef.current?.pause()
      setPlayingTrackId(null)
    } else {
      // Play new track
      if (audioRef.current) {
        audioRef.current.src = track.previewUrl
        audioRef.current.play()
        setPlayingTrackId(track.id)
      }
    }
  }

  // Handle audio ended
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleEnded = () => setPlayingTrackId(null)
    audio.addEventListener('ended', handleEnded)
    return () => audio.removeEventListener('ended', handleEnded)
  }, [])

  const isHost = currentParticipant.is_host
  const allSubmitted = participants.every(p => p.has_submitted)
  const submittedCount = participants.filter(p => p.has_submitted).length

  // Check if user has Spotify connected (for playlist creation)
  const [hasSpotify, setHasSpotify] = useState(false)
  useEffect(() => {
    const checkSpotify = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setHasSpotify(!!session?.provider_token)
    }
    checkSpotify()
  }, [])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)

    try {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      if (data.tracks) {
        // Filter out already selected tracks
        const filtered = data.tracks.filter(
          (track: Track) => !selectedTracks.some(s => s.id === track.id)
        )
        setSearchResults(filtered)
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectTrack = (track: Track) => {
    if (selectedTracks.length >= REQUIRED_SONGS) return
    setSelectedTracks([...selectedTracks, track])
    setSearchResults(searchResults.filter(t => t.id !== track.id))
  }

  const handleRemoveTrack = (trackId: string) => {
    setSelectedTracks(selectedTracks.filter(t => t.id !== trackId))
  }

  // Validate songs with Gemini AI
  const validateWithGemini = async (): Promise<boolean> => {
    if (REQUIRED_CHRISTMAS === 0) return true // No validation needed

    setIsValidating(true)
    setValidationError(null)

    try {
      const response = await fetch('/api/validate-christmas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracks: selectedTracks.map(t => ({
            id: t.id,
            name: t.name,
            artist: t.artist,
            albumName: t.albumName,
            releaseYear: t.releaseYear,
          })),
        }),
      })

      const data = await response.json()

      if (data.error) {
        setValidationError(data.error)
        return false
      }

      // Update validation state
      const newValidation: ChristmasValidation = {}
      for (const result of data.results) {
        newValidation[result.trackId] = {
          isChristmasSong: result.isChristmasSong,
          confidence: result.confidence,
          reason: result.reason,
          validated: true,
        }
      }
      setChristmasValidation(prev => ({ ...prev, ...newValidation }))

      // Count validated Christmas songs
      const validatedCount = data.results.filter(
        (r: { isChristmasSong: boolean }) => r.isChristmasSong
      ).length

      if (validatedCount < REQUIRED_CHRISTMAS) {
        setValidationError(
          `Only ${validatedCount} of your songs are Christmas songs. You need at least ${REQUIRED_CHRISTMAS}.`
        )
        return false
      }

      return true
    } catch (error) {
      console.error('Validation error:', error)
      setValidationError('Failed to validate songs. Please try again.')
      return false
    } finally {
      setIsValidating(false)
    }
  }

  const handleSubmit = async () => {
    if (selectedTracks.length !== REQUIRED_SONGS) return
    if (isSubmitting || isValidating) return // Prevent double-click

    // Validate Christmas songs if required
    if (REQUIRED_CHRISTMAS > 0) {
      const isValid = await validateWithGemini()
      if (!isValid) return
    }

    setIsSubmitting(true)

    try {
      // Check if already submitted (prevent duplicates)
      const { data: existingSubmissions } = await supabase
        .from('submissions')
        .select('id')
        .eq('participant_id', currentParticipant.id)
        .limit(1)

      if (existingSubmissions && existingSubmissions.length > 0) {
        setHasSubmitted(true)
        return
      }

      // Insert all submissions with metadata for trivia
      // Note: Audio features (tempo, danceability, energy, valence) are no longer available
      // as Spotify deprecated the audio-features endpoint
      const submissions = selectedTracks.map((track, index) => ({
        participant_id: currentParticipant.id,
        track_id: track.id,
        track_name: track.name,
        artist_name: track.artist,
        album_art_url: track.albumArt,
        preview_url: track.previewUrl,
        submission_order: index + 1,
        // Metadata for trivia questions
        album_name: track.albumName,
        release_year: track.releaseYear,
        duration_ms: track.durationMs,
        popularity: track.popularity,
      }))

      const { error: submissionError } = await supabase
        .from('submissions')
        .insert(submissions)

      if (submissionError) {
        console.error('Supabase submission error:', submissionError.message, submissionError.details, submissionError.hint)
        throw submissionError
      }

      // Mark participant as submitted
      const { error: updateError } = await supabase
        .from('participants')
        .update({ has_submitted: true })
        .eq('id', currentParticipant.id)

      if (updateError) throw updateError

      setHasSubmitted(true)
    } catch (error: unknown) {
      const err = error as { message?: string; details?: string; hint?: string }
      console.error('Submission error:', err.message || error, err.details, err.hint)
    } finally {
      setIsSubmitting(false)
    }
  }

  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)

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
      alert('Failed to create playlist')
    } finally {
      setIsCreatingPlaylist(false)
    }
  }

  // Already submitted view - lobby while waiting
  if (hasSubmitted) {
    // Show the songs that were selected (prefer in-memory, fall back to database)
    const submittedSongs = selectedTracks.length > 0 ? selectedTracks : submittedFromDb

    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <GameBreadcrumbs
            currentStage="submitting"
            canNavigate={isHost}
            onNavigate={(stage) => stage === 'lobby' && onNavigateToLobby()}
          />
          <Card className="border-2 border-accent/30">
            <CardHeader className="text-center">
              <div className="text-5xl mb-4">🎄</div>
              <CardTitle className="text-2xl">Songs Submitted!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Show submitted songs */}
              {submittedSongs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Your picks:</p>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {submittedSongs.map((track, index) => (
                      <div
                        key={track.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                      >
                        <span className="text-sm text-muted-foreground w-5">{index + 1}.</span>
                        {track.albumArt && (
                          <img
                            src={track.albumArt}
                            alt=""
                            className="w-8 h-8 rounded flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{track.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                        </div>
                        {track.isLikelyChristmas && (
                          <span className="text-sm">🎄</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!allSubmitted && (
                <p className="text-center text-muted-foreground">
                  Waiting for other players...
                </p>
              )}

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Players submitted</span>
                  <span className="font-semibold">{submittedCount}/{participants.length}</span>
                </div>
                <Progress value={(submittedCount / participants.length) * 100} />
              </div>

              <div className="space-y-2">
                {participants.map(p => (
                  <div key={p.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback>{p.display_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-sm">{p.display_name}</span>
                    {p.has_submitted ? (
                      <Badge variant="default" className="bg-accent">Done</Badge>
                    ) : (
                      <Badge variant="outline">Picking...</Badge>
                    )}
                  </div>
                ))}
              </div>

              {/* Save Playlist Option */}
              {allSubmitted && (
                <Card className="border border-secondary/30">
                  <CardContent className="pt-4">
                    {playlistUrl ? (
                      <div className="text-center space-y-2">
                        <p className="text-accent text-sm font-semibold">Playlist created!</p>
                        <Button
                          asChild
                          size="sm"
                          className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-white"
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
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        {isCreatingPlaylist ? 'Creating...' : 'Save Songs to Playlist'}
                      </Button>
                    ) : (
                      <p className="text-center text-xs text-muted-foreground">
                        Connect Spotify from the menu to save playlists
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Host can start quiz when at least 2 players have submitted */}
              {isHost && submittedCount >= 2 && (
                <div className="space-y-2">
                  {!allSubmitted && (
                    <p className="text-center text-sm text-amber-500">
                      {participants.length - submittedCount} player{participants.length - submittedCount !== 1 ? 's' : ''} will be excluded from the quiz
                    </p>
                  )}
                  <Button
                    onClick={onAllSubmitted}
                    className="w-full h-12 text-lg"
                    size="lg"
                    variant={allSubmitted ? 'default' : 'secondary'}
                  >
                    {allSubmitted ? 'Start Quiz!' : 'Start Quiz Anyway'}
                  </Button>
                </div>
              )}

              {isHost && submittedCount < 2 && (
                <p className="text-center text-muted-foreground">
                  Need at least 2 players to submit before starting...
                </p>
              )}

              {!isHost && submittedCount >= 2 && (
                <p className="text-center text-muted-foreground">
                  Waiting for host to start the quiz...
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col p-4 pb-32">
      {/* Hidden audio element for previews */}
      <audio ref={audioRef} />

      {/* Breadcrumbs */}
      <div className="max-w-6xl mx-auto w-full pt-2">
        <GameBreadcrumbs
          currentStage="submitting"
          canNavigate={isHost}
          onNavigate={(stage) => stage === 'lobby' && onNavigateToLobby()}
        />
      </div>

      {/* Progress Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur py-4 z-10 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">Pick Your Songs</h1>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {selectedTracks.length}/{REQUIRED_SONGS}
          </Badge>
        </div>
        <Progress value={(selectedTracks.length / REQUIRED_SONGS) * 100} />
      </div>

      {/* Two-column layout */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6 mt-4">
        {/* Left Column - Search (3/5 width on large screens) */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Search for Songs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search for a song..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? 'Searching...' : 'Search'}
                </Button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {searchResults.map((track) => (
                    <div
                      key={track.id}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        track.hasPreview ? 'hover:bg-muted/50' : 'opacity-40'
                      } ${playingTrackId === track.id ? 'bg-primary/10 border border-primary/30' : ''}`}
                    >
                      {/* Album art with play button overlay */}
                      <div className="relative flex-shrink-0">
                        {track.albumArt ? (
                          <img
                            src={track.albumArt}
                            alt=""
                            className="w-12 h-12 rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                            <span className="text-muted-foreground text-xs">No art</span>
                          </div>
                        )}
                        <button
                          onClick={() => togglePlay(track)}
                          disabled={!track.hasPreview}
                          className="absolute inset-0 flex items-center justify-center bg-black/40 rounded opacity-0 hover:opacity-100 transition-opacity disabled:opacity-50"
                        >
                          {playingTrackId === track.id ? (
                            <span className="text-white text-lg">&#9208;</span>
                          ) : (
                            <span className="text-white text-lg">&#9654;</span>
                          )}
                        </button>
                        {/* Christmas indicator */}
                        {track.isLikelyChristmas && (
                          <span className="absolute -top-1 -right-1 text-sm" title="Likely Christmas song">🎄</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{track.name}</p>
                          {track.explicit && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">E</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {track.releaseYear && <span>{track.releaseYear}</span>}
                          {track.albumName && (
                            <span className="truncate max-w-32" title={track.albumName}>
                              {track.albumName}
                            </span>
                          )}
                        </div>
                      </div>

                      {track.hasPreview ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectTrack(track)}
                          disabled={selectedTracks.length >= REQUIRED_SONGS}
                        >
                          Add
                        </Button>
                      ) : (
                        <Badge variant="secondary" className="text-xs">No preview</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {searchResults.length === 0 && !isSearching && (
                <p className="text-center text-muted-foreground py-8">
                  Search for songs to add to your selection
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Selected Tracks (2/5 width on large screens) */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-24 space-y-4">
            <Card className="border-2 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  Your Selections
                  <Badge variant="secondary">{selectedTracks.length}/{REQUIRED_SONGS}</Badge>
                </CardTitle>
                {/* Christmas requirement indicator */}
                {REQUIRED_CHRISTMAS > 0 && (
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Christmas songs</span>
                    <Badge
                      variant={meetsChristmasRequirement ? 'default' : 'destructive'}
                      className={meetsChristmasRequirement ? 'bg-green-600' : ''}
                    >
                      🎄 {christmasSongCount}/{REQUIRED_CHRISTMAS}
                    </Badge>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {selectedTracks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No songs selected yet
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {selectedTracks.map((track, index) => {
                      const validation = christmasValidation[track.id]
                      const isChristmas = validation?.validated
                        ? validation.isChristmasSong
                        : track.isLikelyChristmas

                      return (
                        <div
                          key={track.id}
                          className={`flex items-center gap-2 p-2 rounded-lg ${
                            validation?.validated && !validation.isChristmasSong
                              ? 'bg-destructive/10 border border-destructive/30'
                              : 'bg-muted/50'
                          }`}
                        >
                          <span className="text-sm text-muted-foreground w-5">{index + 1}.</span>
                          <div className="relative">
                            {track.albumArt && (
                              <img
                                src={track.albumArt}
                                alt=""
                                className="w-8 h-8 rounded flex-shrink-0"
                              />
                            )}
                            {isChristmas && (
                              <span className="absolute -top-1 -right-1 text-xs">🎄</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{track.name}</p>
                            <div className="flex items-center gap-1">
                              <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                              {track.releaseYear && (
                                <span className="text-xs text-muted-foreground">• {track.releaseYear}</span>
                              )}
                            </div>
                            {validation?.validated && (
                              <p className={`text-xs ${validation.isChristmasSong ? 'text-green-600' : 'text-destructive'}`}>
                                {validation.reason}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveTrack(track.id)}
                            className="text-destructive hover:text-destructive h-7 w-7 p-0"
                          >
                            ×
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Validation Error */}
            {validationError && (
              <Card className="border-destructive bg-destructive/10">
                <CardContent className="py-3">
                  <p className="text-sm text-destructive">{validationError}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t">
        <div className="max-w-6xl mx-auto space-y-2">
          {/* Christmas requirement warning */}
          {REQUIRED_CHRISTMAS > 0 && selectedTracks.length === REQUIRED_SONGS && !meetsChristmasRequirement && (
            <p className="text-center text-sm text-amber-500">
              ⚠️ You need at least {REQUIRED_CHRISTMAS} Christmas songs (currently {christmasSongCount})
            </p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={selectedTracks.length !== REQUIRED_SONGS || isSubmitting || isValidating}
            className="w-full h-14 text-lg"
            size="lg"
          >
            {isValidating
              ? '🎄 Checking songs with AI...'
              : isSubmitting
              ? 'Submitting...'
              : selectedTracks.length === REQUIRED_SONGS
              ? REQUIRED_CHRISTMAS > 0
                ? `Submit Songs (AI will verify ${REQUIRED_CHRISTMAS} are festive)`
                : 'Submit Songs'
              : `Select ${REQUIRED_SONGS - selectedTracks.length} more songs`}
          </Button>
        </div>
      </div>
    </main>
  )
}
