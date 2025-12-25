import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TriviaFact, TriviaFactType } from '@/types/database'

interface TrackInput {
  id: string
  name: string
  artist: string
  releaseYear?: number | null
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

interface RawTriviaFact {
  question_type: string
  question: string
  correct_answer: string
  wrong_answers: string[]
  source: string
}

// Valid question types
const VALID_QUESTION_TYPES: TriviaFactType[] = [
  'chart_position', 'film_appearance', 'award', 'songwriter',
  'cover', 'recording', 'collaboration', 'year'
]

/**
 * Generates trivia questions for a batch of tracks using Gemini AI.
 * Questions are stored with the submission for use in trivia rounds.
 */
export async function POST(request: NextRequest) {
  try {
    const { tracks, participantId } = await request.json() as {
      tracks: TrackInput[]
      participantId: string
    }

    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json({ error: 'No tracks provided' }, { status: 400 })
    }

    if (!participantId) {
      return NextResponse.json({ error: 'No participantId provided' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not set, skipping trivia generation')
      return NextResponse.json({ success: true, factsGenerated: 0 })
    }

    // Build the track list for the prompt
    const trackList = tracks
      .map((t, i) => `${i + 1}. "${t.name}" by ${t.artist}${t.releaseYear ? ` (${t.releaseYear})` : ''}`)
      .join('\n')

    const prompt = `You are a music trivia expert creating multiple-choice questions. For each song, generate 1-2 trivia questions with plausible wrong answers.

QUESTION TYPES (IMPORTANT - use variety, don't just pick chart_position!):
- film_appearance: "Which film/TV show featured X?" - PRIORITISE this if the song appeared in any film, TV show, advert, or trailer
- award: "What award did X win?" or "Which category did X win at the Grammys?" - use for award-winning songs
- songwriter: "Who wrote/co-wrote X?" - great for songs with famous songwriters (e.g. Max Martin, Diane Warren)
- cover: "Who famously covered X?" or "Which artist originally recorded X?" - use for songs with notable covers
- recording: "Where was X recorded?" or "Which producer worked on X?" - interesting studio facts
- collaboration: "Who featured on X?" or "Which artist did X collaborate with?" - for duets/features
- year: "In what year was X released?" or "In what year did X reach #1?" - milestone years
- chart_position: "What position did X reach?" - USE SPARINGLY, only for #1 hits or surprising positions

VARIETY RULES:
- Do NOT use chart_position for more than 30% of questions
- Prioritise film_appearance, award, songwriter, and cover questions - these are more interesting!
- If a song was in a famous film/TV show, ALWAYS ask about that instead of chart position

STRICT RULES:
- The correct answer MUST be 100% verifiable (cite Wikipedia, Billboard, Grammy.com)
- Wrong answers should be PLAUSIBLE but clearly wrong (same category - other films, other artists, other awards)
- Keep questions concise and fun
- If you can't make a good question for a song, return an empty array
- Make wrong answers believable - they should make players think!

Songs:
${trackList}

Return ONLY valid JSON (no markdown):
{
  "1": [
    {
      "question_type": "film_appearance",
      "question": "Which film featured 'Song Name'?",
      "correct_answer": "Love Actually",
      "wrong_answers": ["The Holiday", "Elf", "Home Alone"],
      "source": "Wikipedia"
    }
  ],
  "2": [],
  "3": [
    {
      "question_type": "cover",
      "question": "Who originally recorded 'Song Name' before Artist?",
      "correct_answer": "Original Artist",
      "wrong_answers": ["Wrong Artist 1", "Wrong Artist 2", "Wrong Artist 3"],
      "source": "Wikipedia"
    }
  ]
}`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3, // Slightly higher for creative wrong answers
            maxOutputTokens: 4096,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', response.status, errorText)
      return NextResponse.json({ success: true, factsGenerated: 0, error: 'API error' })
    }

    const data: GeminiResponse = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      console.error('No text in Gemini response')
      return NextResponse.json({ success: true, factsGenerated: 0 })
    }

    // Parse the JSON response
    let factsMap: Record<string, RawTriviaFact[]>
    try {
      // Clean up potential markdown formatting
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      factsMap = JSON.parse(cleanText)
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text.slice(0, 500))
      return NextResponse.json({ success: true, factsGenerated: 0, error: 'Parse error' })
    }

    // Validate and store the facts
    const supabase = await createClient()
    let factsGenerated = 0

    for (let i = 0; i < tracks.length; i++) {
      const trackIndex = String(i + 1)
      const rawFacts = factsMap[trackIndex]

      if (!rawFacts || !Array.isArray(rawFacts) || rawFacts.length === 0) {
        continue
      }

      // Validate each fact
      const validFacts: TriviaFact[] = rawFacts
        .filter(f => {
          if (!f.question || typeof f.question !== 'string') return false
          if (!f.correct_answer || typeof f.correct_answer !== 'string') return false
          if (!Array.isArray(f.wrong_answers) || f.wrong_answers.length !== 3) return false
          if (!f.source || typeof f.source !== 'string') return false
          if (!f.question_type || !VALID_QUESTION_TYPES.includes(f.question_type as TriviaFactType)) return false
          if (f.question.length > 200) return false // Reject overly long questions
          return true
        })
        .map(f => ({
          question_type: f.question_type as TriviaFactType,
          question: f.question.trim(),
          correct_answer: f.correct_answer.trim(),
          wrong_answers: f.wrong_answers.map(w => w.trim()) as [string, string, string],
          source: f.source.trim(),
        }))
        .slice(0, 2) // Max 2 questions per track

      if (validFacts.length === 0) continue

      // Update the submission with the facts
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ trivia_facts: validFacts })
        .eq('participant_id', participantId)
        .eq('track_id', tracks[i].id)

      if (updateError) {
        console.error(`Failed to update facts for track ${tracks[i].id}:`, updateError)
      } else {
        factsGenerated += validFacts.length
      }
    }

    console.log(`Generated ${factsGenerated} trivia questions for ${tracks.length} tracks`)
    return NextResponse.json({ success: true, factsGenerated })

  } catch (error) {
    console.error('Trivia generation error:', error)
    return NextResponse.json({ success: true, factsGenerated: 0, error: 'Generation failed' })
  }
}
