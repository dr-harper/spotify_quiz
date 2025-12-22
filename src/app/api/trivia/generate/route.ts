import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TriviaCategory } from '@/types/database'

interface TrackData {
  id: string
  name: string
  artist: string
  albumName: string | null
  releaseYear: number | null
  durationMs: number | null
  popularity: number | null
  tempo: number | null
  valence: number | null
  danceability: number | null
  energy: number | null
}

interface GeneratedQuestion {
  question_type: 'data' | 'ai'
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

// Generate data-driven questions
function generateDataQuestions(tracks: TrackData[]): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = []

  // Need at least 4 tracks for comparison questions
  if (tracks.length < 4) return questions

  // 1. Artist Match - "Who sang this song?"
  const trackForArtist = shuffle(tracks)[0]
  const otherArtists = shuffle(tracks.filter(t => t.artist !== trackForArtist.artist))
    .slice(0, 3)
    .map(t => t.artist)
  if (otherArtists.length === 3) {
    const artistOptions = shuffle([trackForArtist.artist, ...otherArtists]) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'artist',
      question_text: `Who sang "${trackForArtist.name}"?`,
      options: artistOptions,
      correct_index: artistOptions.indexOf(trackForArtist.artist),
      explanation: `"${trackForArtist.name}" was performed by ${trackForArtist.artist}`,
      related_track_id: trackForArtist.id,
    })
  }

  // 2. Oldest Song - "Which song was released first?"
  const tracksWithYear = tracks.filter(t => t.releaseYear)
  if (tracksWithYear.length >= 4) {
    const selected = shuffle(tracksWithYear).slice(0, 4)
    const sorted = [...selected].sort((a, b) => (a.releaseYear || 0) - (b.releaseYear || 0))
    const oldest = sorted[0]
    const options = selected.map(t => `${t.name} - ${t.artist}`) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'year',
      question_text: 'Which of these songs was released first?',
      options,
      correct_index: selected.findIndex(t => t.id === oldest.id),
      explanation: `"${oldest.name}" was released in ${oldest.releaseYear}`,
      related_track_id: oldest.id,
    })
  }

  // 3. Newest Song - "Which song is the most recent?"
  if (tracksWithYear.length >= 4) {
    const selected = shuffle(tracksWithYear).slice(0, 4)
    const sorted = [...selected].sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0))
    const newest = sorted[0]
    const options = selected.map(t => `${t.name} - ${t.artist}`) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'year',
      question_text: 'Which of these songs is the most recent release?',
      options,
      correct_index: selected.findIndex(t => t.id === newest.id),
      explanation: `"${newest.name}" was released in ${newest.releaseYear}`,
      related_track_id: newest.id,
    })
  }

  // 4. Fastest Tempo - "Which song has the fastest beat?"
  const tracksWithTempo = tracks.filter(t => t.tempo)
  if (tracksWithTempo.length >= 4) {
    const selected = shuffle(tracksWithTempo).slice(0, 4)
    const sorted = [...selected].sort((a, b) => (b.tempo || 0) - (a.tempo || 0))
    const fastest = sorted[0]
    const options = selected.map(t => `${t.name} - ${t.artist}`) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'tempo',
      question_text: 'Which of these songs has the fastest beat?',
      options,
      correct_index: selected.findIndex(t => t.id === fastest.id),
      explanation: `"${fastest.name}" has a tempo of ${Math.round(fastest.tempo || 0)} BPM`,
      related_track_id: fastest.id,
    })
  }

  // 5. Longest Track - "Which song is the longest?"
  const tracksWithDuration = tracks.filter(t => t.durationMs)
  if (tracksWithDuration.length >= 4) {
    const selected = shuffle(tracksWithDuration).slice(0, 4)
    const sorted = [...selected].sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0))
    const longest = sorted[0]
    const options = selected.map(t => `${t.name} - ${t.artist}`) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'duration',
      question_text: 'Which of these songs is the longest?',
      options,
      correct_index: selected.findIndex(t => t.id === longest.id),
      explanation: `"${longest.name}" is ${formatDuration(longest.durationMs || 0)} long`,
      related_track_id: longest.id,
    })
  }

  // 6. Most Popular - "Which is most streamed on Spotify?"
  const tracksWithPopularity = tracks.filter(t => t.popularity !== null)
  if (tracksWithPopularity.length >= 4) {
    const selected = shuffle(tracksWithPopularity).slice(0, 4)
    const sorted = [...selected].sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    const mostPopular = sorted[0]
    const options = selected.map(t => `${t.name} - ${t.artist}`) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'popularity',
      question_text: 'Which of these songs is currently most popular on Spotify?',
      options,
      correct_index: selected.findIndex(t => t.id === mostPopular.id),
      explanation: `"${mostPopular.name}" has a Spotify popularity score of ${mostPopular.popularity}/100`,
      related_track_id: mostPopular.id,
    })
  }

  // 7. Happiest Song - "Which sounds most cheerful?" (valence)
  const tracksWithValence = tracks.filter(t => t.valence !== null)
  if (tracksWithValence.length >= 4) {
    const selected = shuffle(tracksWithValence).slice(0, 4)
    const sorted = [...selected].sort((a, b) => (b.valence || 0) - (a.valence || 0))
    const happiest = sorted[0]
    const options = selected.map(t => `${t.name} - ${t.artist}`) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'mood',
      question_text: 'According to Spotify, which song sounds the most cheerful?',
      options,
      correct_index: selected.findIndex(t => t.id === happiest.id),
      explanation: `"${happiest.name}" has the highest 'happiness' score`,
      related_track_id: happiest.id,
    })
  }

  // 8. Most Danceable - "Which is most danceable?"
  const tracksWithDance = tracks.filter(t => t.danceability !== null)
  if (tracksWithDance.length >= 4) {
    const selected = shuffle(tracksWithDance).slice(0, 4)
    const sorted = [...selected].sort((a, b) => (b.danceability || 0) - (a.danceability || 0))
    const mostDanceable = sorted[0]
    const options = selected.map(t => `${t.name} - ${t.artist}`) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'mood',
      question_text: 'Which song would get you dancing the most?',
      options,
      correct_index: selected.findIndex(t => t.id === mostDanceable.id),
      explanation: `"${mostDanceable.name}" has the highest danceability score`,
      related_track_id: mostDanceable.id,
    })
  }

  // 9. Most Energetic
  const tracksWithEnergy = tracks.filter(t => t.energy !== null)
  if (tracksWithEnergy.length >= 4) {
    const selected = shuffle(tracksWithEnergy).slice(0, 4)
    const sorted = [...selected].sort((a, b) => (b.energy || 0) - (a.energy || 0))
    const mostEnergetic = sorted[0]
    const options = selected.map(t => `${t.name} - ${t.artist}`) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'mood',
      question_text: 'Which of these songs has the highest energy?',
      options,
      correct_index: selected.findIndex(t => t.id === mostEnergetic.id),
      explanation: `"${mostEnergetic.name}" is the most energetic track`,
      related_track_id: mostEnergetic.id,
    })
  }

  // 10. Release Decade
  if (tracksWithYear.length >= 1) {
    const track = shuffle(tracksWithYear)[0]
    const correctDecade = Math.floor((track.releaseYear || 2000) / 10) * 10
    const decades = shuffle([correctDecade, correctDecade - 10, correctDecade + 10, correctDecade - 20])
      .map(d => `${d}s`) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'year',
      question_text: `What decade was "${track.name}" first released?`,
      options: decades,
      correct_index: decades.indexOf(`${correctDecade}s`),
      explanation: `"${track.name}" was released in ${track.releaseYear}`,
      related_track_id: track.id,
    })
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

    // Fetch all submissions for this room with track metadata
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
        tempo,
        valence,
        danceability,
        energy,
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
      tempo: sub.tempo,
      valence: sub.valence,
      danceability: sub.danceability,
      energy: sub.energy,
    }))

    // Generate data-driven questions only (no AI - it makes up facts!)
    const dataQuestions = generateDataQuestions(tracks)

    // Shuffle the questions
    const allQuestions = shuffle(dataQuestions)

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
      totalAvailable: dataQuestions.length,
    })

  } catch (error) {
    console.error('Trivia generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
