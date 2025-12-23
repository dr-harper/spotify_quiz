'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FestiveBackground } from '@/components/festive-background'
import { createClient } from '@/lib/supabase/client'

function DuplicateNameContent() {
  const [isReclaiming, setIsReclaiming] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const roomCode = searchParams.get('room')
  const existingName = searchParams.get('name')
  const participantId = searchParams.get('pid')

  useEffect(() => {
    if (!roomCode || !existingName) {
      router.push('/')
    }
  }, [roomCode, existingName, router])

  const handleReclaim = async () => {
    if (!participantId) return
    setIsReclaiming(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      // Transfer the participant to this user
      await supabase
        .from('participants')
        .update({ user_id: user.id })
        .eq('id', participantId)

      router.push(`/room/${roomCode}`)
    } catch (error) {
      console.error('Error reclaiming account:', error)
      setIsReclaiming(false)
    }
  }

  const handleUseDifferentName = async () => {
    if (!newName.trim() || !roomCode) return
    setIsCreatingNew(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      // Update the user's display name
      await supabase.auth.updateUser({
        data: {
          full_name: newName.trim(),
          is_guest: true,
        }
      })

      // Look up the room
      const { data: room } = await supabase
        .from('rooms')
        .select('id')
        .eq('room_code', roomCode.toUpperCase())
        .single()

      if (!room) {
        router.push('/lobby')
        return
      }

      // Create new participant with new name
      await supabase.from('participants').insert({
        room_id: room.id,
        user_id: user.id,
        spotify_id: user.id,
        display_name: newName.trim(),
        avatar_url: null,
        is_host: false,
      })

      router.push(`/room/${roomCode}`)
    } catch (error) {
      console.error('Error creating new participant:', error)
      setIsCreatingNew(false)
    }
  }

  if (!roomCode || !existingName) {
    return null
  }

  return (
    <Card className="w-full max-w-md border-2 border-amber-500/30 shadow-xl relative z-10 bg-card/95 backdrop-blur-sm">
      <CardHeader className="text-center">
        <div className="text-4xl mb-2">⚠️</div>
        <CardTitle className="text-xl">Name Already Taken</CardTitle>
        <CardDescription>
          Someone named <strong>&quot;{existingName}&quot;</strong> is already in this room.
          Is that you?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showNameInput ? (
          <>
            <Button
              onClick={handleReclaim}
              disabled={isReclaiming}
              className="w-full h-12"
            >
              {isReclaiming ? 'Rejoining...' : `Yes, that's me — rejoin as ${existingName}`}
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowNameInput(true)}
              className="w-full h-12"
            >
              No, I&apos;ll use a different name
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Input
                placeholder="Enter a different name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-12 text-center"
                maxLength={20}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowNameInput(false)}
                className="flex-1 h-12"
                disabled={isCreatingNew}
              >
                Back
              </Button>
              <Button
                onClick={handleUseDifferentName}
                disabled={!newName.trim() || isCreatingNew}
                className="flex-1 h-12"
              >
                {isCreatingNew ? 'Joining...' : 'Join'}
              </Button>
            </div>
          </>
        )}

        <p className="text-xs text-center text-muted-foreground mt-4">
          Guest sessions can expire if you close your browser or clear cookies.
          For a persistent account, use Spotify login.
        </p>
      </CardContent>
    </Card>
  )
}

function LoadingCard() {
  return (
    <Card className="w-full max-w-md border-2 border-muted/30 shadow-xl relative z-10 bg-card/95 backdrop-blur-sm">
      <CardHeader className="text-center">
        <div className="text-4xl mb-2 animate-pulse">⏳</div>
        <CardTitle className="text-xl">Loading...</CardTitle>
      </CardHeader>
    </Card>
  )
}

export default function DuplicateNamePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <FestiveBackground />
      <Suspense fallback={<LoadingCard />}>
        <DuplicateNameContent />
      </Suspense>
    </main>
  )
}
