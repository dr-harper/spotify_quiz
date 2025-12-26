import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface WinnerSummaryRequest {
  winner: {
    displayName: string
    songChoices: Array<{
      trackName: string
      artistName: string
    }>
  }
  scoreBreakdown: {
    part1Correct: number
    part2Correct: number
    triviaScore: number
    favouriteVotes: number
    chameleonPoints: number
    awardPoints: number
    totalScore: number
  }
  competition: {
    totalPlayers: number
    runnerUpScore: number
    marginOfVictory: number
    wasCloseRace: boolean
  }
  highlights: {
    mostVotedSong?: string
    anyAwardsWon: string[]
  }
}

// Fallback narrative when AI isn't available
const FALLBACK_NARRATIVE = [
  "Our champion navigated the musical maze with impressive skill, demonstrating a keen ear for their friends' tastes...",
  "Through rounds of intense guessing and surprising reveals, they proved their musical intuition is second to none...",
  "In a game where everyone brought their A-game, one player rose above the rest with consistent excellence...",
  "And now, the moment you've all been waiting for... let's reveal your winner!"
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as WinnerSummaryRequest
    const { winner, scoreBreakdown, competition, highlights } = body

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        narrative: FALLBACK_NARRATIVE,
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
        narrative: FALLBACK_NARRATIVE,
        fallback: true,
      })
    }

    // Build context about the winner
    const songList = winner.songChoices.map(s =>
      `"${s.trackName}" by ${s.artistName}`
    ).join(', ')

    const totalCorrectGuesses = scoreBreakdown.part1Correct + scoreBreakdown.part2Correct
    const marginDescription = competition.wasCloseRace
      ? `a nail-biting ${competition.marginOfVictory} point margin`
      : `a commanding ${competition.marginOfVictory} point lead`

    const awardsText = highlights.anyAwardsWon.length > 0
      ? `Awards won: ${highlights.anyAwardsWon.join(', ')}`
      : 'No bonus awards'

    const mostVotedText = highlights.mostVotedSong
      ? `Their song "${highlights.mostVotedSong}" was a crowd favourite!`
      : ''

    // Describe the journey arc
    let journeyArc = ''
    if (scoreBreakdown.part1Correct > scoreBreakdown.part2Correct) {
      journeyArc = 'Started explosively in Part 1 and maintained their lead'
    } else if (scoreBreakdown.part2Correct > scoreBreakdown.part1Correct) {
      journeyArc = 'Found their rhythm in Part 2, surging ahead when it mattered most'
    } else {
      journeyArc = 'Stayed consistently brilliant throughout both rounds'
    }

    const prompt = `You're a dramatic sports commentator building up to the winner reveal of a music quiz game where friends guess who picked each song.

CRITICAL RULES:
- Do NOT mention the winner's name or any identifying information
- Refer to them as "our champion", "this musical mastermind", "our mystery victor", "the one who conquered tonight", etc.
- Tell a STORY with narrative tension, not just stats
- Look for themes, patterns, or amusing observations in their song choices

WINNER'S JOURNEY:
- Their songs: ${songList}
- ${journeyArc}
- Correctly identified ${totalCorrectGuesses} songs (${scoreBreakdown.part1Correct} in Part 1, ${scoreBreakdown.part2Correct} in Part 2)
- Trivia performance: ${scoreBreakdown.triviaScore} points
- ${mostVotedText}
- ${awardsText}
- Final score: ${scoreBreakdown.totalScore} points

THE COMPETITION:
- Competed against ${competition.totalPlayers - 1} other player${competition.totalPlayers > 2 ? 's' : ''}
- Victory margin: ${marginDescription}
${competition.wasCloseRace ? '- It came down to the wire!' : '- A dominant performance!'}

Write EXACTLY 4 paragraphs (each 50-70 words). Build dramatic tension like a sports finale!

Format EXACTLY like this (no markdown):
PARA1: [Their music taste - find themes, patterns, or amusing observations in their song choices. What does this eclectic/focused/quirky selection reveal about their personality? Make it fun and specific.]
PARA2: [The journey - tell the story of their game. How did they perform across the rounds? Build narrative tension. Did they dominate from the start or surge at the end? Mention specific achievements like trivia prowess or awards.]
PARA3: [The competition - paint the picture of the battle. Was it a nail-biter or a masterclass? How did they compare to rivals? Use dramatic sports commentary language.]
PARA4: [The reveal tease - build maximum anticipation! End with a tantalising question or statement that leaves everyone desperate to know who this mystery champion is. Make it a proper cliffhanger!]`

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text().trim()

    // Parse the response
    const para1Match = text.match(/PARA1:\s*([\s\S]+?)(?:\n|PARA2:|$)/)
    const para2Match = text.match(/PARA2:\s*([\s\S]+?)(?:\n|PARA3:|$)/)
    const para3Match = text.match(/PARA3:\s*([\s\S]+?)(?:\n|PARA4:|$)/)
    const para4Match = text.match(/PARA4:\s*([\s\S]+?)$/)

    const narrative = [
      para1Match ? para1Match[1].trim() : FALLBACK_NARRATIVE[0],
      para2Match ? para2Match[1].trim() : FALLBACK_NARRATIVE[1],
      para3Match ? para3Match[1].trim() : FALLBACK_NARRATIVE[2],
      para4Match ? para4Match[1].trim() : FALLBACK_NARRATIVE[3],
    ]

    return NextResponse.json({ narrative, fallback: false })

  } catch (error) {
    console.error('Winner summary generation error:', error)
    return NextResponse.json({
      narrative: FALLBACK_NARRATIVE,
      fallback: true,
    })
  }
}
