import { NextRequest, NextResponse } from 'next/server'

interface TrackInput {
  name: string
  artist: string
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

interface ImagenResponse {
  predictions?: Array<{
    bytesBase64Encoded?: string
  }>
}

/**
 * Generates a playlist cover image using Gemini + Imagen.
 * 1. Gemini creates a funny mashup prompt from the track themes
 * 2. Imagen generates an illustrated cover image
 */
export async function POST(request: NextRequest) {
  try {
    const { tracks, playlistName } = await request.json() as {
      tracks: TrackInput[]
      playlistName?: string
    }

    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json({ error: 'No tracks provided' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not set, skipping cover generation')
      return NextResponse.json({ success: false, error: 'API key not configured' })
    }

    // Step 1: Generate funny image prompt from tracks using Gemini
    const trackList = tracks
      .slice(0, 30) // Include up to 30 tracks for more mashup potential
      .map(t => `"${t.name}" by ${t.artist}`)
      .join('\n')

    const geminiPrompt = `You are creating a funny illustrated album cover for a playlist.

Based on these songs, create a single surreal mashup scene:

${trackList}

Create ONE image prompt that:
- Picks 3-4 songs with the strongest visual potential and mashes them into ONE absurd, memorable scene
- Focus on quality over quantity - a few clever visual puns are better than cramming in references
- Uses illustrated/cartoon style with warm, vibrant colours
- Creates a single clear focal point with surprising combinations

CRITICAL: NO TEXT WHATSOEVER. No titles, no song names, no labels, no signs, no writing of any kind. AI image generators cannot render text properly. The image must tell its story purely through visuals.

Return ONLY the image generation prompt, nothing else. Keep it under 150 words.`

    // Call Gemini for prompt generation
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: geminiPrompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 200,
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', geminiResponse.status, errorText)
      return NextResponse.json({ success: false, error: 'Failed to generate image prompt' })
    }

    const geminiData: GeminiResponse = await geminiResponse.json()
    let imagePrompt = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (!imagePrompt) {
      console.error('No prompt generated from Gemini')
      // Fallback to generic festive prompt
      imagePrompt = 'Illustrated cartoon style: A cozy winter scene with friends gathered around a vintage record player, warm festive lights, vinyl records scattered around, joyful atmosphere, album cover art style'
    }

    // Prepend instruction to avoid text in the image
    imagePrompt = `No text, no words, no letters, no titles, no labels. ${imagePrompt}`

    console.log('Generated image prompt:', imagePrompt)

    // Step 2: Generate image using Imagen 4
    // Try imagen-4.0-generate-001 first, fall back to imagen-3.0-generate-002
    const imagenResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          instances: [{ prompt: imagePrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '1:1',
          },
        }),
      }
    )

    if (!imagenResponse.ok) {
      const errorText = await imagenResponse.text()
      console.error('Imagen API error:', imagenResponse.status, errorText)
      return NextResponse.json({
        success: false,
        error: 'Failed to generate image',
        prompt: imagePrompt // Return prompt for debugging
      })
    }

    const imagenData: ImagenResponse = await imagenResponse.json()
    const imageBase64 = imagenData.predictions?.[0]?.bytesBase64Encoded

    if (!imageBase64) {
      console.error('No image generated from Imagen')
      return NextResponse.json({
        success: false,
        error: 'No image in response',
        prompt: imagePrompt
      })
    }

    console.log('Successfully generated playlist cover image')

    return NextResponse.json({
      success: true,
      image: imageBase64,
      prompt: imagePrompt,
    })

  } catch (error) {
    console.error('Cover generation error:', error)
    return NextResponse.json({
      success: false,
      error: 'Cover generation failed'
    })
  }
}
