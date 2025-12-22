import { NextRequest, NextResponse } from 'next/server'
import spotifyPreviewFinder from 'spotify-preview-finder'
import type { Track, AudioFeatures } from '@/types/database'

// Cache the access token for fetching album art
let accessToken: string | null = null
let tokenExpiry: number = 0

// Christmas-related keywords for heuristic detection
const CHRISTMAS_KEYWORDS = [
  'christmas', 'xmas', 'holiday', 'santa', 'jingle', 'noel', 'noël',
  'mistletoe', 'rudolph', 'reindeer', 'sleigh', 'snowman', 'frosty',
  'winter wonderland', 'silent night', 'deck the halls', 'holy night',
  'feliz navidad', 'jingle bells', 'white christmas', 'last christmas',
  'carol', 'merry', 'bethlehem', 'nativity', 'yuletide', 'festive',
  'nutcracker', 'drummer boy', 'silver bells', 'let it snow',
  'rockin around', 'chestnuts', 'holly', 'ivy', 'angel', 'shepherd'
]

function detectChristmasKeywords(trackName: string, albumName: string): string[] {
  const combined = `${trackName} ${albumName}`.toLowerCase()
  return CHRISTMAS_KEYWORDS.filter(keyword => combined.includes(keyword))
}

async function getSpotifyAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  })

  const data = await response.json()
  accessToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 300) * 1000
  return accessToken!
}

// Fetch audio features for multiple tracks
async function fetchAudioFeatures(
  trackIds: string[],
  token: string
): Promise<Map<string, AudioFeatures>> {
  const featuresMap = new Map<string, AudioFeatures>()

  if (trackIds.length === 0) return featuresMap

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/audio-features?ids=${trackIds.join(',')}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const data = await response.json()

    if (data.audio_features) {
      for (const feature of data.audio_features) {
        if (feature) {
          featuresMap.set(feature.id, {
            tempo: feature.tempo,
            key: feature.key,
            mode: feature.mode,
            timeSignature: feature.time_signature,
            danceability: feature.danceability,
            energy: feature.energy,
            valence: feature.valence,
            acousticness: feature.acousticness,
            instrumentalness: feature.instrumentalness,
            speechiness: feature.speechiness,
            liveness: feature.liveness,
            loudness: feature.loudness,
          })
        }
      }
    }
  } catch (error) {
    console.error('Error fetching audio features:', error)
  }

  return featuresMap
}

// Spotify track details type
interface SpotifyTrackDetails {
  id: string
  name: string
  artists: { name: string }[]
  album: {
    name: string
    images: { url: string }[]
    release_date: string
    release_date_precision: string
  }
  duration_ms: number
  popularity: number
  explicit: boolean
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Missing search query' }, { status: 400 })
  }

  try {
    // Use spotify-preview-finder which scrapes preview URLs from web pages
    const result = await spotifyPreviewFinder(query)

    if (!result.success || !result.results) {
      return NextResponse.json({ tracks: [] })
    }

    const tracksWithPreviews = result.results
      .filter((track: { previewUrls?: string[] }) => track.previewUrls && track.previewUrls.length > 0)

    if (tracksWithPreviews.length === 0) {
      return NextResponse.json({ tracks: [] })
    }

    // Fetch full track details from Spotify API
    const token = await getSpotifyAccessToken()
    const trackIds = tracksWithPreviews.map((t: { trackId: string }) => t.trackId)
    const trackIdsString = trackIds.join(',')

    // Fetch track details and audio features in parallel
    const [spotifyResponse, audioFeaturesMap] = await Promise.all([
      fetch(
        `https://api.spotify.com/v1/tracks?ids=${trackIdsString}`,
        { headers: { Authorization: `Bearer ${token}` } }
      ),
      fetchAudioFeatures(trackIds, token)
    ])

    const spotifyData = await spotifyResponse.json()

    // Build detailed track info map
    const trackDetailsMap = new Map<string, SpotifyTrackDetails>()
    if (spotifyData.tracks) {
      for (const track of spotifyData.tracks) {
        if (track) {
          trackDetailsMap.set(track.id, track)
        }
      }
    }

    // Build enriched tracks
    const tracks: Track[] = tracksWithPreviews.map((track: {
      name: string
      trackId: string
      previewUrls: string[]
      albumName: string
    }) => {
      const details = trackDetailsMap.get(track.trackId)
      const audioFeatures = audioFeaturesMap.get(track.trackId) || null

      const albumName = details?.album?.name || track.albumName || ''
      const releaseDate = details?.album?.release_date || null
      const releaseYear = releaseDate ? parseInt(releaseDate.substring(0, 4), 10) : null

      // Detect Christmas keywords
      const christmasKeywordMatches = detectChristmasKeywords(track.name, albumName)
      const isLikelyChristmas = christmasKeywordMatches.length > 0

      return {
        id: track.trackId,
        name: track.name,
        artist: details?.artists?.map(a => a.name).join(', ') || '',
        albumName,
        albumArt: details?.album?.images?.[0]?.url || null,
        releaseDate,
        releaseYear,
        durationMs: details?.duration_ms || null,
        popularity: details?.popularity || null,
        explicit: details?.explicit || false,
        previewUrl: track.previewUrls[0],
        hasPreview: true,
        audioFeatures,
        isLikelyChristmas,
        christmasKeywordMatches,
      }
    })

    console.log(`Search "${query}": found ${tracks.length} tracks with previews`)

    return NextResponse.json({ tracks })
  } catch (error) {
    console.error('Spotify search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
