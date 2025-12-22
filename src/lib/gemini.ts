interface Song {
  track_id: string
  track_name: string
  artist_name: string
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

/**
 * Orders songs using Gemini AI for optimal energy progression.
 * Starts mellow, builds to high energy, then cools down.
 * Falls back to original order if Gemini fails.
 */
export async function orderSongsWithGemini(songs: Song[]): Promise<Song[]> {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    console.warn('GEMINI_API_KEY not set, using original order')
    return songs
  }

  if (songs.length <= 2) {
    // Not worth reordering very short playlists
    return songs
  }

  try {
    // Build numbered song list for the prompt
    const songList = songs
      .map((song, i) => `${i + 1}. "${song.track_name}" by ${song.artist_name}`)
      .join('\n')

    const prompt = `You are a music curator. Given this playlist of songs, reorder them for optimal energy progression:
- Start with mellow, calm, or slower tracks
- Gradually build energy and tempo through the middle
- Peak with the highest energy tracks around 60-70% through
- Wind down with calmer tracks at the end

Here are the songs (numbered):
${songList}

Respond with ONLY the numbers in your recommended order, separated by commas. For example: 3, 1, 5, 2, 4

Your ordering:`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 256,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', response.status, errorText)
      return songs
    }

    const data: GeminiResponse = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      console.error('No text in Gemini response')
      return songs
    }

    // Parse the response - extract numbers
    const numbers = text
      .split(/[,\s]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= 1 && n <= songs.length)

    // Validate we got all songs
    const uniqueNumbers = [...new Set(numbers)]
    if (uniqueNumbers.length !== songs.length) {
      console.warn('Gemini response missing some songs, using original order')
      console.warn('Expected', songs.length, 'got', uniqueNumbers.length, 'unique:', uniqueNumbers)
      return songs
    }

    // Reorder based on Gemini's suggestion
    const reordered = uniqueNumbers.map(n => songs[n - 1])
    console.log('Gemini reordered playlist successfully')
    return reordered
  } catch (error) {
    console.error('Error calling Gemini:', error)
    return songs
  }
}
