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
}

interface GeneratedQuestion {
  question_type: 'data'
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
  // Get unique artists to ensure we have 4 different options
  const uniqueArtists = [...new Set(tracks.map(t => t.artist))]
  if (uniqueArtists.length >= 4) {
    const trackForArtist = shuffle(tracks)[0]
    // Get 3 OTHER unique artists (not the correct one)
    const otherArtists = shuffle(uniqueArtists.filter(a => a !== trackForArtist.artist)).slice(0, 3)

    if (otherArtists.length === 3) {
      const artistOptions = shuffle([trackForArtist.artist, ...otherArtists]) as [string, string, string, string]
      // Only use the song name - never include artist in the question
      const songNameOnly = trackForArtist.name
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
      questions.push({
        question_type: 'data',
        category: 'artist',
        question_text: `Which artist recorded "${trackForArtist2.name}"?`,
        options: artistOptions2,
        correct_index: artistOptions2.indexOf(trackForArtist2.artist),
        explanation: `"${trackForArtist2.name}" was recorded by ${trackForArtist2.artist}`,
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

  // 4. Longest Track - "Which song is the longest?"
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

  // 7. Release Decade
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

  // 8. Match song to artist (reverse of artist question)
  if (uniqueArtists.length >= 4) {
    const artistForSong = shuffle(tracks)[0]
    // Get songs from different artists
    const otherSongs = shuffle(tracks.filter(t => t.artist !== artistForSong.artist))
      .slice(0, 3)
    if (otherSongs.length === 3) {
      // Only show song names, not "Song - Artist"
      const songOptions = shuffle([artistForSong.name, ...otherSongs.map(t => t.name)]) as [string, string, string, string]
      questions.push({
        question_type: 'data',
        category: 'artist',
        question_text: `Which of these songs was performed by ${artistForSong.artist}?`,
        options: songOptions,
        correct_index: songOptions.indexOf(artistForSong.name),
        explanation: `${artistForSong.artist} performed "${artistForSong.name}"`,
        related_track_id: artistForSong.id,
      })
    }
  }

  // 9. Shortest track
  if (tracksWithDuration.length >= 4) {
    const selected = shuffle(tracksWithDuration).slice(0, 4)
    const sorted = [...selected].sort((a, b) => (a.durationMs || 0) - (b.durationMs || 0))
    const shortest = sorted[0]
    const options = selected.map(t => t.name) as [string, string, string, string]
    questions.push({
      question_type: 'data',
      category: 'duration',
      question_text: 'Which of these songs is the shortest?',
      options,
      correct_index: selected.findIndex(t => t.id === shortest.id),
      explanation: `"${shortest.name}" is ${formatDuration(shortest.durationMs || 0)} long`,
      related_track_id: shortest.id,
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
    // Note: Audio features (tempo, danceability, energy, valence) are no longer available
    // as Spotify deprecated the audio-features endpoint
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
