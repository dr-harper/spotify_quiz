import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TriviaCategory, TriviaFact, TriviaFactType } from '@/types/database'

interface TrackData {
  id: string
  name: string
  artist: string
  albumName: string | null
  releaseYear: number | null
  durationMs: number | null
  popularity: number | null
  triviaFacts: TriviaFact[] | null
}

interface GeneratedQuestion {
  question_type: 'data' | 'fact'
  category: TriviaCategory
  question_text: string
  options: [string, string, string, string]
  correct_index: number
  explanation: string | null
  related_track_id: string | null
}

// Shuffle array helper
function shuffle<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Format duration for display
function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Strip artist name from track name (handles "Song - Artist" format)
function stripArtistFromName(trackName: string): string {
  // Common patterns: "Song - Artist", "Song (feat. X) - Artist"
  // Split on " - " and take everything before the last occurrence
  const parts = trackName.split(' - ')
  if (parts.length > 1) {
    // Check if the last part looks like an artist (not a subtitle like "Remastered 2009")
    const lastPart = parts[parts.length - 1]
    // If it contains common non-artist indicators, keep it
    if (lastPart.match(/remaster|version|edit|mix|remix|live|acoustic|demo|radio|extended|original/i)) {
      return trackName
    }
    // Otherwise, remove the last part (likely the artist)
    return parts.slice(0, -1).join(' - ')
  }
  return trackName
}

// Generate data-driven questions
function generateDataQuestions(tracks: TrackData[]): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = []

  // Need at least 4 tracks for comparison questions
  if (tracks.length < 4) return questions

  // 1. Artist Match - "Who sang this song?"
  // Get unique artists to ensure we have 4 different options
  const uniqueArtists = [...new Set(tracks.map(t => t.artist))]
  if (uniqueArtists.length >= 4) {
    const trackForArtist = shuffle(tracks)[0]
    // Get 3 OTHER unique artists (not the correct one)
    const otherArtists = shuffle(uniqueArtists.filter(a => a !== trackForArtist.artist)).slice(0, 3)

    if (otherArtists.length === 3) {
      const artistOptions = shuffle([trackForArtist.artist, ...otherArtists]) as [string, string, string, string]
      const songNameOnly = stripArtistFromName(trackForArtist.name)
      questions.push({
        question_type: 'data',
        category: 'artist',
        question_text: `Who performed "${songNameOnly}"?`,
        options: artistOptions,
        correct_index: artistOptions.indexOf(trackForArtist.artist),
        explanation: `"${songNameOnly}" was performed by ${trackForArtist.artist}`,
        related_track_id: trackForArtist.id,
      })
    }
  }

  // 1b. Second artist question with different wording
  if (uniqueArtists.length >= 4) {
    const availableTracks = shuffle(tracks)
    const trackForArtist2 = availableTracks[1] || availableTracks[0]
    const otherArtists2 = shuffle(uniqueArtists.filter(a => a !== trackForArtist2.artist)).slice(0, 3)

    if (otherArtists2.length === 3) {
      const artistOptions2 = shuffle([trackForArtist2.artist, ...otherArtists2]) as [string, string, string, string]
      const songName2 = stripArtistFromName(trackForArtist2.name)
      questions.push({
        question_type: 'data',
        category: 'artist',
        question_text: `Which artist recorded "${songName2}"?`,
        options: artistOptions2,
        correct_index: artistOptions2.indexOf(trackForArtist2.artist),
        explanation: `"${songName2}" was recorded by ${trackForArtist2.artist}`,
        related_track_id: trackForArtist2.id,
      })
    }
  }

  // 2. Oldest Song - "Which song was released first?"
  const tracksWithYear = tracks.filter(t => t.releaseYear)
  if (tracksWithYear.length >= 4) {
    const selected = shuffle(tracksWithYear).slice(0, 4)
    const sorted = [...selected].sort((a, b) => (a.releaseYear || 0) - (b.releaseYear || 0))
    const oldest = sorted[0]
    const options = selected.map(t => stripArtistFromName(t.name)) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'year',
      question_text: 'Which of these songs was released first?',
      options,
      correct_index: selected.findIndex(t => t.id === oldest.id),
      explanation: `"${stripArtistFromName(oldest.name)}" by ${oldest.artist} was released in ${oldest.releaseYear}`,
      related_track_id: oldest.id,
    })
  }

  // 3. Newest Song - "Which song is the most recent?"
  if (tracksWithYear.length >= 4) {
    const selected = shuffle(tracksWithYear).slice(0, 4)
    const sorted = [...selected].sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0))
    const newest = sorted[0]
    const options = selected.map(t => stripArtistFromName(t.name)) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'year',
      question_text: 'Which of these songs is the most recent release?',
      options,
      correct_index: selected.findIndex(t => t.id === newest.id),
      explanation: `"${stripArtistFromName(newest.name)}" by ${newest.artist} was released in ${newest.releaseYear}`,
      related_track_id: newest.id,
    })
  }

  // 4. Longest Track - "Which song is the longest?"
  const tracksWithDuration = tracks.filter(t => t.durationMs)
  if (tracksWithDuration.length >= 4) {
    const selected = shuffle(tracksWithDuration).slice(0, 4)
    const sorted = [...selected].sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0))
    const longest = sorted[0]
    const options = selected.map(t => stripArtistFromName(t.name)) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'duration',
      question_text: 'Which of these songs is the longest?',
      options,
      correct_index: selected.findIndex(t => t.id === longest.id),
      explanation: `"${stripArtistFromName(longest.name)}" by ${longest.artist} is ${formatDuration(longest.durationMs || 0)} long`,
      related_track_id: longest.id,
    })
  }

  // 6. Most Popular - "Which is most streamed on Spotify?"
  const tracksWithPopularity = tracks.filter(t => t.popularity !== null)
  if (tracksWithPopularity.length >= 4) {
    const selected = shuffle(tracksWithPopularity).slice(0, 4)
    const sorted = [...selected].sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    const mostPopular = sorted[0]
    const options = selected.map(t => stripArtistFromName(t.name)) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'popularity',
      question_text: 'Which of these songs is currently most popular on Spotify?',
      options,
      correct_index: selected.findIndex(t => t.id === mostPopular.id),
      explanation: `"${stripArtistFromName(mostPopular.name)}" by ${mostPopular.artist} has a Spotify popularity score of ${mostPopular.popularity}/100`,
      related_track_id: mostPopular.id,
    })
  }

  // 7. Release Decade
  if (tracksWithYear.length >= 1) {
    const track = shuffle(tracksWithYear)[0]
    const songName = stripArtistFromName(track.name)
    const correctDecade = Math.floor((track.releaseYear || 2000) / 10) * 10
    const decades = shuffle([correctDecade, correctDecade - 10, correctDecade + 10, correctDecade - 20])
      .map(d => `${d}s`) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'year',
      question_text: `What decade was "${songName}" first released?`,
      options: decades,
      correct_index: decades.indexOf(`${correctDecade}s`),
      explanation: `"${songName}" by ${track.artist} was released in ${track.releaseYear}`,
      related_track_id: track.id,
    })
  }

  // 8. Match song to artist (reverse of artist question)
  if (uniqueArtists.length >= 4) {
    const artistForSong = shuffle(tracks)[0]
    // Get songs from different artists
    const otherSongs = shuffle(tracks.filter(t => t.artist !== artistForSong.artist))
      .slice(0, 3)
    if (otherSongs.length === 3) {
      // Only show song names (stripped of artist)
      const correctSongName = stripArtistFromName(artistForSong.name)
      const songOptions = shuffle([correctSongName, ...otherSongs.map(t => stripArtistFromName(t.name))]) as [string, string, string, string]
      questions.push({
        question_type: 'data',
        category: 'artist',
        question_text: `Which of these songs was performed by ${artistForSong.artist}?`,
        options: songOptions,
        correct_index: songOptions.indexOf(correctSongName),
        explanation: `${artistForSong.artist} performed "${correctSongName}"`,
        related_track_id: artistForSong.id,
      })
    }
  }

  // 9. Shortest track
  if (tracksWithDuration.length >= 4) {
    const selected = shuffle(tracksWithDuration).slice(0, 4)
    const sorted = [...selected].sort((a, b) => (a.durationMs || 0) - (b.durationMs || 0))
    const shortest = sorted[0]
    const options = selected.map(t => stripArtistFromName(t.name)) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'duration',
      question_text: 'Which of these songs is the shortest?',
      options,
      correct_index: selected.findIndex(t => t.id === shortest.id),
      explanation: `"${stripArtistFromName(shortest.name)}" by ${shortest.artist} is ${formatDuration(shortest.durationMs || 0)} long`,
      related_track_id: shortest.id,
    })
  }

  return questions
}

// Map TriviaFactType to TriviaCategory for database storage
function mapFactTypeToCategory(factType: TriviaFactType): TriviaCategory {
  switch (factType) {
    case 'film_appearance':
    case 'award':
    case 'songwriter':
    case 'cover':
    case 'recording':
    case 'collaboration':
      return 'fact'
    case 'chart_position':
      return 'popularity'
    case 'year':
      return 'year'
    default:
      return 'fact'
  }
}

// Generate fact-based questions from AI-generated trivia questions
function generateFactQuestions(tracks: TrackData[]): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = []

  // Get tracks with trivia facts
  const tracksWithFacts = tracks.filter(t => t.triviaFacts && t.triviaFacts.length > 0)

  if (tracksWithFacts.length === 0) return questions

  // Convert each AI-generated question into a proper trivia question
  for (const track of tracksWithFacts) {
    if (!track.triviaFacts) continue

    for (const fact of track.triviaFacts) {
      // New format: fact has question, correct_answer, and wrong_answers
      if (!fact.question || !fact.correct_answer || !fact.wrong_answers) {
        continue // Skip malformed facts
      }

      // Shuffle correct answer with wrong answers
      const allOptions = shuffle([
        fact.correct_answer,
        ...fact.wrong_answers
      ]) as [string, string, string, string]

      const correctIndex = allOptions.indexOf(fact.correct_answer)

      questions.push({
        question_type: 'fact',
        category: mapFactTypeToCategory(fact.question_type),
        question_text: fact.question,
        options: allOptions,
        correct_index: correctIndex,
        explanation: `${fact.correct_answer} (Source: ${fact.source})`,
        related_track_id: track.id,
      })
    }
  }

  return questions
}

export async function POST(request: NextRequest) {
  try {
    const { roomId, questionCount = 10 } = await request.json()

    if (!roomId) {
      return NextResponse.json({ error: 'Missing roomId' }, { status: 400 })
    }

    const supabase = await createClient()

    // Check if questions already exist for this room
    const { data: existingQuestions } = await supabase
      .from('trivia_questions')
      .select('id')
      .eq('room_id', roomId)
      .limit(1)

    if (existingQuestions && existingQuestions.length > 0) {
      return NextResponse.json({
        message: 'Questions already generated',
        count: existingQuestions.length,
      })
    }

    // Fetch all submissions for this room with track metadata and trivia facts
    const { data: submissions, error: subError } = await supabase
      .from('submissions')
      .select(`
        track_id,
        track_name,
        artist_name,
        album_name,
        release_year,
        duration_ms,
        popularity,
        trivia_facts,
        participants!inner(room_id)
      `)
      .eq('participants.room_id', roomId)

    if (subError || !submissions || submissions.length === 0) {
      return NextResponse.json({ error: 'No submissions found' }, { status: 400 })
    }

    // Map submissions to track data for trivia generation
    const tracks: TrackData[] = submissions.map(sub => ({
      id: sub.track_id,
      name: sub.track_name,
      artist: sub.artist_name,
      albumName: sub.album_name,
      releaseYear: sub.release_year,
      durationMs: sub.duration_ms,
      popularity: sub.popularity,
      triviaFacts: sub.trivia_facts as TriviaFact[] | null,
    }))

    // Generate data-driven questions
    const dataQuestions = generateDataQuestions(tracks)

    // Generate fact-based questions from AI-generated facts
    const factQuestions = generateFactQuestions(tracks)

    // Combine and shuffle all questions (mix data and fact questions)
    const allQuestions = shuffle([...dataQuestions, ...factQuestions])

    // Take the required number
    const selectedQuestions = allQuestions.slice(0, questionCount)

    // If we don't have enough questions, that's okay - we'll work with what we have
    if (selectedQuestions.length === 0) {
      return NextResponse.json({ error: 'Could not generate any questions' }, { status: 500 })
    }

    // Insert questions into database
    const questionsToInsert = selectedQuestions.map((q, index) => ({
      room_id: roomId,
      question_number: index + 1,
      question_type: q.question_type,
      category: q.category,
      question_text: q.question_text,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation,
      related_track_id: q.related_track_id,
    }))

    const { error: insertError } = await supabase
      .from('trivia_questions')
      .insert(questionsToInsert)

    if (insertError) {
      console.error('Failed to insert questions:', insertError)
      return NextResponse.json({ error: 'Failed to save questions' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: selectedQuestions.length,
      dataQuestions: dataQuestions.length,
      factQuestions: factQuestions.length,
      totalAvailable: allQuestions.length,
    })

  } catch (error) {
    console.error('Trivia generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
