import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface TrackInfo {
  name: string
  artist: string
  albumName: string | null
  releaseYear: number | null
  isChristmas: boolean
}

export async function POST(request: NextRequest) {
  try {
    const { tracks, playerName } = await request.json() as { tracks: TrackInfo[]; playerName: string }

    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json({ error: 'No tracks provided' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        summary: "Great selection! Your friends will have fun guessing these.",
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
      return NextResponse.json({
        summary: "Looking good! Your picks are ready to puzzle your friends.",
        fallback: true,
      })
    }

    const christmasCount = tracks.filter(t => t.isChristmas).length
    const trackList = tracks.map((t, i) =>
      `${i + 1}. "${t.name}" by ${t.artist}${t.releaseYear ? ` (${t.releaseYear})` : ''}${t.isChristmas ? ' [Christmas]' : ''}`
    ).join('\n')

    const prompt = `You're a witty music commentator for a party game where friends guess who picked each song.
Write a brief, playful 1-2 sentence summary of this player's song selections. Be fun and cheeky but not mean.
Reference specific songs or patterns you notice. Keep it under 40 words.

Player: ${playerName}
${christmasCount > 0 ? `(They marked ${christmasCount} as Christmas songs)` : ''}

Their picks:
${trackList}

Write just the summary, no quotes or formatting. Be conversational and fun.`

    const result = await model.generateContent(prompt)
    const response = result.response
    const summary = response.text().trim()

    return NextResponse.json({ summary })

  } catch (error) {
    console.error('Summary generation error:', error)
    return NextResponse.json({
      summary: "Interesting choices! Let's see if your friends can figure out your taste.",
      fallback: true,
    })
  }
}
