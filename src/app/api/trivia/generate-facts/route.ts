import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

    const prompt = `You are a music trivia expert creating multiple-choice questions. Generate 1 trivia question per song where you have confident knowledge.

ACCURACY RULES:
- Only include facts you are CERTAIN are true and widely documented
- A remix/collaboration is NOT a "cover" - only use "cover" for actual cover versions
- Skip songs you don't have reliable information about

GOOD QUESTION TYPES:
- film_appearance: Iconic film/TV placements (e.g. "Bohemian Rhapsody" in Wayne's World, "Tiny Dancer" in Almost Famous)
- award: Grammy wins, Brit Awards, or other major awards
- songwriter: Famous songwriters like Max Martin, Diane Warren, Burt Bacharach
- year: Release years or years songs reached #1
- cover: ONLY for famous covers where the original artist is well-known (e.g. "I Will Always Love You" originally by Dolly Parton)

AVOID:
- Obscure studio/recording facts
- Chart positions unless it was a definite #1 hit
- Anything you're not confident about

QUESTION FORMAT:
- Keep questions clear and concise
- Wrong answers should be plausible but clearly incorrect
- Include source (Wikipedia, Billboard, Grammy.com)

Songs:
${trackList}

Return ONLY valid JSON (no markdown). Example format:
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
  "3": []
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
      // Clean up potential markdown formatting and fix common JSON issues
      let cleanText = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      // Fix common Gemini JSON issues:
      // 1. Replace invalid escape sequences (e.g., \' which should be ')
      cleanText = cleanText.replace(/\\'/g, "'")
      // 2. Replace smart quotes with regular quotes
      cleanText = cleanText.replace(/[\u2018\u2019]/g, "'")
      cleanText = cleanText.replace(/[\u201C\u201D]/g, '"')

      factsMap = JSON.parse(cleanText)
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text.slice(0, 500))
      console.error('Parse error:', parseError)
      return NextResponse.json({ success: true, factsGenerated: 0, error: 'Parse error' })
    }

    // Validate and store the facts
    const supabase = createAdminClient()
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
      const { error: updateError, data: updateData } = await supabase
        .from('submissions')
        .update({ trivia_facts: validFacts })
        .eq('participant_id', participantId)
        .eq('track_id', tracks[i].id)
        .select('id')

      if (updateError) {
        console.error(`Failed to update facts for track ${tracks[i].id}:`, updateError)
      } else if (!updateData || updateData.length === 0) {
        console.warn(`No rows updated for track ${tracks[i].id} (participant: ${participantId}) - RLS may be blocking`)
      } else {
        console.log(`Updated ${updateData.length} submission(s) for track ${tracks[i].name}`)
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
