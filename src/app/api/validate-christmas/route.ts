import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface TrackToValidate {
  id: string
  name: string
  artist: string
  albumName: string | null
  releaseYear: number | null
}

interface ValidationResult {
  trackId: string
  isChristmasSong: boolean
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

export async function POST(request: NextRequest) {
  try {
    const { tracks } = await request.json() as { tracks: TrackToValidate[] }

    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json({ error: 'No tracks provided' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured')
      // Fall back to keyword-based validation if Gemini isn't configured
      return NextResponse.json({
        results: tracks.map(track => ({
          trackId: track.id,
          isChristmasSong: false,
          confidence: 'low' as const,
          reason: 'AI validation unavailable - using keyword matching only',
        })),
        fallback: true,
      })
    }

    const genAI = new GoogleGenerativeAI(apiKey)

    // Try different model names in order of preference
    const modelNames = ['gemini-2.0-flash-exp', 'gemini-1.5-flash-latest', 'gemini-pro']
    let model = null
    let lastError = null

    for (const modelName of modelNames) {
      try {
        model = genAI.getGenerativeModel({ model: modelName })
        // Test if model works by attempting to use it
        break
      } catch (e) {
        lastError = e
        console.log(`Model ${modelName} not available, trying next...`)
      }
    }

    if (!model) {
      console.error('No Gemini models available:', lastError)
      return NextResponse.json({
        results: tracks.map(track => ({
          trackId: track.id,
          isChristmasSong: false,
          confidence: 'low' as const,
          reason: 'AI validation unavailable',
        })),
        fallback: true,
      })
    }

    // Build the prompt with all tracks
    const trackList = tracks.map((t, i) =>
      `${i + 1}. "${t.name}" by ${t.artist}${t.albumName ? ` (Album: ${t.albumName})` : ''}${t.releaseYear ? ` [${t.releaseYear}]` : ''}`
    ).join('\n')

    const prompt = `You are a music expert helping to verify Christmas songs for a holiday music quiz game.

For each song below, determine if it is a Christmas/holiday song. Consider:
- Songs explicitly about Christmas, winter holidays, Santa, etc.
- Traditional Christmas carols and hymns
- Modern Christmas pop songs
- Winter-themed songs that are commonly associated with Christmas
- Songs from Christmas albums or movies

Be generous - if a song is commonly played during the Christmas season or has festive themes, count it.

Songs to evaluate:
${trackList}

Respond with a JSON array (no markdown formatting, just raw JSON) with exactly ${tracks.length} objects in the same order as the input:
[
  {
    "index": 1,
    "isChristmasSong": true/false,
    "confidence": "high"/"medium"/"low",
    "reason": "brief explanation"
  },
  ...
]

Only output the JSON array, nothing else.`

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text().trim()

    // Parse the JSON response
    let parsed: Array<{
      index: number
      isChristmasSong: boolean
      confidence: 'high' | 'medium' | 'low'
      reason: string
    }>

    try {
      // Remove any markdown code block formatting if present
      const jsonText = text.replace(/```json\n?|\n?```/g, '').trim()
      parsed = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text)
      return NextResponse.json({
        error: 'Failed to parse AI response',
        rawResponse: text,
      }, { status: 500 })
    }

    // Map results back to track IDs
    const results: ValidationResult[] = tracks.map((track, index) => {
      const geminiResult = parsed.find(p => p.index === index + 1) || parsed[index]
      return {
        trackId: track.id,
        isChristmasSong: geminiResult?.isChristmasSong ?? false,
        confidence: geminiResult?.confidence ?? 'low',
        reason: geminiResult?.reason ?? 'Could not validate',
      }
    })

    return NextResponse.json({ results })

  } catch (error) {
    console.error('Christmas validation error:', error)
    return NextResponse.json(
      { error: 'Validation failed', details: String(error) },
      { status: 500 }
    )
  }
}
