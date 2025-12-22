'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import { createClient } from '@/lib/supabase/client'
import { generateRoomCode } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Room } from '@/types/database'

interface RoomHistory {
  room: Room
  isHost: boolean
}

export default function LobbyPage() {
  const [user, setUser] = useState<User | null>(null)
  const [userMeta, setUserMeta] = useState<{ name: string; avatar: string | null }>({ name: '', avatar: null })
  const [joinCode, setJoinCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roomHistory, setRoomHistory] = useState<RoomHistory[]>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        // Extract Spotify metadata
        const meta = user.user_metadata
        setUserMeta({
          name: meta?.full_name || meta?.name || user.email || 'Player',
          avatar: meta?.avatar_url || meta?.picture || null,
        })

        // Fetch room history
        const { data: participations } = await supabase
          .from('participants')
          .select('is_host, rooms(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)

        if (participations) {
          const history: RoomHistory[] = participations
            .filter(p => p.rooms)
            .map(p => ({
              room: p.rooms as unknown as Room,
              isHost: p.is_host,
            }))
          setRoomHistory(history)
        }
      }
    }
    getUser()
  }, [supabase.auth])

  const handleCreateRoom = async () => {
    if (!user) return
    setIsCreating(true)
    setError(null)

    try {
      const roomCode = generateRoomCode()
      const spotifyId = user.user_metadata?.provider_id || user.id

      // Create the room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          room_code: roomCode,
          host_id: user.id,
          status: 'LOBBY',
        })
        .select()
        .single()

      if (roomError) throw roomError

      // Add host as participant
      const { error: participantError } = await supabase
        .from('participants')
        .insert({
          room_id: room.id,
          user_id: user.id,
          spotify_id: spotifyId,
          display_name: userMeta.name,
          avatar_url: userMeta.avatar,
          is_host: true,
        })

      if (participantError) throw participantError

      router.push(`/room/${roomCode}`)
    } catch (err) {
      console.error('Error creating room:', err)
      setError('Failed to create room. Please try again.')
      setIsCreating(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!user || !joinCode.trim()) return
    setIsJoining(true)
    setError(null)

    try {
      const code = joinCode.trim().toUpperCase()
      const spotifyId = user.user_metadata?.provider_id || user.id

      // Find the room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', code)
        .single()

      if (roomError || !room) {
        setError('Room not found. Check the code and try again.')
        setIsJoining(false)
        return
      }

      if (room.status !== 'LOBBY' && room.status !== 'SUBMITTING') {
        setError('This game has already started.')
        setIsJoining(false)
        return
      }

      // Check if already in room
      const { data: existing } = await supabase
        .from('participants')
        .select('id')
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .single()

      if (!existing) {
        // Add as participant
        const { error: participantError } = await supabase
          .from('participants')
          .insert({
            room_id: room.id,
            user_id: user.id,
            spotify_id: spotifyId,
            display_name: userMeta.name,
            avatar_url: userMeta.avatar,
            is_host: false,
          })

        if (participantError) throw participantError
      }

      router.push(`/room/${code}`)
    } catch (err) {
      console.error('Error joining room:', err)
      setError('Failed to join room. Please try again.')
      setIsJoining(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <GameBreadcrumbs currentStage="join" />

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            Festive Frequencies
          </h1>
        </div>

        {/* Create Room Card */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-xl">Host a Game</CardTitle>
            <CardDescription>Create a new room and invite your friends</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="w-full h-12 text-lg"
            >
              {isCreating ? 'Creating...' : 'Create Room'}
            </Button>
          </CardContent>
        </Card>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        {/* Join Room Card */}
        <Card className="border-2 border-secondary/20">
          <CardHeader>
            <CardTitle className="text-xl">Join a Game</CardTitle>
            <CardDescription>Enter a room code to join your friends</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Enter room code (e.g. JING42)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="h-12 text-lg text-center tracking-widest font-mono"
              maxLength={6}
            />
            <Button
              onClick={handleJoinRoom}
              disabled={isJoining || !joinCode.trim()}
              variant="secondary"
              className="w-full h-12 text-lg"
            >
              {isJoining ? 'Joining...' : 'Join Room'}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <div className="text-center text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Recent Sessions */}
        {roomHistory.length > 0 && (
          <Card className="border border-muted">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {roomHistory.map(({ room, isHost }) => (
                <button
                  key={room.id}
                  onClick={() => router.push(`/room/${room.room_code}`)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm">{room.room_code}</span>
                    {isHost && (
                      <span className="text-xs text-primary">(Host)</span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    room.status === 'LOBBY' ? 'bg-blue-500/20 text-blue-500' :
                    room.status === 'SUBMITTING' ? 'bg-amber-500/20 text-amber-500' :
                    room.status === 'PLAYING_ROUND_1' || room.status === 'PLAYING_ROUND_2' ? 'bg-green-500/20 text-green-500' :
                    room.status === 'TRIVIA' ? 'bg-purple-500/20 text-purple-500' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {room.status === 'LOBBY' ? 'Lobby' :
                     room.status === 'SUBMITTING' ? 'Picking Songs' :
                     room.status === 'PLAYING_ROUND_1' ? 'Part 1' :
                     room.status === 'TRIVIA' ? 'Trivia' :
                     room.status === 'PLAYING_ROUND_2' ? 'Part 2' :
                     'Finished'}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
