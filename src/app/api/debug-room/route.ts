import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Debug endpoint to check room state
 * GET /api/debug-room?code=FROS70
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const roomCode = searchParams.get('code')

  if (!roomCode) {
    return NextResponse.json({ error: 'Missing room code' }, { status: 400 })
  }

  const supabase = await createClient()

  // Get room
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .single()

  if (roomError || !room) {
    return NextResponse.json({ error: 'Room not found', details: roomError }, { status: 404 })
  }

  // Get participants
  const { data: participants, error: participantsError } = await supabase
    .from('participants')
    .select('id, user_id, display_name, has_submitted, created_at')
    .eq('room_id', room.id)
    .order('created_at', { ascending: true })

  if (participantsError) {
    return NextResponse.json({ error: 'Failed to fetch participants', details: participantsError }, { status: 500 })
  }

  // Get submissions count per participant
  const participantIds = participants?.map(p => p.id) || []
  const { data: submissions, error: submissionsError } = await supabase
    .from('submissions')
    .select('participant_id, track_name')
    .in('participant_id', participantIds)

  if (submissionsError) {
    return NextResponse.json({ error: 'Failed to fetch submissions', details: submissionsError }, { status: 500 })
  }

  // Group submissions by participant
  const submissionsByParticipant: Record<string, string[]> = {}
  for (const sub of submissions || []) {
    if (!submissionsByParticipant[sub.participant_id]) {
      submissionsByParticipant[sub.participant_id] = []
    }
    submissionsByParticipant[sub.participant_id].push(sub.track_name)
  }

  // Build debug info
  const participantInfo = participants?.map(p => ({
    id: p.id,
    user_id: p.user_id,
    display_name: p.display_name,
    has_submitted: p.has_submitted,
    created_at: p.created_at,
    submission_count: submissionsByParticipant[p.id]?.length || 0,
    songs: submissionsByParticipant[p.id] || [],
  }))

  // Check for issues
  const issues: string[] = []

  // Check for duplicate user_ids
  const userIdCounts: Record<string, number> = {}
  for (const p of participants || []) {
    userIdCounts[p.user_id] = (userIdCounts[p.user_id] || 0) + 1
  }
  for (const [userId, count] of Object.entries(userIdCounts)) {
    if (count > 1) {
      issues.push(`Duplicate participant entries for user_id: ${userId} (${count} entries)`)
    }
  }

  // Check for mismatched has_submitted flag
  for (const p of participantInfo || []) {
    if (p.has_submitted && p.submission_count === 0) {
      issues.push(`${p.display_name}: has_submitted=true but has 0 submissions`)
    }
    if (!p.has_submitted && p.submission_count > 0) {
      issues.push(`${p.display_name}: has_submitted=false but has ${p.submission_count} submissions`)
    }
  }

  return NextResponse.json({
    room: {
      id: room.id,
      code: room.room_code,
      name: room.name,
      status: room.status,
    },
    participants: participantInfo,
    issues: issues.length > 0 ? issues : ['No issues detected'],
  })
}
