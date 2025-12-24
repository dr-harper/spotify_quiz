import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { orderSongsWithGemini, shuffleArray, spreadByParticipant } from '@/lib/gemini'

interface SubmissionWithEnergy {
  track_id: string
  track_name: string
  artist_name: string
  participant_id?: string
  popularity?: number
  duration_ms?: number
  release_date?: string
  energy_hint?: number
}

function parseYear(releaseDate?: string): number | null {
  if (!releaseDate) return null
  const [year] = releaseDate.split('-')
  const parsed = Number(year)
  return Number.isFinite(parsed) ? parsed : null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalize(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || max === min) return 0.5
  return clamp((value - min) / (max - min), 0, 1)
}

function computeEnergyHints(tracks: SubmissionWithEnergy[]): SubmissionWithEnergy[] {
  const durations = tracks
    .map(t => t.duration_ms)
    .filter((d): d is number => typeof d === 'number' && Number.isFinite(d))

  const years = tracks
    .map(t => parseYear(t.release_date))
    .filter((y): y is number => y !== null)

  const minDuration = durations.length ? Math.min(...durations) : 0
  const maxDuration = durations.length ? Math.max(...durations) : 1
  const minYear = years.length ? Math.min(...years) : new Date().getFullYear() - 20
  const maxYear = years.length ? Math.max(...years) : new Date().getFullYear()

  const popularityWeight = 0.5
  const durationWeight = 0.2
  const recencyWeight = 0.3

  return tracks.map(track => {
    const popularityScore = normalize(track.popularity ?? 50, 0, 100)
    const durationScore = 1 - normalize(track.duration_ms ?? minDuration, minDuration, maxDuration)
    const yearScore = normalize(parseYear(track.release_date) ?? minYear, minYear, maxYear)

    const energy =
      popularityScore * popularityWeight +
      durationScore * durationWeight +
      yearScore * recencyWeight

    return { ...track, energy_hint: clamp(energy, 0, 1) }
  })
}

function createEnergyCurve(tracks: SubmissionWithEnergy[]): SubmissionWithEnergy[] {
  if (tracks.length <= 3) return tracks

  const sorted = [...tracks].sort((a, b) => (a.energy_hint ?? 0) - (b.energy_hint ?? 0))

  const lowCount = Math.max(1, Math.round(sorted.length * 0.25))
  const midCount = Math.max(1, Math.round(sorted.length * 0.25))
  const peakCount = Math.max(1, Math.round(sorted.length * 0.2))
  const adjustedPeakCount = Math.min(peakCount, sorted.length - (lowCount + midCount))

  const lowSegment = sorted.splice(0, lowCount)
  const midSegment = sorted.splice(0, midCount)
  const peakSegment = sorted.splice(-adjustedPeakCount)
  const cooldownSegment = sorted.sort((a, b) => (b.energy_hint ?? 0) - (a.energy_hint ?? 0))

  return [...lowSegment, ...midSegment, ...peakSegment, ...cooldownSegment]
}

async function fetchTrackMetadata(trackIds: string[], spotifyToken: string) {
  const metadataMap = new Map<string, { popularity?: number; duration_ms?: number; release_date?: string }>()

  for (let i = 0; i < trackIds.length; i += 50) {
    const batch = trackIds.slice(i, i + 50)
    try {
      const response = await fetch(`https://api.spotify.com/v1/tracks?ids=${batch.join(',')}`, {
        headers: { Authorization: `Bearer ${spotifyToken}` },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to fetch track metadata from Spotify:', response.status, errorText)
        continue
      }

      const { tracks } = await response.json()
      for (const track of tracks) {
        if (!track?.id) continue
        metadataMap.set(track.id, {
          popularity: track.popularity,
          duration_ms: track.duration_ms,
          release_date: track.album?.release_date,
        })
      }
    } catch (error) {
      console.error('Error fetching track metadata batch:', error)
    }
  }

  return metadataMap
}

export async function POST(request: NextRequest) {
  try {
    const { roomId, playlistName } = await request.json()

    if (!roomId) {
      return NextResponse.json({ error: 'Missing roomId' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get user's Spotify token from session
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.provider_token) {
      return NextResponse.json({
        error: 'No Spotify token available. Please log out and log back in to grant playlist permissions.'
      }, { status: 401 })
    }

    const spotifyToken = session.provider_token

    // Get Spotify user ID from the /me endpoint
    const meResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${spotifyToken}` },
    })

    if (!meResponse.ok) {
      const meError = await meResponse.text()
      console.error('Failed to get Spotify user:', meError)
      return NextResponse.json({
        error: 'Failed to get Spotify user. Please log out and log back in.'
      }, { status: 401 })
    }

    const meData = await meResponse.json()
    const userId = meData.id

    if (!userId) {
      return NextResponse.json({ error: 'Could not get Spotify user ID' }, { status: 400 })
    }

    // Get all submissions for this room
    const { data: participants } = await supabase
      .from('participants')
      .select('id')
      .eq('room_id', roomId)

    if (!participants || participants.length === 0) {
      return NextResponse.json({ error: 'No participants found' }, { status: 404 })
    }

    const participantIds = participants.map(p => p.id)

    const { data: submissions } = await supabase
      .from('submissions')
      .select('track_id, track_name, artist_name, participant_id')
      .in('participant_id', participantIds)

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({ error: 'No submissions found' }, { status: 404 })
    }

    let orderedSubmissions: SubmissionWithEnergy[] = []
    let metadataFailed = false

    try {
      const metadata = await fetchTrackMetadata(submissions.map(s => s.track_id), spotifyToken)

      if (metadata.size === 0) {
        metadataFailed = true
        console.warn('No metadata returned for submitted tracks, using participant-balanced shuffle')
      } else {
        const withMetadata: SubmissionWithEnergy[] = submissions.map(submission => ({
          ...submission,
          ...metadata.get(submission.track_id),
        }))

        const withEnergy = computeEnergyHints(withMetadata)
        const energyCurve = createEnergyCurve(withEnergy)
        const seededOrder = spreadByParticipant(energyCurve)

        // Use Gemini AI to order songs for optimal energy progression
        // Also ensures player variety (no consecutive songs from same person)
        orderedSubmissions = await orderSongsWithGemini(seededOrder)
      }
    } catch (error) {
      metadataFailed = true
      console.error('Failed to fetch metadata for playlist ordering:', error)
    }

    if (metadataFailed && orderedSubmissions.length === 0) {
      const seededShuffle = spreadByParticipant(shuffleArray(submissions))
      orderedSubmissions = await orderSongsWithGemini(seededShuffle)
    }

    // Create playlist
    const createResponse = await fetch(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${spotifyToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: playlistName || 'Festive Frequencies Quiz',
          description: `Songs from our Festive Frequencies game! ${orderedSubmissions.length} tracks picked by friends, ordered by AI for optimal energy flow.`,
          public: false,
        }),
      }
    )

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error('Failed to create playlist:', createResponse.status, errorText)

      // Check for specific errors
      if (createResponse.status === 401 || createResponse.status === 403) {
        return NextResponse.json({
          error: 'Spotify permissions denied. Please log out and log back in to grant playlist permissions.'
        }, { status: 401 })
      }

      return NextResponse.json({ error: 'Failed to create playlist on Spotify' }, { status: 500 })
    }

    const playlist = await createResponse.json()

    // Add tracks to playlist in AI-optimised order
    const trackUris = orderedSubmissions.map(s => `spotify:track:${s.track_id}`)

    // Spotify allows max 100 tracks per request
    for (let i = 0; i < trackUris.length; i += 100) {
      const batch = trackUris.slice(i, i + 100)
      await fetch(
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${spotifyToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uris: batch }),
        }
      )
    }

    return NextResponse.json({
      success: true,
      playlistUrl: playlist.external_urls.spotify,
      playlistId: playlist.id,
      trackCount: orderedSubmissions.length,
    })
  } catch (error) {
    console.error('Playlist creation error:', error)
    return NextResponse.json({ error: 'Failed to create playlist' }, { status: 500 })
  }
}
