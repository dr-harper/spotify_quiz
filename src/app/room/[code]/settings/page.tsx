'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import { FestiveBackground } from '@/components/festive-background'
import { createClient } from '@/lib/supabase/client'
import type { Room, Participant, GameSettings } from '@/types/database'
import { DEFAULT_GAME_SETTINGS } from '@/types/database'

export default function SettingsPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = params.code as string
  const supabase = createClient()

  const [room, setRoom] = useState<Room | null>(null)
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localSettings, setLocalSettings] = useState<GameSettings>(DEFAULT_GAME_SETTINGS)
  const [hasSubmissions, setHasSubmissions] = useState(false)

  // Fetch room data
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
      setLocalSettings(roomData.settings || DEFAULT_GAME_SETTINGS)

      // Check if current user is a participant and host
      const { data: participant } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', roomData.id)
        .eq('user_id', user.id)
        .single()

      if (!participant) {
        setError('You are not in this room')
        return
      }

      if (!participant.is_host) {
        // Non-hosts can't access settings page, redirect to lobby
        router.push(`/room/${roomCode}`)
        return
      }

      setCurrentParticipant(participant as Participant)

      // Check if any participants have submitted
      const { data: participants } = await supabase
        .from('participants')
        .select('has_submitted')
        .eq('room_id', roomData.id)

      const anySubmitted = participants?.some(p => p.has_submitted) || false
      setHasSubmissions(anySubmitted)

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

  // Apply theme colour class to document
  const themeColor = localSettings.themeColor ?? 'green'
  const showSnow = localSettings.snowEffect ?? true

  useEffect(() => {
    const html = document.documentElement
    html.classList.remove('theme-green', 'theme-red', 'theme-blue', 'theme-purple', 'theme-gold')
    html.classList.add(`theme-${themeColor}`)

    return () => {
      html.classList.remove('theme-green', 'theme-red', 'theme-blue', 'theme-purple', 'theme-gold')
      html.classList.add('theme-green')
    }
  }, [themeColor])

  const clampSettings = (updatedSettings: GameSettings): GameSettings => {
    const songsRequired = Math.max(1, Math.min(20, updatedSettings.songsRequired))
    return {
      ...updatedSettings,
      songsRequired,
      christmasSongsRequired: Math.min(updatedSettings.christmasSongsRequired ?? 0, songsRequired),
      recentSongsRequired: Math.min(updatedSettings.recentSongsRequired ?? 0, songsRequired),
    }
  }

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setLocalSettings(prev => clampSettings({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!room) return

    setIsSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ settings: localSettings, updated_at: new Date().toISOString() })
        .eq('id', room.id)

      if (updateError) throw updateError

      // Navigate to lobby
      router.push(`/room/${roomCode}`)
    } catch (err) {
      console.error('Error saving settings:', err)
      setError('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="animate-pulse text-2xl">Loading settings...</div>
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
          Back to Home
        </button>
      </main>
    )
  }

  if (!room || !currentParticipant) {
    return null
  }

  return (
    <>
      <FestiveBackground showSnow={showSnow} />
      <main className="flex min-h-screen flex-col items-center p-4 pt-8">
        <div className="w-full max-w-2xl">
          <GameBreadcrumbs currentStage="lobby" />

          <div className="text-center space-y-1 my-6">
            <h1 className="text-3xl font-bold text-foreground">Game Settings</h1>
            <p className="text-sm text-muted-foreground">
              Configure your game before inviting players
            </p>
          </div>

          {hasSubmissions && (
            <Card className="border-amber-500/50 bg-amber-500/10 mb-4">
              <CardContent className="py-3">
                <p className="text-sm text-amber-500 text-center">
                  ⚠️ Some players have already submitted songs. Changing settings may affect their submissions.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Song Requirements</CardTitle>
              <CardDescription>How many songs each player must pick</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Songs Required */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Songs per player</Label>
                  <span className="text-sm font-medium">{localSettings.songsRequired}</span>
                </div>
                <Slider
                  value={[localSettings.songsRequired]}
                  onValueChange={([value]) => updateSetting('songsRequired', value)}
                  max={20}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Christmas Songs Required */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Required Christmas songs</Label>
                  <span className="text-sm font-medium">
                    {(localSettings.christmasSongsRequired ?? 0) === 0
                      ? 'None'
                      : localSettings.christmasSongsRequired === localSettings.songsRequired
                        ? 'All'
                        : localSettings.christmasSongsRequired}
                  </span>
                </div>
                <Slider
                  value={[localSettings.christmasSongsRequired ?? 0]}
                  onValueChange={([value]) => updateSetting('christmasSongsRequired', value)}
                  max={localSettings.songsRequired}
                  min={0}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum festive songs (verified by AI)
                </p>
              </div>

              {/* Recent Songs Required */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Songs from this year</Label>
                  <span className="text-sm font-medium">
                    {(localSettings.recentSongsRequired ?? 0) === 0
                      ? 'Off'
                      : localSettings.recentSongsRequired}
                  </span>
                </div>
                <Slider
                  value={[localSettings.recentSongsRequired ?? 0]}
                  onValueChange={([value]) => updateSetting('recentSongsRequired', value)}
                  max={localSettings.songsRequired}
                  min={0}
                  step={1}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Game Modes</CardTitle>
              <CardDescription>Special rules and features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Chameleon Mode */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label>Chameleon Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Pick one song disguised as someone else&apos;s taste — score if they guess wrong!
                  </p>
                </div>
                <Switch
                  checked={localSettings.chameleonMode}
                  onCheckedChange={(checked) => updateSetting('chameleonMode', checked)}
                />
              </div>

              {/* Allow Duplicates */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label>Allow duplicate songs</Label>
                  <p className="text-xs text-muted-foreground">Multiple players can pick the same song.</p>
                </div>
                <Switch
                  checked={localSettings.allowDuplicateSongs}
                  onCheckedChange={(checked) => updateSetting('allowDuplicateSongs', checked)}
                />
              </div>

              {/* Reveal After Each Round */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label>Reveal answers</Label>
                  <p className="text-xs text-muted-foreground">Show who picked each song after voting.</p>
                </div>
                <Switch
                  checked={localSettings.revealAfterEachRound}
                  onCheckedChange={(checked) => updateSetting('revealAfterEachRound', checked)}
                />
              </div>

              {/* Trivia Round */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label>Trivia round</Label>
                    <p className="text-xs text-muted-foreground">Add trivia questions between song halves.</p>
                  </div>
                  <Switch
                    checked={localSettings.triviaEnabled}
                    onCheckedChange={(checked) => updateSetting('triviaEnabled', checked)}
                  />
                </div>
                {localSettings.triviaEnabled && (
                  <div className="flex gap-2 pl-4">
                    {([5, 10] as const).map(num => (
                      <Button
                        key={num}
                        variant={localSettings.triviaQuestionCount === num ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateSetting('triviaQuestionCount', num)}
                        className="flex-1"
                      >
                        {num} questions
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Timing</CardTitle>
              <CardDescription>Preview and guess timers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preview Length */}
              <div className="space-y-2">
                <Label>Preview length</Label>
                <div className="flex gap-2">
                  {([15, 30] as const).map(num => (
                    <Button
                      key={num}
                      variant={localSettings.previewLengthSeconds === num ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateSetting('previewLengthSeconds', num)}
                      className="flex-1"
                    >
                      {num}s
                    </Button>
                  ))}
                </div>
              </div>

              {/* Guess Timer */}
              <div className="space-y-2">
                <Label>Guess timer</Label>
                <div className="flex gap-2">
                  {[
                    { value: null, label: 'Off' },
                    { value: 15, label: '15s' },
                    { value: 30, label: '30s' },
                  ].map(({ value, label }) => (
                    <Button
                      key={label}
                      variant={localSettings.guessTimerSeconds === value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateSetting('guessTimerSeconds', value)}
                      className="flex-1"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Visual Settings</CardTitle>
              <CardDescription>Customise the look and feel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Lobby Music */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label>Lobby music</Label>
                  <p className="text-xs text-muted-foreground">Play festive music while waiting.</p>
                </div>
                <Switch
                  checked={localSettings.lobbyMusic}
                  onCheckedChange={(checked) => updateSetting('lobbyMusic', checked)}
                />
              </div>

              {/* Snow Effect */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label>Snow effect</Label>
                  <p className="text-xs text-muted-foreground">Falling snow animation in the background.</p>
                </div>
                <Switch
                  checked={localSettings.snowEffect ?? true}
                  onCheckedChange={(checked) => updateSetting('snowEffect', checked)}
                />
              </div>

              {/* Theme colour */}
              <div className="space-y-2">
                <Label>Theme colour</Label>
                <div className="grid grid-cols-5 gap-2">
                  {([
                    { value: 'green', label: '🌲', bg: 'bg-green-600' },
                    { value: 'red', label: '🎅', bg: 'bg-red-600' },
                    { value: 'blue', label: '❄️', bg: 'bg-blue-600' },
                    { value: 'purple', label: '🔮', bg: 'bg-purple-600' },
                    { value: 'gold', label: '⭐', bg: 'bg-yellow-600' },
                  ] as const).map(({ value, label, bg }) => (
                    <Button
                      key={value}
                      variant={(localSettings.themeColor ?? 'green') === value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateSetting('themeColor', value)}
                      className={`flex-1 ${(localSettings.themeColor ?? 'green') === value ? bg : ''}`}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 mb-8">
            <Button
              variant="outline"
              onClick={() => router.push(`/room/${roomCode}`)}
              className="flex-1"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save & Continue'}
            </Button>
          </div>
        </div>
      </main>
    </>
  )
}
