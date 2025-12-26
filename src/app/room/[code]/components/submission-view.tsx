'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
import { useBackgroundMusic } from '@/components/background-music'
import { Play, Pause } from 'lucide-react'

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
  const REQUIRED_RECENT = settings.recentSongsRequired || 0
  const CURRENT_YEAR = new Date().getFullYear()
  const CHAMELEON_MODE = settings.chameleonMode || false
  const ALLOW_DUPLICATES = settings.allowDuplicateSongs || false
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
  const [chameleonTrackId, setChameleonTrackId] = useState<string | null>(null)
  const [christmasOverrides, setChristmasOverrides] = useState<Record<string, boolean>>({})
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [moodTag, setMoodTag] = useState<string | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [takenTrackIds, setTakenTrackIds] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [showPlayers, setShowPlayers] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const backgroundWasPlayingRef = useRef(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()
  const { isPlaying: isBackgroundPlaying, stop: stopBackgroundMusic, play: resumeBackgroundMusic } = useBackgroundMusic()

  const displayName = room.name?.trim() || room.room_code

  const copyRoomLink = () => {
    const url = `${window.location.origin}/room/${room.room_code}`
    const inviteText = `🎵 ${displayName}

Pick your favourite songs, we'll shuffle them into a playlist, then guess who chose what!

Join: ${url}`
    navigator.clipboard.writeText(inviteText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // localStorage key for draft persistence
  const DRAFT_KEY = `festive-frequencies-draft-${room.id}`

  // Load draft from localStorage on mount
  useEffect(() => {
    if (currentParticipant.has_submitted) return

    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const draft = JSON.parse(saved) as Track[]
        if (Array.isArray(draft) && draft.length > 0) {
          setSelectedTracks(draft)
        }
      }
    } catch {
      // Invalid data in localStorage, ignore
    }
  }, [DRAFT_KEY, currentParticipant.has_submitted])

  // Save draft to localStorage when selections change
  useEffect(() => {
    if (currentParticipant.has_submitted) return

    if (selectedTracks.length > 0) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(selectedTracks))
    } else {
      localStorage.removeItem(DRAFT_KEY)
    }
  }, [selectedTracks, DRAFT_KEY, currentParticipant.has_submitted])

  // Clear draft after successful submission
  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY)
  }, [DRAFT_KEY])

  // Warn before leaving with unsaved selections
  useEffect(() => {
    if (currentParticipant.has_submitted || selectedTracks.length === 0) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [selectedTracks.length, currentParticipant.has_submitted])

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
          isChameleon: sub.is_chameleon || false,
        }))
        setSubmittedFromDb(tracks)
      }
    }

    fetchSubmissions()
  }, [currentParticipant.has_submitted, currentParticipant.id, supabase])

  // Fetch other players' submissions to prevent duplicates (when not allowed)
  useEffect(() => {
    if (ALLOW_DUPLICATES) return
    if (currentParticipant.has_submitted) return

    const fetchTakenTracks = async () => {
      // Get all other participants in this room
      const otherParticipantIds = participants
        .filter(p => p.id !== currentParticipant.id)
        .map(p => p.id)

      if (otherParticipantIds.length === 0) return

      const { data } = await supabase
        .from('submissions')
        .select('track_id')
        .in('participant_id', otherParticipantIds)

      if (data && data.length > 0) {
        const trackIds = new Set(data.map(sub => sub.track_id))
        setTakenTrackIds(trackIds)
      }
    }

    fetchTakenTracks()
  }, [ALLOW_DUPLICATES, currentParticipant.has_submitted, currentParticipant.id, participants, supabase])

  // Check if a track is marked as Christmas (respects user overrides)
  const isTrackChristmas = (track: Track): boolean => {
    // User override takes priority
    if (christmasOverrides[track.id] !== undefined) {
      return christmasOverrides[track.id]
    }
    // Then AI validation
    const validation = christmasValidation[track.id]
    if (validation?.validated) return validation.isChristmasSong
    // Otherwise fall back to keyword detection
    return track.isLikelyChristmas
  }

  // Count Christmas songs
  const christmasSongCount = selectedTracks.filter(isTrackChristmas).length

  const meetsChristmasRequirement = christmasSongCount >= REQUIRED_CHRISTMAS

  // Check if a track is from the current year
  const isTrackRecent = (track: Track): boolean => {
    return track.releaseYear === CURRENT_YEAR
  }

  // Count recent songs (from current year)
  const recentSongCount = selectedTracks.filter(isTrackRecent).length

  const meetsRecentRequirement = recentSongCount >= REQUIRED_RECENT

  const togglePlay = (track: Track) => {
    if (!track.previewUrl) return

    if (playingTrackId === track.id) {
      // Stop playing
      audioRef.current?.pause()
      setPlayingTrackId(null)
      if (backgroundWasPlayingRef.current) {
        resumeBackgroundMusic()
        backgroundWasPlayingRef.current = false
      }
    } else {
      // Play new track
      if (audioRef.current) {
        if (isBackgroundPlaying) {
          backgroundWasPlayingRef.current = true
          stopBackgroundMusic()
        }
        audioRef.current.src = track.previewUrl
        audioRef.current.play()
          .then(() => setPlayingTrackId(track.id))
          .catch(error => {
            console.error('Audio playback failed:', error)
            setPlayingTrackId(null)
          })
      }
    }
  }

  // Handle audio ended
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

  const isHost = currentParticipant.is_host
  // Spectators don't need to submit, so filter them out
  const players = participants.filter(p => !p.is_spectator)
  const spectators = participants.filter(p => p.is_spectator)
  const allSubmitted = players.every(p => p.has_submitted)
  const submittedCount = players.filter(p => p.has_submitted).length

  // Check if user has Spotify connected (for playlist creation)
  const [hasSpotify, setHasSpotify] = useState(false)
  useEffect(() => {
    const checkSpotify = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setHasSpotify(!!session?.provider_token)
    }
    checkSpotify()
  }, [])

  // Perform the actual search
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setIsSearching(true)

    try {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      if (data.tracks) {
        // Filter out already selected tracks and taken tracks (if duplicates not allowed)
        const filtered = data.tracks.filter(
          (track: Track) =>
            !selectedTracks.some(s => s.id === track.id) &&
            (ALLOW_DUPLICATES || !takenTrackIds.has(track.id))
        )
        setSearchResults(filtered)
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }, [selectedTracks, ALLOW_DUPLICATES, takenTrackIds])

  // Debounced search - triggers automatically as user types
  useEffect(() => {
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Don't search if query is empty or too short
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      if (!searchQuery.trim()) setSearchResults([])
      return
    }

    // Set up debounced search (400ms delay)
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(searchQuery)
    }, 400)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, performSearch])

  // Manual search (for Enter key or button click)
  const handleSearch = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    performSearch(searchQuery)
  }

  const handleSelectTrack = (track: Track) => {
    if (selectedTracks.length >= REQUIRED_SONGS) return
    // Prevent adding the same song twice (race condition protection)
    if (selectedTracks.some(t => t.id === track.id)) return
    setSelectedTracks([...selectedTracks, track])
    setSearchResults(searchResults.filter(t => t.id !== track.id))
  }

  const handleRemoveTrack = (trackId: string) => {
    setSelectedTracks(selectedTracks.filter(t => t.id !== trackId))
    // Clear chameleon if this track was marked
    if (chameleonTrackId === trackId) {
      setChameleonTrackId(null)
    }
  }

  const toggleChameleon = (trackId: string) => {
    setChameleonTrackId(prev => prev === trackId ? null : trackId)
  }

  const toggleChristmas = (track: Track) => {
    const currentValue = isTrackChristmas(track)
    setChristmasOverrides(prev => ({
      ...prev,
      [track.id]: !currentValue,
    }))
  }

  const hasChameleonSelected = chameleonTrackId !== null

  // Fetch AI summary and mood tag when all songs are selected
  useEffect(() => {
    if (selectedTracks.length !== REQUIRED_SONGS) {
      setAiSummary(null)
      setMoodTag(null)
      return
    }

    const fetchSummary = async () => {
      setIsLoadingSummary(true)
      try {
        const response = await fetch('/api/summarise-picks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tracks: selectedTracks.map(t => ({
              name: t.name,
              artist: t.artist,
              albumName: t.albumName,
              releaseYear: t.releaseYear,
              isChristmas: isTrackChristmas(t),
            })),
            playerName: currentParticipant.display_name,
          }),
        })
        const data = await response.json()
        setAiSummary(data.summary || null)
        setMoodTag(data.moodTag || null)
      } catch (error) {
        console.error('Summary error:', error)
      } finally {
        setIsLoadingSummary(false)
      }
    }

    fetchSummary()
  }, [selectedTracks.length, REQUIRED_SONGS, currentParticipant.display_name])

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
    if (isSubmitting) return // Prevent double-click

    // Validate chameleon song if in chameleon mode
    if (CHAMELEON_MODE && !hasChameleonSelected) {
      setValidationError('Please mark one song as your chameleon pick (disguised as someone else\'s taste)')
      return
    }

    // Validate Christmas songs requirement
    if (REQUIRED_CHRISTMAS > 0 && !meetsChristmasRequirement) {
      setValidationError(`You need at least ${REQUIRED_CHRISTMAS} Christmas songs (currently ${christmasSongCount}). Use the 🎄 button to mark songs as festive.`)
      return
    }

    // Validate recent songs requirement
    if (REQUIRED_RECENT > 0 && !meetsRecentRequirement) {
      setValidationError(`You need at least ${REQUIRED_RECENT} song${REQUIRED_RECENT > 1 ? 's' : ''} from ${CURRENT_YEAR} (currently ${recentSongCount}).`)
      return
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
        // Chameleon mode
        is_chameleon: CHAMELEON_MODE && track.id === chameleonTrackId,
      }))

      const { error: submissionError } = await supabase
        .from('submissions')
        .insert(submissions)

      if (submissionError) {
        console.error('Supabase submission error:', submissionError.message, submissionError.details, submissionError.hint)
        throw submissionError
      }

      // Mark participant as submitted and save AI summary
      const { data: updatedParticipant, error: updateError } = await supabase
        .from('participants')
        .update({
          has_submitted: true,
          ai_summary: aiSummary,
          mood_tag: moodTag,
        })
        .eq('id', currentParticipant.id)
        .select()
        .single()

      if (updateError) {
        console.error('Participant update error:', updateError.message, updateError.details, updateError.hint)
        throw updateError
      }

      if (!updatedParticipant) {
        console.error('Participant update returned no data. ID:', currentParticipant.id)
        throw new Error('Failed to update participant status')
      }

      console.log('Participant updated successfully:', updatedParticipant.id, 'has_submitted:', updatedParticipant.has_submitted)

      clearDraft()
      setHasSubmitted(true)

      // Generate trivia facts in the background (non-blocking)
      fetch('/api/trivia/generate-facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracks: selectedTracks.map(t => ({
            id: t.id,
            name: t.name,
            artist: t.artist,
            releaseYear: t.releaseYear,
          })),
          participantId: currentParticipant.id,
        }),
      }).catch(err => console.warn('Trivia fact generation failed:', err))

      // Navigate back to lobby after successful submission
      onNavigateToLobby()
    } catch (error: unknown) {
      const err = error as { message?: string; details?: string; hint?: string }
      console.error('Submission error:', err.message || error, err.details, err.hint)
    } finally {
      setIsSubmitting(false)
    }
  }

  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const handleEditSubmission = async () => {
    setIsEditing(true)
    try {
      // Delete existing submissions
      const { error: deleteError } = await supabase
        .from('submissions')
        .delete()
        .eq('participant_id', currentParticipant.id)

      if (deleteError) {
        console.error('Failed to delete submissions:', deleteError)
        alert('Failed to edit picks. Please try again.')
        return
      }

      // Verify deletion worked
      const { data: remainingSubmissions } = await supabase
        .from('submissions')
        .select('id')
        .eq('participant_id', currentParticipant.id)
        .limit(1)

      if (remainingSubmissions && remainingSubmissions.length > 0) {
        console.error('Submissions still exist after delete')
        alert('Failed to clear old picks. Please try again.')
        return
      }

      // Mark participant as not submitted and clear AI summary
      const { error: updateError } = await supabase
        .from('participants')
        .update({
          has_submitted: false,
          ai_summary: null,
          mood_tag: null,
        })
        .eq('id', currentParticipant.id)

      if (updateError) {
        console.error('Failed to update participant:', updateError)
        alert('Failed to reset submission status. Please try again.')
        return
      }

      // Reset local state - keep the tracks so they can modify
      if (submittedFromDb.length > 0) {
        setSelectedTracks(submittedFromDb)
      }
      setHasSubmitted(false)
      setChameleonTrackId(null)
      setChristmasOverrides({})
      setAiSummary(null)
      setMoodTag(null)
    } catch (error) {
      console.error('Error editing submission:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setIsEditing(false)
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
      <main className="flex min-h-screen flex-col items-center p-4 pt-8">
        {/* Hidden audio element for previews */}
        <audio ref={audioRef} />

        <div className="w-full max-w-4xl">
          <div className="max-w-md mx-auto lg:max-w-none">
            <GameBreadcrumbs
              currentStage="submitting"
              canNavigate={isHost}
              onNavigate={(stage) => stage === 'lobby' && onNavigateToLobby()}
            />
          </div>

          {/* Room Info Header */}
          <div className="my-4 max-w-md mx-auto lg:max-w-none">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-card/80 border border-border/50">
              <div>
                <h1 className="text-lg font-bold">{displayName}</h1>
                <p className="text-xs text-muted-foreground font-mono">Code: {room.room_code}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={copyRoomLink}
              >
                {copied ? '✓ Copied!' : '📋 Invite'}
              </Button>
            </div>
          </div>

          <div className="text-center space-y-1 my-6">
            <div className="text-4xl mb-2">🎄</div>
            <h1 className="text-2xl font-bold text-foreground">Songs Submitted!</h1>
            <p className="text-sm text-muted-foreground">
              {allSubmitted ? 'Everyone is ready!' : 'Waiting for other players...'}
            </p>
          </div>

          {/* Two-column layout on larger screens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-md mx-auto lg:max-w-none">
            {/* Left Column - Your Picks */}
            <div className="space-y-4">
              <Card className="border-2 border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    Your Picks
                    <Badge variant="secondary">{submittedSongs.length} songs</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {submittedSongs.length > 0 && (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {submittedSongs.map((track, index) => (
                        <div
                          key={track.id}
                          className={`flex items-center gap-2 p-2 rounded-lg ${
                            isTrackChristmas(track) ? 'bg-green-500/10' : 'bg-muted/50'
                          }`}
                        >
                          <span className="text-sm text-muted-foreground w-5">{index + 1}.</span>
                          <div className="relative flex-shrink-0">
                            {track.albumArt ? (
                              <img
                                src={track.albumArt}
                                alt={track.name}
                                className={`w-10 h-10 rounded ${
                                  track.previewUrl ? 'ring-1 ring-border/40' : ''
                                }`}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                <span className="text-muted-foreground text-xs">No art</span>
                              </div>
                            )}
                            <button
                              onClick={() => togglePlay(track)}
                              disabled={!track.previewUrl}
                              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded opacity-0 hover:opacity-100 transition-opacity disabled:opacity-50"
                              aria-label={playingTrackId === track.id ? 'Pause preview' : 'Play preview'}
                            >
                              {playingTrackId === track.id ? (
                                <Pause className="w-4 h-4 text-white" />
                              ) : (
                                <Play className="w-4 h-4 text-white" />
                              )}
                            </button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{track.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                          </div>
                          {isTrackChristmas(track) && (
                            <span className="text-sm" title="Christmas song">🎄</span>
                          )}
                          {(track.isChameleon || chameleonTrackId === track.id) && (
                            <span className="text-sm" title="Chameleon pick">🦎</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="secondary"
                    onClick={handleEditSubmission}
                    disabled={isEditing}
                    className="w-full"
                  >
                    {isEditing ? 'Loading...' : '✏️ Edit My Picks'}
                  </Button>
                </CardContent>
              </Card>

              {/* Save Playlist Option - shown on mobile */}
              <div className="lg:hidden">
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
              </div>
            </div>

            {/* Right Column - Players Status */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    Players
                    <div className="flex items-center gap-2">
                      <Badge variant={allSubmitted ? 'default' : 'secondary'}>
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
                <CardContent className="space-y-4">
                  <Progress value={players.length > 0 ? (submittedCount / players.length) * 100 : 0} />

                  <div className="space-y-2">
                    {participants.map(p => (
                      <div
                        key={p.id}
                        className={`flex items-center gap-3 p-2 rounded-lg ${
                          p.id === currentParticipant.id
                            ? 'bg-primary/10 border border-primary/20'
                            : ''
                        }`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={p.avatar_url || undefined} />
                          <AvatarFallback>{p.display_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm font-medium">
                          {p.display_name}
                          {p.id === currentParticipant.id && (
                            <span className="text-muted-foreground text-xs ml-2">(You)</span>
                          )}
                        </span>
                        {p.is_spectator ? (
                          <Badge variant="outline" className="text-muted-foreground">👁 Spectator</Badge>
                        ) : p.has_submitted ? (
                          <Badge variant="default" className="bg-accent">Ready</Badge>
                        ) : (
                          <Badge variant="outline" className="animate-pulse">Picking...</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Save Playlist Option - shown on desktop */}
              <div className="hidden lg:block">
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
              </div>

              {/* Continue / Start Quiz Button */}
              <div className="space-y-2">
                {isHost && submittedCount >= 2 && (
                  <>
                    {!allSubmitted && (
                      <p className="text-center text-sm text-amber-500">
                        {players.length - submittedCount} player{players.length - submittedCount !== 1 ? 's' : ''} will join as spectator{players.length - submittedCount !== 1 ? 's' : ''}
                      </p>
                    )}
                    <Button
                      onClick={onAllSubmitted}
                      className="w-full h-14 text-lg"
                      size="lg"
                    >
                      {allSubmitted ? 'Continue to Quiz →' : 'Start Quiz Anyway →'}
                    </Button>
                  </>
                )}

                {isHost && submittedCount < 2 && (
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground">
                      Need at least 2 players to continue
                    </p>
                  </div>
                )}

                {!isHost && (
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground">
                      {submittedCount >= 2
                        ? 'Waiting for host to start the quiz...'
                        : 'Waiting for more players...'}
                    </p>
                  </div>
                )}

                {/* Back to Lobby Button */}
                <Button
                  variant="outline"
                  onClick={onNavigateToLobby}
                  className="w-full"
                >
                  ← Back to Lobby
                </Button>
              </div>
            </div>
          </div>
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

      {/* Room Info Header */}
      <div className="max-w-6xl mx-auto w-full mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-card/80 border border-border/50">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold">{displayName}</h1>
              <p className="text-xs text-muted-foreground font-mono">Code: {room.room_code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPlayers(!showPlayers)}
              className="gap-1"
            >
              <span>👥</span>
              <span>{participants.length}</span>
              <span className="text-xs">({participants.filter(p => p.has_submitted).length} ready)</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={copyRoomLink}
            >
              {copied ? '✓ Copied!' : '📋 Invite'}
            </Button>
          </div>
        </div>

        {/* Collapsible Player List */}
        {showPlayers && (
          <div className="mt-2 p-3 rounded-lg bg-card/60 border border-border/30">
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                    p.is_spectator
                      ? 'bg-muted/30 text-muted-foreground'
                      : p.has_submitted
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-muted/50'
                  }`}
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={p.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {p.display_name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{p.display_name}</span>
                  {p.is_host && <span className="text-xs">👑</span>}
                  {p.is_spectator ? (
                    <span className="text-xs">👁</span>
                  ) : p.has_submitted ? (
                    <span className="text-xs">✓</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
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

      {/* Game Rules Explainer */}
      <div className="w-full max-w-6xl mx-auto mt-4">
        <div className="p-4 rounded-lg bg-card/90 backdrop-blur-md border border-white/10 space-y-2">
          <p className="text-sm">
            Pick songs that represent your taste — your friends will try to guess which ones are yours!
          </p>
          {(CHAMELEON_MODE || REQUIRED_CHRISTMAS > 0 || REQUIRED_RECENT > 0 || !ALLOW_DUPLICATES) && (
            <ul className="text-sm text-muted-foreground space-y-1">
              {CHAMELEON_MODE && (
                <li className="flex items-start gap-2">
                  <span>🦎</span>
                  <span>Pick one song disguised as someone else&apos;s taste. Score bonus points if they guess wrong!</span>
                </li>
              )}
              {REQUIRED_CHRISTMAS > 0 && (
                <li className="flex items-start gap-2">
                  <span>🎄</span>
                  <span>At least {REQUIRED_CHRISTMAS} song{REQUIRED_CHRISTMAS > 1 ? 's' : ''} must be Christmas songs</span>
                </li>
              )}
              {REQUIRED_RECENT > 0 && (
                <li className="flex items-start gap-2">
                  <span>📅</span>
                  <span>At least {REQUIRED_RECENT} song{REQUIRED_RECENT > 1 ? 's' : ''} must be from {CURRENT_YEAR}</span>
                </li>
              )}
              {!ALLOW_DUPLICATES && (
                <li className="flex items-start gap-2">
                  <span>🚫</span>
                  <span>Songs already picked by others won&apos;t appear in search</span>
                </li>
              )}
            </ul>
          )}
        </div>
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
                  placeholder="Start typing to search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                />
                <Button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  variant="outline"
                >
                  {isSearching ? '...' : 'Search'}
                </Button>
              </div>
              {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
                <p className="text-xs text-muted-foreground">Type at least 2 characters to search</p>
              )}

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
                            alt={track.name}
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
                            <Pause className="w-4 h-4 text-white" />
                          ) : (
                            <Play className="w-4 h-4 text-white" />
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

              {searchResults.length === 0 && !isSearching && !searchQuery.trim() && (
                <p className="text-center text-muted-foreground py-8">
                  Start typing to search for songs
                </p>
              )}
              {searchResults.length === 0 && !isSearching && searchQuery.trim().length >= 2 && (
                <p className="text-center text-muted-foreground py-8">
                  No results found for &quot;{searchQuery}&quot;
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
                {/* Recent songs requirement indicator */}
                {REQUIRED_RECENT > 0 && (
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Songs from {CURRENT_YEAR}</span>
                    <Badge
                      variant={meetsRecentRequirement ? 'default' : 'destructive'}
                      className={meetsRecentRequirement ? 'bg-blue-600' : ''}
                    >
                      📅 {recentSongCount}/{REQUIRED_RECENT}
                    </Badge>
                  </div>
                )}
                {/* Chameleon mode indicator */}
                {CHAMELEON_MODE && (
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Chameleon pick</span>
                    <Badge
                      variant={hasChameleonSelected ? 'default' : 'outline'}
                      className={hasChameleonSelected ? 'bg-purple-600' : ''}
                    >
                      🦎 {hasChameleonSelected ? '1/1' : '0/1'}
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
                      const isChristmas = isTrackChristmas(track)
                      const hasChristmasOverride = christmasOverrides[track.id] !== undefined
                      const isChameleon = chameleonTrackId === track.id

                      return (
                        <div
                          key={track.id}
                          className={`flex items-center gap-2 p-2 rounded-lg ${
                            isChameleon
                              ? 'bg-purple-500/10 border border-purple-500/30'
                              : isChristmas
                                ? 'bg-green-500/10 border border-green-500/30'
                                : 'bg-muted/50'
                          }`}
                        >
                          <span className="text-sm text-muted-foreground w-5">{index + 1}.</span>
                          <div className="relative flex-shrink-0">
                            {track.albumArt ? (
                              <img
                                src={track.albumArt}
                                alt={track.name}
                                className={`w-10 h-10 rounded ${
                                  track.hasPreview ? 'ring-1 ring-border/40' : ''
                                }`}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                <span className="text-muted-foreground text-[10px]">No art</span>
                              </div>
                            )}
                            <button
                              onClick={() => togglePlay(track)}
                              disabled={!track.hasPreview}
                              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded opacity-0 hover:opacity-100 transition-opacity disabled:opacity-50"
                              aria-label={playingTrackId === track.id ? 'Pause preview' : 'Play preview'}
                            >
                              {playingTrackId === track.id ? (
                                <Pause className="w-4 h-4 text-white" />
                              ) : (
                                <Play className="w-4 h-4 text-white" />
                              )}
                            </button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{track.name}</p>
                            <div className="flex items-center gap-1">
                              <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                              {track.releaseYear && (
                                <span className={`text-xs ${isTrackRecent(track) ? 'text-blue-500 font-medium' : 'text-muted-foreground'}`}>
                                  • {track.releaseYear} {isTrackRecent(track) && REQUIRED_RECENT > 0 && '📅'}
                                </span>
                              )}
                            </div>
                            {validation?.validated && !hasChristmasOverride && (
                              <p className={`text-xs ${validation.isChristmasSong ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {validation.reason}
                              </p>
                            )}
                            {hasChristmasOverride && (
                              <p className="text-xs text-blue-500">
                                Manually marked as {isChristmas ? 'Christmas' : 'not Christmas'}
                              </p>
                            )}
                          </div>
                          {/* Action buttons */}
                          <div className="flex items-center gap-1">
                            {/* Christmas toggle - only show if Christmas songs required */}
                            {REQUIRED_CHRISTMAS > 0 && (
                              <Button
                                variant={isChristmas ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => toggleChristmas(track)}
                                className={`h-7 w-7 p-0 ${isChristmas ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-green-500/20'}`}
                                title={isChristmas ? 'Marked as Christmas song (click to remove)' : 'Mark as Christmas song'}
                              >
                                🎄
                              </Button>
                            )}
                            {/* Chameleon toggle */}
                            {CHAMELEON_MODE && (
                              <Button
                                variant={isChameleon ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => toggleChameleon(track.id)}
                                className={`h-7 w-7 p-0 ${isChameleon ? 'bg-purple-600 hover:bg-purple-700' : 'hover:bg-purple-500/20'}`}
                                title={isChameleon ? 'This is your chameleon pick' : 'Mark as chameleon pick'}
                              >
                                🦎
                              </Button>
                            )}
                            {/* Delete button - more distinct */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveTrack(track.id)}
                              className="h-7 w-7 p-0 ml-1 text-destructive hover:text-destructive-foreground hover:bg-destructive rounded-full"
                              title="Remove song"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                              </svg>
                            </Button>
                          </div>
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
          {/* AI Summary */}
          {selectedTracks.length === REQUIRED_SONGS && (
            <div className="text-center p-3 rounded-lg bg-muted/50 border border-muted">
              {isLoadingSummary ? (
                <p className="text-sm text-muted-foreground animate-pulse">✨ AI is reviewing your picks...</p>
              ) : aiSummary ? (
                <p className="text-sm italic">&quot;{aiSummary}&quot;</p>
              ) : null}
            </div>
          )}
          {/* Christmas requirement warning */}
          {REQUIRED_CHRISTMAS > 0 && selectedTracks.length === REQUIRED_SONGS && !meetsChristmasRequirement && (
            <p className="text-center text-sm text-amber-500">
              ⚠️ You need at least {REQUIRED_CHRISTMAS} Christmas songs (currently {christmasSongCount})
            </p>
          )}
          {/* Recent songs requirement warning */}
          {REQUIRED_RECENT > 0 && selectedTracks.length === REQUIRED_SONGS && !meetsRecentRequirement && (
            <p className="text-center text-sm text-blue-500">
              📅 You need at least {REQUIRED_RECENT} song{REQUIRED_RECENT > 1 ? 's' : ''} from {CURRENT_YEAR} (currently {recentSongCount})
            </p>
          )}
          {/* Chameleon requirement warning */}
          {CHAMELEON_MODE && selectedTracks.length === REQUIRED_SONGS && !hasChameleonSelected && (
            <p className="text-center text-sm text-purple-500">
              🦎 Mark one song as your chameleon pick (a song disguised as someone else&apos;s taste)
            </p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={
              selectedTracks.length !== REQUIRED_SONGS ||
              isSubmitting ||
              (CHAMELEON_MODE && !hasChameleonSelected) ||
              (REQUIRED_CHRISTMAS > 0 && !meetsChristmasRequirement) ||
              (REQUIRED_RECENT > 0 && !meetsRecentRequirement)
            }
            className="w-full h-14 text-lg"
            size="lg"
          >
            {isSubmitting
              ? 'Submitting...'
              : selectedTracks.length !== REQUIRED_SONGS
              ? `Select ${REQUIRED_SONGS - selectedTracks.length} more songs`
              : REQUIRED_CHRISTMAS > 0 && !meetsChristmasRequirement
              ? `Need ${REQUIRED_CHRISTMAS - christmasSongCount} more 🎄 Christmas songs`
              : REQUIRED_RECENT > 0 && !meetsRecentRequirement
              ? `Need ${REQUIRED_RECENT - recentSongCount} more 📅 ${CURRENT_YEAR} songs`
              : CHAMELEON_MODE && !hasChameleonSelected
              ? 'Mark a 🦎 chameleon pick to submit'
              : 'Submit Songs'}
          </Button>
        </div>
      </div>
    </main>
  )
}
