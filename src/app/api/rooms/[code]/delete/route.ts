import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: { code: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const roomCode = params.code.toUpperCase()

  const { data: room, error: roomError } = await admin
    .from('rooms')
    .select('*')
    .eq('room_code', roomCode)
    .single()

  if (roomError || !room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  if (room.host_id !== user.id) {
    return NextResponse.json({ error: 'Only the host can delete this room' }, { status: 403 })
  }

  const { error: deleteError } = await admin
    .from('rooms')
    .delete()
    .eq('id', room.id)

  if (deleteError) {
    console.error('Error deleting room:', deleteError)
    return NextResponse.json({ error: 'Failed to delete room' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
