'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import { FestiveBackground } from '@/components/festive-background'
import { useBackgroundMusic } from '@/components/background-music'
import { createClient } from '@/lib/supabase/client'
import { generateRoomCode } from '@/lib/utils'
import { LOBBY_NAME_MAX_LENGTH } from '@/constants/rooms'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { GameSettings, Room } from '@/types/database'
import { DEFAULT_GAME_SETTINGS } from '@/types/database'
import { GameSettingsModal } from '@/app/room/[code]/components/game-settings-modal'

interface RoomHistory {
  room: Room
  isHost: boolean
  playerCount: number
  lastActive: Date
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function LobbyPage() {
  const [user, setUser] = useState<User | null>(null)
  const [userMeta, setUserMeta] = useState<{ name: string; avatar: string | null }>({ name: '', avatar: null })
  const [joinCode, setJoinCode] = useState('')
  const [lobbyName, setLobbyName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roomHistory, setRoomHistory] = useState<RoomHistory[]>([])
  const [settingsDraft, setSettingsDraft] = useState<GameSettings>(DEFAULT_GAME_SETTINGS)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { setTrack } = useBackgroundMusic()

  // Switch to app music when entering the lobby
  useEffect(() => {
    setTrack('app')
  }, [setTrack])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        console.log('Current user ID:', user.id, 'Provider:', user.app_metadata?.provider || 'unknown')
        setUser(user)
        // Extract Spotify metadata
        const meta = user.user_metadata
        setUserMeta({
          name: meta?.full_name || meta?.name || user.email || 'Player',
          avatar: meta?.avatar_url || meta?.picture || null,
        })

        // Fetch room history
        const { data: participations, error: participationsError } = await supabase
          .from('participants')
          .select('is_host, rooms(*)')
          .eq('user_id', user.id)
          .limit(10)

        if (participationsError) {
          console.error('Error fetching room history:', participationsError)
        }

        if (participations) {
          console.log('Found participations for user:', user.id, 'Count:', participations.length)
          console.log('Participations:', participations.map(p => ({
            isHost: p.is_host,
            roomCode: (p.rooms as unknown as Room)?.room_code,
            roomStatus: (p.rooms as unknown as Room)?.status
          })))
          const roomsWithParticipants = participations.filter(p => p.rooms)
          const roomIds = roomsWithParticipants.map(p => (p.rooms as unknown as Room).id)

          // Fetch player counts for each room
          const { data: participantCounts } = await supabase
            .from('participants')
            .select('room_id')
            .in('room_id', roomIds)

          // Count participants per room
          const countMap = new Map<string, number>()
          participantCounts?.forEach(p => {
            countMap.set(p.room_id, (countMap.get(p.room_id) || 0) + 1)
          })

          const history: RoomHistory[] = roomsWithParticipants
            .map(p => {
              const room = p.rooms as unknown as Room
              return {
                room,
                isHost: p.is_host,
                playerCount: countMap.get(room.id) || 0,
                lastActive: new Date(room.updated_at),
              }
            })
            .sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime())
            .slice(0, 5)
          setRoomHistory(history)
        }
      }
    }
    getUser()
  }, [supabase.auth])

  const handleCreateRoom = async (settings: GameSettings) => {
    if (!user) return
    setIsCreating(true)
    setError(null)

    try {
      const roomCode = generateRoomCode()
      const spotifyId = user.user_metadata?.provider_id || user.id
      const normalizedName = lobbyName.trim().replace(/\s+/g, ' ')

      // Create the room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          room_code: roomCode,
          host_id: user.id,
          name: normalizedName ? normalizedName : null,
          status: 'SUBMITTING',
          settings,
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

  const openSettingsModal = () => {
    if (!user) return
    setSettingsModalOpen(true)
  }

  const handleSettingsSave = async (settings: GameSettings) => {
    setSettingsDraft(settings)
    setSettingsModalOpen(false)
    await handleCreateRoom(settings)
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
    <main className="flex min-h-screen flex-col items-center p-4 py-8">
      <FestiveBackground showSnow={true} />
      <div className="w-full max-w-4xl">
        <div className="max-w-md mx-auto lg:max-w-none">
          <GameBreadcrumbs currentStage="join" />
        </div>

        <div className="text-center my-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            Festive Frequencies
          </h1>
        </div>

        {/* Two-column layout on larger screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-md mx-auto lg:max-w-none">
          {/* Create Room Card */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="text-xl">Host a Game</CardTitle>
              <CardDescription>Create a new room and invite your friends</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lobby-name" className="text-sm">Lobby name (optional)</Label>
                <Input
                  id="lobby-name"
                  placeholder="e.g. Snowball Showdown"
                  value={lobbyName}
                  onChange={(e) => setLobbyName(e.target.value.slice(0, LOBBY_NAME_MAX_LENGTH))}
                  onBlur={() => setLobbyName((value) => value.trim())}
                  maxLength={LOBBY_NAME_MAX_LENGTH}
                  autoComplete="off"
                  disabled={isCreating}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {lobbyName.trim().length}/{LOBBY_NAME_MAX_LENGTH} characters
                </p>
              </div>
              <Button
                onClick={openSettingsModal}
                disabled={isCreating}
                className="w-full h-12 text-lg"
              >
                {isCreating ? 'Creating...' : 'Create & Choose Settings'}
              </Button>
            </CardContent>
          </Card>

          {/* Join Room Card */}
          <Card className="border-2 border-secondary/20">
            <CardHeader>
              <CardTitle className="text-xl">Join a Game</CardTitle>
              <CardDescription>Enter a room code to join your friends</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="join-code" className="text-sm">Room code</Label>
                <Input
                  id="join-code"
                  placeholder="e.g. JING42"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="h-12 text-lg text-center tracking-widest font-mono"
                  maxLength={6}
                />
              </div>
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
        </div>

        {error && (
          <div className="text-center text-destructive text-sm mt-4">
            {error}
          </div>
        )}

        {/* Recent Sessions */}
        {roomHistory.length > 0 && (
          <Card className="border border-muted mt-6 max-w-md mx-auto lg:max-w-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {roomHistory.map(({ room, isHost, playerCount, lastActive }) => (
                  <button
                    key={room.id}
                    onClick={() => router.push(`/room/${room.room_code}`)}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm leading-tight">
                          {room.name || 'Untitled lobby'}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="font-mono font-bold">
                            {room.room_code}
                          </span>
                          <span>·</span>
                          <span>{playerCount} {playerCount === 1 ? 'player' : 'players'}</span>
                          <span>·</span>
                          <span>{getRelativeTime(lastActive)}</span>
                        </div>
                      </div>
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
              </div>
            </CardContent>
          </Card>
        )}

        <GameSettingsModal
          open={settingsModalOpen}
          onOpenChange={(open) => setSettingsModalOpen(open)}
          settings={settingsDraft}
          onSave={handleSettingsSave}
          isSaving={isCreating}
        />
      </div>
    </main>
  )
}
