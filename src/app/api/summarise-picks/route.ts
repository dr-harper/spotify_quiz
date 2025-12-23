import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface TrackInfo {
  name: string
  artist: string
  albumName: string | null
  releaseYear: number | null
  isChristmas: boolean
}

// Fallback mood tags for when AI isn't available
const FALLBACK_MOODS = [
  'Playlist Pro', 'Vibe Curator', 'Tune Hunter', 'Music Maven',
  'Beat Explorer', 'Sound Seeker', 'Rhythm Wizard', 'Song Sage'
]

export async function POST(request: NextRequest) {
  try {
    const { tracks, playerName } = await request.json() as { tracks: TrackInfo[]; playerName: string }

    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json({ error: 'No tracks provided' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      const randomMood = FALLBACK_MOODS[Math.floor(Math.random() * FALLBACK_MOODS.length)]
      return NextResponse.json({
        summary: "Great selection! Your friends will have fun guessing these.",
        moodTag: randomMood,
        fallback: true,
      })
    }

    const genAI = new GoogleGenerativeAI(apiKey)

    // Try different model names in order of preference
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
      const randomMood = FALLBACK_MOODS[Math.floor(Math.random() * FALLBACK_MOODS.length)]
      return NextResponse.json({
        summary: "Looking good! Your picks are ready to puzzle your friends.",
        moodTag: randomMood,
        fallback: true,
      })
    }

    const christmasCount = tracks.filter(t => t.isChristmas).length
    const trackList = tracks.map((t, i) =>
      `${i + 1}. "${t.name}" by ${t.artist}${t.releaseYear ? ` (${t.releaseYear})` : ''}${t.isChristmas ? ' [Christmas]' : ''}`
    ).join('\n')

    const prompt = `You're a witty music commentator for a party game where friends guess who picked each song.

Player: ${playerName}
${christmasCount > 0 ? `(They marked ${christmasCount} as Christmas songs)` : ''}

Their picks:
${trackList}

Respond with EXACTLY this format (no markdown, no extra text):
SUMMARY: [A brief, playful 1-2 sentence summary. Be fun and cheeky but kind. Reference specific songs or patterns. Under 40 words.]
MOOD: [A fun two-word mood descriptor like "Indie Dreamer", "Pop Royalty", "Retro Soul", "Emo Classic", "Dance Floor", "Sad Banger", etc. Be creative and playful!]`

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text().trim()

    // Parse the response
    const summaryMatch = text.match(/SUMMARY:\s*(.+?)(?:\n|MOOD:|$)/)
    const moodMatch = text.match(/MOOD:\s*(.+?)$/m)

    const summary = summaryMatch ? summaryMatch[1].trim() : text
    const moodTag = moodMatch ? moodMatch[1].trim().replace(/['"]/g, '') : 'Music Lover'

    return NextResponse.json({ summary, moodTag })

  } catch (error) {
    console.error('Summary generation error:', error)
    const randomMood = FALLBACK_MOODS[Math.floor(Math.random() * FALLBACK_MOODS.length)]
    return NextResponse.json({
      summary: "Interesting choices! Let's see if your friends can figure out your taste.",
      moodTag: randomMood,
      fallback: true,
    })
  }
}
