import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import type { PlaylistSummary } from '@/types/database'

// Fallback summaries when AI isn't available
const FALLBACK_VIBES = [
  'Eclectic Party Mix',
  'Crowd Pleasers',
  'Musical Melting Pot',
  'Diverse Tastes Unite',
]

const FALLBACK_FUN_FACTS = [
  "Everyone brought their A-game to this playlist!",
  "There's something for everyone in this mix.",
  "This group knows how to pick a tune!",
]

export async function POST(request: NextRequest) {
  try {
    const { roomId } = await request.json() as { roomId: string }

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Fetch all submissions with participant info
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select(`
        track_name,
        artist_name,
        album_name,
        release_year,
        participants!inner(display_name, room_id)
      `)
      .eq('participants.room_id', roomId)

    if (submissionsError) {
      console.error('Failed to fetch submissions:', submissionsError)
      return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 })
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({ error: 'No submissions found' }, { status: 404 })
    }

    // Group songs by player
    const songsByPlayer: Record<string, string[]> = {}
    const allSongs: string[] = []
    const artistCounts: Record<string, number> = {}
    const decadeCounts: Record<string, number> = {}

    for (const sub of submissions) {
      const participant = sub.participants as unknown as { display_name: string }
      const playerName = participant.display_name
      const songInfo = `"${sub.track_name}" by ${sub.artist_name}`

      if (!songsByPlayer[playerName]) {
        songsByPlayer[playerName] = []
      }
      songsByPlayer[playerName].push(songInfo)
      allSongs.push(songInfo)

      // Count artists
      artistCounts[sub.artist_name] = (artistCounts[sub.artist_name] || 0) + 1

      // Count decades
      if (sub.release_year) {
        const decade = `${Math.floor(sub.release_year / 10) * 10}s`
        decadeCounts[decade] = (decadeCounts[decade] || 0) + 1
      }
    }

    const playerCount = Object.keys(songsByPlayer).length
    const totalSongs = allSongs.length

    // Find most popular artist
    const topArtist = Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])[0]

    // Find most popular decade
    const topDecade = Object.entries(decadeCounts)
      .sort((a, b) => b[1] - a[1])[0]

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      // Return fallback summary
      const summary: PlaylistSummary = {
        description: `A fantastic playlist with ${totalSongs} songs from ${playerCount} players. Get ready to guess who picked what!`,
        vibe: FALLBACK_VIBES[Math.floor(Math.random() * FALLBACK_VIBES.length)],
        funFacts: FALLBACK_FUN_FACTS,
        generatedAt: new Date().toISOString(),
      }
      return NextResponse.json({ summary, fallback: true })
    }

    const genAI = new GoogleGenerativeAI(apiKey)

    // Try different model names
    const modelNames = ['gemini-2.0-flash-exp', 'gemini-1.5-flash-latest', 'gemini-pro']
    let model = null

    for (const modelName of modelNames) {
      try {
        model = genAI.getGenerativeModel({ model: modelName })
        break
      } catch {
        console.log(`Model ${modelName} not available, trying next...`)
      }
    }

    if (!model) {
      const summary: PlaylistSummary = {
        description: `${totalSongs} tracks from ${playerCount} music lovers - this is going to be a great game!`,
        vibe: FALLBACK_VIBES[Math.floor(Math.random() * FALLBACK_VIBES.length)],
        funFacts: FALLBACK_FUN_FACTS,
        generatedAt: new Date().toISOString(),
      }
      return NextResponse.json({ summary, fallback: true })
    }

    // Build the prompt - anonymous list of songs (no player names!)
    const allSongsList = allSongs.map((s, i) => `${i + 1}. ${s}`).join('\n')

    const prompt = `You're a witty music commentator for a party quiz game where players guess who picked each song. Analyse this playlist and create a fun summary.

IMPORTANT: Keep it ANONYMOUS - do NOT mention or hint at who picked which songs. The summary should describe the overall playlist, not individual picks.

PLAYLIST (${totalSongs} songs from ${playerCount} players):
${allSongsList}

Stats:
- Most picked artist: ${topArtist ? `${topArtist[0]} (${topArtist[1]} picks)` : 'Various'}
- Most popular decade: ${topDecade ? `${topDecade[0]} (${topDecade[1]} songs)` : 'Mixed'}

Respond with EXACTLY this format (no markdown, no extra formatting):
DESCRIPTION: [2-3 sentences capturing the overall vibe and patterns of the WHOLE playlist. Be playful and fun! Do NOT mention specific players. Under 60 words.]
VIBE: [A catchy 2-4 word vibe tag like "Nostalgic Christmas Party", "Indie Meets Pop", "Dance Floor Royalty", "Throwback Central", etc.]
FUN_FACT_1: [A fun observation about the playlist as a whole - genres, decades, patterns. Do NOT reveal who picked what. One sentence.]
FUN_FACT_2: [Another fun observation, different angle. Keep it anonymous. One sentence.]
FUN_FACT_3: [A third observation, maybe playfully teasing the group's collective taste. One sentence.]`

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text().trim()

    // Parse the response
    const descMatch = text.match(/DESCRIPTION:\s*([\s\S]+?)(?:\n|VIBE:|$)/)
    const vibeMatch = text.match(/VIBE:\s*([\s\S]+?)(?:\n|FUN_FACT|$)/)
    const fact1Match = text.match(/FUN_FACT_1:\s*([\s\S]+?)(?:\n|FUN_FACT_2|$)/)
    const fact2Match = text.match(/FUN_FACT_2:\s*([\s\S]+?)(?:\n|FUN_FACT_3|$)/)
    const fact3Match = text.match(/FUN_FACT_3:\s*([\s\S]+?)$/)

    const description = descMatch ? descMatch[1].trim() : `A great mix of ${totalSongs} songs from ${playerCount} players!`
    const vibe = vibeMatch ? vibeMatch[1].trim().replace(/['"]/g, '') : 'Party Mix'
    const funFacts = [
      fact1Match ? fact1Match[1].trim() : null,
      fact2Match ? fact2Match[1].trim() : null,
      fact3Match ? fact3Match[1].trim() : null,
    ].filter(Boolean) as string[]

    const summary: PlaylistSummary = {
      description,
      vibe,
      funFacts: funFacts.length > 0 ? funFacts : FALLBACK_FUN_FACTS,
      generatedAt: new Date().toISOString(),
    }

    // Save to the room
    const { error: updateError } = await supabase
      .from('rooms')
      .update({ playlist_summary: summary })
      .eq('id', roomId)

    if (updateError) {
      console.error('Failed to save playlist summary:', updateError)
      // Still return the summary even if save failed
    }

    return NextResponse.json({ summary })

  } catch (error) {
    console.error('Playlist summary generation error:', error)
    const summary: PlaylistSummary = {
      description: "An exciting mix of songs from all players - let the guessing begin!",
      vibe: FALLBACK_VIBES[Math.floor(Math.random() * FALLBACK_VIBES.length)],
      funFacts: FALLBACK_FUN_FACTS,
      generatedAt: new Date().toISOString(),
    }
    return NextResponse.json({ summary, fallback: true })
  }
}
