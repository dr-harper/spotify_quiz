import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { orderSongsWithGemini } from '@/lib/gemini'
import sharp from 'sharp'

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

    // Get room details (name and AI summary)
    const { data: room } = await supabase
      .from('rooms')
      .select('name, room_code, playlist_summary')
      .eq('id', roomId)
      .single()

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

    // Use Gemini AI to order songs for optimal energy progression
    // Also ensures player variety (no consecutive songs from same person)
    const orderedSubmissions = await orderSongsWithGemini(submissions)

    // Build playlist name and description
    const finalPlaylistName = room?.name
      ? `Festive Frequencies - ${room.name}`
      : playlistName || 'Festive Frequencies Quiz'

    const finalDescription = room?.playlist_summary
      || `Songs from our Festive Frequencies game! ${orderedSubmissions.length} tracks picked by friends, ordered by AI for optimal energy flow.`

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
          name: finalPlaylistName,
          description: finalDescription,
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

    // Generate and upload custom cover image
    let coverGenerated = false
    let coverImage: string | null = null
    try {
      const coverResponse = await fetch(new URL('/api/spotify/generate-cover', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracks: orderedSubmissions.map(s => ({
            name: s.track_name,
            artist: s.artist_name,
          })),
          playlistName: room?.name || 'Festive Frequencies',
        }),
      })

      const coverData = await coverResponse.json()

      if (coverData.success && coverData.image) {
        coverImage = coverData.image // Save for response (PNG)

        // Convert PNG to JPEG for Spotify (Spotify only accepts JPEG, max 256KB)
        const pngBuffer = Buffer.from(coverData.image, 'base64')
        let jpegBuffer = await sharp(pngBuffer)
          .resize(640, 640) // Resize to reduce file size
          .jpeg({ quality: 75 })
          .toBuffer()

        // If still too large, reduce quality further
        if (jpegBuffer.length > 256 * 1024) {
          jpegBuffer = await sharp(pngBuffer)
            .resize(500, 500)
            .jpeg({ quality: 60 })
            .toBuffer()
        }

        const jpegBase64 = jpegBuffer.toString('base64')
        console.log(`Cover image size: ${Math.round(jpegBase64.length / 1024)}KB (limit: 256KB)`)

        // Upload cover to Spotify
        const uploadResponse = await fetch(
          `https://api.spotify.com/v1/playlists/${playlist.id}/images`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${spotifyToken}`,
              'Content-Type': 'image/jpeg',
            },
            body: jpegBase64,
          }
        )

        if (uploadResponse.ok) {
          console.log('Successfully uploaded custom playlist cover')
          coverGenerated = true
        } else {
          const errorText = await uploadResponse.text()
          console.warn('Failed to upload cover to Spotify:', uploadResponse.status, errorText)
        }
      }
    } catch (coverError) {
      console.warn('Cover generation failed:', coverError)
      // Continue without custom cover - Spotify will use default
    }

    return NextResponse.json({
      success: true,
      playlistUrl: playlist.external_urls.spotify,
      playlistId: playlist.id,
      trackCount: orderedSubmissions.length,
      coverGenerated,
      coverImage, // Return the cover image for display in the app
    })
  } catch (error) {
    console.error('Playlist creation error:', error)
    return NextResponse.json({ error: 'Failed to create playlist' }, { status: 500 })
  }
}
