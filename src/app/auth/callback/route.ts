import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const roomCode = searchParams.get('room')

  const supabase = await createClient()

  // Exchange OAuth code for session (Spotify login)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(`${origin}/auth/auth-code-error`)
    }
  }

  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  // If joining a room, add user as participant and redirect to room
  if (roomCode) {
    const upperRoomCode = roomCode.toUpperCase()

    // Look up the room
    const { data: room } = await supabase
      .from('rooms')
      .select('id, status')
      .eq('room_code', upperRoomCode)
      .single()

    if (room) {
      // Check if user is already a participant
      const { data: existingParticipant } = await supabase
        .from('participants')
        .select('id')
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .single()

      if (!existingParticipant) {
        // Get user metadata for participant creation
        const userMeta = user.user_metadata
        const displayName = userMeta?.full_name || userMeta?.name || user.email?.split('@')[0] || 'Guest'
        const avatarUrl = userMeta?.avatar_url || userMeta?.picture || null
        const spotifyId = userMeta?.provider_id || userMeta?.sub || user.id

        // Add user as participant
        await supabase.from('participants').insert({
          room_id: room.id,
          user_id: user.id,
          spotify_id: spotifyId,
          display_name: displayName,
          avatar_url: avatarUrl,
          is_host: false,
        })
      }

      // Redirect to the room
      return redirectTo(request, origin, `/room/${upperRoomCode}`)
    }
    // Room not found - still redirect to it, room page will show error
    return redirectTo(request, origin, `/room/${upperRoomCode}`)
  }

  // Default: redirect to lobby
  return redirectTo(request, origin, '/lobby')
}

// Helper to handle redirect with forwarded host
function redirectTo(request: Request, origin: string, path: string): NextResponse {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'

  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${path}`)
  } else if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${path}`)
  } else {
    return NextResponse.redirect(`${origin}${path}`)
  }
}
