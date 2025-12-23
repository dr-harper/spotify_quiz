import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const TEST_ROOM_CODE = 'TEST01'

const MOCK_PLAYERS = [
  { name: 'Bob', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob' },
  { name: 'Charlie', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie' },
  { name: 'Diana', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Diana' },
]

const SAMPLE_SONGS = [
  { name: 'All I Want for Christmas Is You', artist: 'Mariah Carey' },
  { name: 'Last Christmas', artist: 'Wham!' },
  { name: 'Jingle Bell Rock', artist: 'Bobby Helms' },
  { name: "Rockin' Around the Christmas Tree", artist: 'Brenda Lee' },
  { name: 'Let It Snow!', artist: 'Dean Martin' },
  { name: 'Santa Tell Me', artist: 'Ariana Grande' },
  { name: 'Snowman', artist: 'Sia' },
  { name: 'Underneath the Tree', artist: 'Kelly Clarkson' },
  { name: 'White Christmas', artist: 'Bing Crosby' },
  { name: "It's Beginning to Look Like Christmas", artist: 'Michael Bublé' },
]

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    // Clean up existing test room
    const { data: existingRoom } = await supabase
      .from('rooms')
      .select('id')
      .eq('room_code', TEST_ROOM_CODE)
      .single()

    if (existingRoom) {
      const { data: participants } = await supabase
        .from('participants')
        .select('id')
        .eq('room_id', existingRoom.id)

      if (participants && participants.length > 0) {
        const participantIds = participants.map(p => p.id)
        await supabase.from('quiz_rounds').delete().eq('room_id', existingRoom.id)
        await supabase.from('submissions').delete().in('participant_id', participantIds)
        await supabase.from('participants').delete().eq('room_id', existingRoom.id)
      }
      await supabase.from('rooms').delete().eq('id', existingRoom.id)
    }

    // Create room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        room_code: TEST_ROOM_CODE,
        host_id: user.id,
        name: 'Test Room',
        status: 'RESULTS',
      })
      .select()
      .single()

    if (roomError) throw roomError

    // Create real participant (current user)
    const userMeta = user.user_metadata
    const displayName = userMeta?.full_name || userMeta?.name || user.email?.split('@')[0] || 'Player'

    const { data: realParticipant, error: realParticipantError } = await supabase
      .from('participants')
      .insert({
        room_id: room.id,
        user_id: user.id,
        spotify_id: userMeta?.provider_id || user.id,
        display_name: displayName,
        avatar_url: userMeta?.avatar_url || userMeta?.picture || null,
        score: 0,
        is_host: true,
        has_submitted: true,
      })
      .select()
      .single()

    if (realParticipantError) throw realParticipantError

    // Try to create mock participants with null user_id
    // This requires the migration in supabase/migrations/allow_test_participants.sql
    const allParticipants: typeof realParticipant[] = [realParticipant]

    for (const mockPlayer of MOCK_PLAYERS) {
      const { data: mockP, error: mockError } = await supabase
        .from('participants')
        .insert({
          room_id: room.id,
          user_id: null, // Test participant - requires migration
          spotify_id: `mock_${mockPlayer.name.toLowerCase()}`,
          display_name: mockPlayer.name,
          avatar_url: mockPlayer.avatar,
          score: 0,
          is_host: false,
          has_submitted: true,
        })
        .select()
        .single()

      if (!mockError && mockP) {
        allParticipants.push(mockP)
      }
    }

    const isMultiPlayer = allParticipants.length > 1

    // Create submissions (10 songs per participant)
    const allSubmissions: {
      participant_id: string
      track_id: string
      track_name: string
      artist_name: string
      album_art_url: string
      preview_url: string
      submission_order: number
    }[] = []
    for (const participant of allParticipants) {
      const shuffledSongs = [...SAMPLE_SONGS].sort(() => Math.random() - 0.5)
      for (let i = 0; i < 10; i++) {
        const song = shuffledSongs[i]
        allSubmissions.push({
          participant_id: participant.id,
          track_id: `test_${participant.id}_${i}`,
          track_name: song.name,
          artist_name: song.artist,
          album_art_url: `https://picsum.photos/seed/${song.name.replace(/\s/g, '')}${i}/300/300`,
          preview_url: 'https://p.scdn.co/mp3-preview/sample',
          submission_order: i + 1,
        })
      }
    }

    const { data: insertedSubmissions, error: submissionsError } = await supabase
      .from('submissions')
      .insert(allSubmissions)
      .select()

    if (submissionsError) throw submissionsError

    // Create quiz rounds (one per submission, shuffled)
    const shuffledSubmissions = [...insertedSubmissions].sort(() => Math.random() - 0.5)
    const rounds = shuffledSubmissions.map((sub, i) => ({
      room_id: room.id,
      submission_id: sub.id,
      round_number: i + 1,
    }))

    const { data: insertedRounds, error: roundsError } = await supabase
      .from('quiz_rounds')
      .insert(rounds)
      .select()

    if (roundsError) throw roundsError

    // Create votes with realistic distribution
    const votes: {
      round_id: string
      voter_id: string
      guessed_participant_id: string
      is_correct: boolean
      points_awarded: number
    }[] = []
    const scores: { [id: string]: number } = {}
    allParticipants.forEach(p => { scores[p.id] = 0 })

    for (const round of insertedRounds) {
      const submission = insertedSubmissions.find(s => s.id === round.submission_id)!
      const correctParticipantId = submission.participant_id

      for (const voter of allParticipants) {
        // 40-60% chance of correct guess
        const guessCorrectly = Math.random() < 0.5
        const guessedId = guessCorrectly
          ? correctParticipantId
          : allParticipants[Math.floor(Math.random() * allParticipants.length)].id

        const isCorrect = guessedId === correctParticipantId
        if (isCorrect) scores[voter.id] += 100

        votes.push({
          round_id: round.id,
          voter_id: voter.id,
          guessed_participant_id: guessedId,
          is_correct: isCorrect,
          points_awarded: isCorrect ? 100 : 0,
        })
      }
    }

    await supabase.from('votes').insert(votes)

    // Update final scores
    for (const participant of allParticipants) {
      await supabase
        .from('participants')
        .update({ score: scores[participant.id] })
        .eq('id', participant.id)
    }

    return NextResponse.json({
      success: true,
      roomCode: TEST_ROOM_CODE,
      participants: allParticipants.length,
      rounds: insertedRounds.length,
      scores,
      message: `Test room ${TEST_ROOM_CODE} created with ${allParticipants.length} players and ${insertedRounds.length} rounds`,
      multiPlayer: isMultiPlayer,
      note: isMultiPlayer
        ? 'Multi-player test mode active!'
        : 'Single-player mode. Run the migration in supabase/migrations/allow_test_participants.sql for 4 players.',
    })

  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
