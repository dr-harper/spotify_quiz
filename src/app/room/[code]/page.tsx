'use client'

import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import type { Room, Participant, GameSettings } from '@/types/database'
import { LobbyView } from './components/lobby-view'
import { SubmissionView } from './components/submission-view'
import { QuizView } from './components/quiz-view'
import { TriviaView } from './components/trivia-view'
import { ResultsView } from './components/results-view'
import { useBackgroundMusic } from '@/components/background-music'

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = params.code as string
  const supabase = createClient()
  const { stop: stopMusic, play: playMusic } = useBackgroundMusic()

  const [room, setRoom] = useState<Room | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch room and participants
  const fetchRoomData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      // Get room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', roomCode.toUpperCase())
        .single()

      if (roomError || !roomData) {
        setError('Room not found')
        return
      }

      setRoom(roomData as Room)

      // Get participants
      const { data: participantsData } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', roomData.id)
        .order('created_at', { ascending: true })

      if (participantsData) {
        // Deduplicate by user_id (in case of any duplicate entries)
        const uniqueParticipants = participantsData.filter(
          (p, index, self) => index === self.findIndex(t => t.user_id === p.user_id)
        )
        setParticipants(uniqueParticipants as Participant[])
        const current = participantsData.find(p => p.user_id === user.id)
        if (current) {
          setCurrentParticipant(current as Participant)
        } else {
          setError('You are not in this room')
        }
      }
    } catch (err) {
      console.error('Error fetching room:', err)
      setError('Failed to load room')
    } finally {
      setIsLoading(false)
    }
  }, [roomCode, router, supabase])

  useEffect(() => {
    fetchRoomData()
  }, [fetchRoomData])

  // Subscribe to realtime updates
  useEffect(() => {
    if (!room) return

    // Subscribe to room changes
    const roomChannel = supabase
      .channel(`room:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          setRoom(payload.new as Room)
        }
      )
      .subscribe()

    // Subscribe to participant changes
    const participantsChannel = supabase
      .channel(`participants:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participants',
          filter: `room_id=eq.${room.id}`,
        },
        async () => {
          // Refetch all participants on any change
          const { data } = await supabase
            .from('participants')
            .select('*')
            .eq('room_id', room.id)
            .order('created_at', { ascending: true })
          if (data) {
            // Deduplicate by user_id
            const uniqueParticipants = data.filter(
              (p, index, self) => index === self.findIndex(t => t.user_id === p.user_id)
            )
            setParticipants(uniqueParticipants as Participant[])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(roomChannel)
      supabase.removeChannel(participantsChannel)
    }
  }, [room, supabase])

  // Control music based on room status
  useEffect(() => {
    if (room?.status === 'LOBBY') {
      playMusic()
    } else if (room) {
      stopMusic()
    }
  }, [room?.status, playMusic, stopMusic, room])

  // Update room status (host only)
  const updateRoomStatus = async (status: Room['status']) => {
    if (!room || !currentParticipant?.is_host) return

    const { error } = await supabase
      .from('rooms')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', room.id)

    if (error) {
      console.error('Error updating room status:', error)
    }
  }

  // Update room settings (host only)
  const updateRoomSettings = async (settings: GameSettings) => {
    if (!room || !currentParticipant?.is_host) return

    const { error } = await supabase
      .from('rooms')
      .update({ settings, updated_at: new Date().toISOString() })
      .eq('id', room.id)

    if (error) {
      console.error('Error updating room settings:', error)
    } else {
      // Update local state
      setRoom(prev => prev ? { ...prev, settings } : prev)
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="animate-pulse text-2xl">Loading room...</div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-destructive text-xl mb-4">{error}</div>
        <button
          onClick={() => router.push('/lobby')}
          className="text-primary underline"
        >
          Back to Lobby
        </button>
      </main>
    )
  }

  if (!room || !currentParticipant) {
    return null
  }

  // Render content based on room status
  const renderContent = () => {
    switch (room.status) {
      case 'LOBBY':
        return (
          <LobbyView
            room={room}
            participants={participants}
            currentParticipant={currentParticipant}
            onStartGame={() => updateRoomStatus('SUBMITTING')}
            onUpdateSettings={updateRoomSettings}
          />
        )
      case 'SUBMITTING':
        return (
          <SubmissionView
            room={room}
            participants={participants}
            currentParticipant={currentParticipant}
            onAllSubmitted={() => updateRoomStatus('PLAYING_ROUND_1')}
            onNavigateToLobby={() => updateRoomStatus('LOBBY')}
          />
        )
      case 'PLAYING_ROUND_1':
        return (
          <QuizView
            room={room}
            participants={participants}
            currentParticipant={currentParticipant}
            roundType="round1"
            onRoundEnd={() => {
              const settings = room.settings
              if (settings?.triviaEnabled) {
                updateRoomStatus('TRIVIA')
              } else {
                updateRoomStatus('PLAYING_ROUND_2')
              }
            }}
            onNavigateToLobby={() => updateRoomStatus('LOBBY')}
          />
        )
      case 'TRIVIA':
        return (
          <TriviaView
            room={room}
            participants={participants}
            currentParticipant={currentParticipant}
            onTriviaEnd={() => updateRoomStatus('PLAYING_ROUND_2')}
            onNavigateToLobby={() => updateRoomStatus('LOBBY')}
          />
        )
      case 'PLAYING_ROUND_2':
        return (
          <QuizView
            room={room}
            participants={participants}
            currentParticipant={currentParticipant}
            roundType="round2"
            onRoundEnd={() => updateRoomStatus('RESULTS')}
            onNavigateToLobby={() => updateRoomStatus('LOBBY')}
          />
        )
      case 'RESULTS':
        return (
          <ResultsView
            room={room}
            participants={participants}
            currentParticipant={currentParticipant}
            onPlayAgain={() => updateRoomStatus('LOBBY')}
          />
        )
      default:
        return null
    }
  }

  return renderContent()
}
