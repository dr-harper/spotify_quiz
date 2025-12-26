import { createClient } from '@/lib/supabase/server'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { code } = await params
  const roomCode = code.toUpperCase()

  // First verify the room exists and user is the host
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, host_id')
    .eq('room_code', roomCode)
    .single()

  if (roomError || !room) {
    console.error('Room lookup error:', roomError)
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  if (room.host_id !== user.id) {
    return NextResponse.json({ error: 'Only the host can delete this room' }, { status: 403 })
  }

  // Delete using the user's client (RLS policy will verify they're the host)
  const { error: deleteError } = await supabase
    .from('rooms')
    .delete()
    .eq('id', room.id)

  if (deleteError) {
    console.error('Error deleting room:', deleteError)
    return NextResponse.json({
      error: 'Failed to delete room',
      details: deleteError.message
    }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
