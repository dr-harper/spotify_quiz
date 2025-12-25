interface Song {
  track_id: string
  track_name: string
  artist_name: string
  participant_id?: string
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
 * Fisher-Yates shuffle algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Reorders songs to minimise consecutive tracks from the same participant.
 * Uses a greedy algorithm: pick from participants who haven't had a recent song.
 */
function spreadByParticipant(songs: Song[]): Song[] {
  if (songs.length <= 2 || !songs[0]?.participant_id) {
    return songs
  }

  // Group songs by participant
  const byParticipant = new Map<string, Song[]>()
  for (const song of songs) {
    const pid = song.participant_id || 'unknown'
    if (!byParticipant.has(pid)) {
      byParticipant.set(pid, [])
    }
    byParticipant.get(pid)!.push(song)
  }

  // Shuffle each participant's songs
  for (const [pid, participantSongs] of byParticipant) {
    byParticipant.set(pid, shuffleArray(participantSongs))
  }

  const result: Song[] = []
  let lastParticipant: string | null = null
  const participantIds = [...byParticipant.keys()]

  while (result.length < songs.length) {
    // Find participants with remaining songs, preferring those who weren't last
    const availableParticipants = participantIds.filter(
      pid => byParticipant.get(pid)!.length > 0
    )

    if (availableParticipants.length === 0) break

    // Prefer someone other than the last participant
    let nextParticipant = availableParticipants.find(pid => pid !== lastParticipant)

    // If only one participant left, use them
    if (!nextParticipant) {
      nextParticipant = availableParticipants[0]
    }

    const song = byParticipant.get(nextParticipant)!.shift()!
    result.push(song)
    lastParticipant = nextParticipant
  }

  return result
}

/**
 * Post-process Gemini's ordering to improve participant variety.
 * Swaps adjacent songs from the same participant when possible.
 */
function improveParticipantVariety(songs: Song[]): Song[] {
  if (songs.length <= 2 || !songs[0]?.participant_id) {
    return songs
  }

  const result = [...songs]

  // Make multiple passes to fix consecutive same-participant songs
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < result.length - 1; i++) {
      if (result[i].participant_id === result[i + 1].participant_id) {
        // Find a song to swap with (look ahead up to 5 positions)
        for (let j = i + 2; j < Math.min(i + 6, result.length); j++) {
          if (result[j].participant_id !== result[i].participant_id &&
              result[j].participant_id !== result[i + 1].participant_id) {
            // Check the swap won't create a new consecutive pair
            const prevOk = j === 0 || result[j - 1].participant_id !== result[i + 1].participant_id
            const nextOk = j === result.length - 1 || result[j + 1]?.participant_id !== result[i + 1].participant_id

            if (prevOk && nextOk) {
              // Swap
              ;[result[i + 1], result[j]] = [result[j], result[i + 1]]
              break
            }
          }
        }
      }
    }
  }

  return result
}

/**
 * Orders songs using Gemini AI for optimal energy progression.
 * Starts mellow, builds to high energy, then cools down.
 * Also ensures participant variety (no consecutive songs from same person where possible).
 * Falls back to shuffled order if Gemini fails.
 */
export async function orderSongsWithGemini(songs: Song[]): Promise<Song[]> {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    console.warn('GEMINI_API_KEY not set, using shuffled order with participant spread')
    return spreadByParticipant(songs)
  }

  if (songs.length <= 2) {
    return shuffleArray(songs)
  }

  try {
    // Build numbered song list for the prompt
    const songList = songs
      .map((song, i) => `${i + 1}. "${song.track_name}" by ${song.artist_name}`)
      .join('\n')

    const prompt = `You are a music curator creating a party playlist. Given this list of songs, reorder them for optimal energy progression:
- Start with mellow, calm, or slower tracks to ease people in
- Gradually build energy and tempo through the middle
- Peak with the highest energy tracks around 60-70% through
- Wind down with calmer tracks at the end

Here are the songs (numbered):
${songList}

Respond with ONLY the numbers in your recommended order, separated by commas. For example: 3, 1, 5, 2, 4

Your ordering:`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
      return spreadByParticipant(songs)
    }

    const data: GeminiResponse = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      console.error('No text in Gemini response')
      return spreadByParticipant(songs)
    }

    // Parse the response - extract numbers
    const numbers = text
      .split(/[,\s]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= 1 && n <= songs.length)

    // Validate we got all songs
    const uniqueNumbers = [...new Set(numbers)]
    if (uniqueNumbers.length !== songs.length) {
      console.warn('Gemini response missing some songs, using shuffled order')
      console.warn('Expected', songs.length, 'got', uniqueNumbers.length, 'unique:', uniqueNumbers)
      return spreadByParticipant(songs)
    }

    // Reorder based on Gemini's suggestion
    const reordered = uniqueNumbers.map(n => songs[n - 1])

    // Post-process to improve participant variety while preserving energy flow
    const finalOrder = improveParticipantVariety(reordered)

    console.log('Gemini reordered playlist successfully with participant variety')
    return finalOrder
  } catch (error) {
    console.error('Error calling Gemini:', error)
    return spreadByParticipant(songs)
  }
}
