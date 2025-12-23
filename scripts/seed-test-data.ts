/**
 * Seed script to create test data for the quiz
 *
 * Run with: npx tsx scripts/seed-test-data.ts
 *
 * Creates:
 * - 1 room with code "TEST01"
 * - 4 test participants
 * - 10 song submissions per participant (40 total)
 * - 40 quiz rounds with votes
 */

import { createClient } from '@supabase/supabase-js'
import type { SubmissionInsert, VoteInsert } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const TEST_ROOM_CODE = 'TEST01'

const TEST_PLAYERS = [
  { name: 'Alice', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice' },
  { name: 'Bob', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob' },
  { name: 'Charlie', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie' },
  { name: 'Diana', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Diana' },
]

const SAMPLE_SONGS = [
  { track_id: '0bYg9bo50gSsH3LtXe2SQn', name: 'All I Want for Christmas Is You', artist: 'Mariah Carey', album_art: 'https://i.scdn.co/image/ab67616d0000b273f0b8a5ad1e7a3b6c7a0c0c0c' },
  { track_id: '2FRnf9qhLbvw8fu4IBXx78', name: 'Last Christmas', artist: 'Wham!', album_art: 'https://i.scdn.co/image/ab67616d0000b273d0b8a5ad1e7a3b6c7a0c0c0c' },
  { track_id: '7xMbUXpjwDcMRhS4sFPzHX', name: 'Jingle Bell Rock', artist: 'Bobby Helms', album_art: 'https://i.scdn.co/image/ab67616d0000b273e0b8a5ad1e7a3b6c7a0c0c0c' },
  { track_id: '2gMXnyrvIjhVBUZwvLZDMP', name: "Rockin' Around the Christmas Tree", artist: 'Brenda Lee', album_art: 'https://i.scdn.co/image/ab67616d0000b273a0b8a5ad1e7a3b6c7a0c0c0c' },
  { track_id: '5hslUAKq9I9CG2bAulFkHN', name: 'Let It Snow! Let It Snow! Let It Snow!', artist: 'Dean Martin', album_art: 'https://i.scdn.co/image/ab67616d0000b273b0b8a5ad1e7a3b6c7a0c0c0c' },
  { track_id: '4PS1e2kjMpGGR0X2Rb6rWD', name: 'Santa Tell Me', artist: 'Ariana Grande', album_art: 'https://i.scdn.co/image/ab67616d0000b273c0b8a5ad1e7a3b6c7a0c0c0c' },
  { track_id: '1mWdTewIgB3gtBM3TOSFhB', name: 'Snowman', artist: 'Sia', album_art: 'https://i.scdn.co/image/ab67616d0000b273d0b8a5ad1e7a3b6c7a0c0c0c' },
  { track_id: '2FRnf9qhLbvw8fu4IBXx79', name: 'Underneath the Tree', artist: 'Kelly Clarkson', album_art: 'https://i.scdn.co/image/ab67616d0000b273e0b8a5ad1e7a3b6c7a0c0c0c' },
  { track_id: '3d9DChrdc6BOeFsbrZ3Is0', name: 'White Christmas', artist: 'Bing Crosby', album_art: 'https://i.scdn.co/image/ab67616d0000b273f0b8a5ad1e7a3b6c7a0c0c0c' },
  { track_id: '0xPGCS49rQLaZ0j4YV8vVy', name: "It's Beginning to Look a Lot Like Christmas", artist: 'Michael Bublé', album_art: 'https://i.scdn.co/image/ab67616d0000b27300b8a5ad1e7a3b6c7a0c0c0c' },
]

async function cleanupExistingTestData() {
  console.log('Cleaning up existing test data...')

  // Find and delete existing test room
  const { data: existingRoom } = await supabase
    .from('rooms')
    .select('id')
    .eq('room_code', TEST_ROOM_CODE)
    .single()

  if (existingRoom) {
    // Delete in order: votes -> quiz_rounds -> submissions -> participants -> room
    const { data: participants } = await supabase
      .from('participants')
      .select('id')
      .eq('room_id', existingRoom.id)

    if (participants) {
      const participantIds = participants.map(p => p.id)

      // Delete quiz rounds (votes will cascade)
      await supabase
        .from('quiz_rounds')
        .delete()
        .eq('room_id', existingRoom.id)

      // Delete submissions
      await supabase
        .from('submissions')
        .delete()
        .in('participant_id', participantIds)

      // Delete participants
      await supabase
        .from('participants')
        .delete()
        .eq('room_id', existingRoom.id)
    }

    // Delete room
    await supabase
      .from('rooms')
      .delete()
      .eq('id', existingRoom.id)

    console.log('Cleaned up existing test room')
  }
}

async function createTestUsers() {
  console.log('Creating test users...')

  const users: { id: string; name: string; avatar: string }[] = []

  for (const player of TEST_PLAYERS) {
    // Create user in auth
    const email = `${player.name.toLowerCase()}@test.local`
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: 'testpassword123',
      email_confirm: true,
      user_metadata: {
        full_name: player.name,
        avatar_url: player.avatar,
      },
    })

    if (authError) {
      // User might already exist, try to get them
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === email)
      if (existingUser) {
        users.push({ id: existingUser.id, name: player.name, avatar: player.avatar })
        console.log(`  Using existing user: ${player.name}`)
        continue
      }
      console.error(`Failed to create user ${player.name}:`, authError)
      continue
    }

    users.push({ id: authData.user.id, name: player.name, avatar: player.avatar })
    console.log(`  Created user: ${player.name}`)
  }

  return users
}

async function seedTestData() {
  try {
    await cleanupExistingTestData()

    const users = await createTestUsers()

    if (users.length < 4) {
      console.error('Could not create enough test users')
      process.exit(1)
    }

    // Create room
    console.log('Creating test room...')
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        room_code: TEST_ROOM_CODE,
        host_id: users[0].id,
        status: 'RESULTS', // Already finished for testing results view
      })
      .select()
      .single()

    if (roomError) throw roomError
    console.log(`  Created room: ${TEST_ROOM_CODE}`)

    // Create participants
    console.log('Creating participants...')
    const participantsToInsert = users.map((user, index) => ({
      room_id: room.id,
      user_id: user.id,
      spotify_id: `test_spotify_${user.id}`,
      display_name: user.name,
      avatar_url: user.avatar,
      score: 0, // Will be updated based on votes
      is_host: index === 0,
      has_submitted: true,
    }))

    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .insert(participantsToInsert)
      .select()

    if (participantsError) throw participantsError
    console.log(`  Created ${participants.length} participants`)

    // Create submissions (10 per participant)
    console.log('Creating submissions...')
    const allSubmissions: SubmissionInsert[] = []

    for (const participant of participants) {
      const shuffledSongs = [...SAMPLE_SONGS].sort(() => Math.random() - 0.5)

      for (let i = 0; i < 10; i++) {
        const song = shuffledSongs[i % shuffledSongs.length]
        allSubmissions.push({
          participant_id: participant.id,
          track_id: `${song.track_id}_${participant.id}_${i}`, // Make unique
          track_name: song.name,
          artist_name: song.artist,
          album_art_url: song.album_art,
          preview_url: 'https://p.scdn.co/mp3-preview/sample', // Dummy preview
          submission_order: i + 1,
        })
      }
    }

    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .insert(allSubmissions)
      .select()

    if (submissionsError) throw submissionsError
    console.log(`  Created ${submissions.length} submissions`)

    // Create quiz rounds (one per submission, shuffled)
    console.log('Creating quiz rounds...')
    const shuffledSubmissions = [...submissions].sort(() => Math.random() - 0.5)

    const roundsToInsert = shuffledSubmissions.map((sub, index) => ({
      room_id: room.id,
      submission_id: sub.id,
      round_number: index + 1,
    }))

    const { data: rounds, error: roundsError } = await supabase
      .from('quiz_rounds')
      .insert(roundsToInsert)
      .select()

    if (roundsError) throw roundsError
    console.log(`  Created ${rounds.length} quiz rounds`)

    // Create votes with realistic distribution
    console.log('Creating votes...')
    const votes: VoteInsert[] = []
    const scores: { [participantId: string]: number } = {}

    participants.forEach(p => { scores[p.id] = 0 })

    for (const round of rounds) {
      const submission = submissions.find(s => s.id === round.submission_id)!
      const correctParticipantId = submission.participant_id

      for (const voter of participants) {
        // Each player has 40-60% chance of guessing correctly
        const guessCorrectly = Math.random() < 0.5
        const guessedId = guessCorrectly
          ? correctParticipantId
          : participants[Math.floor(Math.random() * participants.length)].id

        const isCorrect = guessedId === correctParticipantId
        const points = isCorrect ? 100 : 0

        if (isCorrect) {
          scores[voter.id] += 100
        }

        votes.push({
          round_id: round.id,
          voter_id: voter.id,
          guessed_participant_id: guessedId,
          is_correct: isCorrect,
          points_awarded: points,
        })
      }
    }

    const { error: votesError } = await supabase
      .from('votes')
      .insert(votes)

    if (votesError) throw votesError
    console.log(`  Created ${votes.length} votes`)

    // Update participant scores
    console.log('Updating final scores...')
    for (const participant of participants) {
      await supabase
        .from('participants')
        .update({ score: scores[participant.id] })
        .eq('id', participant.id)
    }

    console.log('\n✅ Test data created successfully!')
    console.log(`\nRoom code: ${TEST_ROOM_CODE}`)
    console.log('Status: RESULTS (ready to view score race chart)')
    console.log('\nTest users created:')
    users.forEach(u => console.log(`  - ${u.name} (${u.name.toLowerCase()}@test.local / testpassword123)`))
    console.log('\nTo test:')
    console.log('1. Log in as any test user')
    console.log('2. Join room TEST01 or find it in Recent Sessions')
    console.log('3. View the results and score race chart')

  } catch (error) {
    console.error('Error seeding test data:', error)
    process.exit(1)
  }
}

seedTestData()
