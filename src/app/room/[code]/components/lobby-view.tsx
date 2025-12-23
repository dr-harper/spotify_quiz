'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import type { Room, Participant, GameSettings } from '@/types/database'
import { DEFAULT_GAME_SETTINGS } from '@/types/database'
import { LOBBY_NAME_MAX_LENGTH } from '@/constants/rooms'

interface LobbyViewProps {
  room: Room
  participants: Participant[]
  currentParticipant: Participant
  onStartGame: () => void
  onUpdateSettings: (settings: GameSettings) => void
  onUpdateRoomName: (name: string | null) => Promise<void> | void
}

export function LobbyView({
  room,
  participants,
  currentParticipant,
  onStartGame,
  onUpdateSettings,
  onUpdateRoomName,
}: LobbyViewProps) {
  const isHost = currentParticipant.is_host
  const [copied, setCopied] = useState(false)
  const [roomNameInput, setRoomNameInput] = useState(room.name ?? '')
  const [isSavingName, setIsSavingName] = useState(false)
  // Allow single player for testing (change to >= 2 for production)
  const canStart = participants.length >= 1

  const settings = room.settings || DEFAULT_GAME_SETTINGS
  const displayName = room.name?.trim() || room.room_code

  useEffect(() => {
    setRoomNameInput(room.name ?? '')
  }, [room.name])

  const copyRoomLink = () => {
    const url = `${window.location.origin}/room/${room.room_code}`
    const inviteText = `🎵 ${displayName}

Pick your favourite songs, we'll shuffle them into a playlist, then guess who chose what!

Join: ${url}`
    navigator.clipboard.writeText(inviteText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const updateSetting = <K extends keyof GameSettings>(
    key: K,
    value: GameSettings[K]
  ) => {
    onUpdateSettings({ ...settings, [key]: value })
  }

  const handleNameBlur = async () => {
    if (!isHost) {
      setRoomNameInput(room.name ?? '')
      return
    }

    const normalized = roomNameInput.trim().replace(/\s+/g, ' ')
    const limitedName = normalized ? normalized.slice(0, LOBBY_NAME_MAX_LENGTH) : ''

    if (limitedName === (room.name ?? '')) {
      setRoomNameInput(room.name ?? '')
      return
    }

    try {
      setIsSavingName(true)
      await onUpdateRoomName(limitedName || null)
      setRoomNameInput(limitedName)
    } finally {
      setIsSavingName(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 pt-8">
      <div className="w-full max-w-4xl">
        <div className="max-w-md mx-auto lg:max-w-none">
          <GameBreadcrumbs currentStage="lobby" />
        </div>

        <div className="text-center space-y-1 my-6">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Lobby</p>
          <h1 className="text-3xl font-bold text-foreground">{displayName}</h1>
          <p className="font-mono text-sm text-muted-foreground">Code: {room.room_code}</p>
        </div>

        {/* Two-column layout on larger screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-md mx-auto lg:max-w-none">
          {/* Left Column - Lobby Details & Players */}
          <div className="space-y-4">
            {/* Lobby Details */}
            <Card className="border-2 border-primary/30 bg-card/50">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg text-muted-foreground">Lobby details & invites</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-left">
                  <Label htmlFor="room-name" className="text-sm">Lobby name</Label>
                  <Input
                    id="room-name"
                    value={roomNameInput}
                    onChange={(e) => setRoomNameInput(e.target.value.slice(0, LOBBY_NAME_MAX_LENGTH))}
                    onBlur={handleNameBlur}
                    placeholder="Name your lobby"
                    disabled={!isHost || isSavingName}
                    maxLength={LOBBY_NAME_MAX_LENGTH}
                    autoComplete="off"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {isSavingName
                        ? 'Saving lobby name...'
                        : isHost
                          ? 'Only the host can edit this name'
                          : 'Only the host can edit this name'}
                    </span>
                    <span>{roomNameInput.trim().length}/{LOBBY_NAME_MAX_LENGTH}</span>
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <button
                    onClick={copyRoomLink}
                    className="text-4xl font-mono font-bold tracking-[0.3em] text-secondary hover:text-secondary/80 transition-colors w-full"
                    title="Click to copy invite"
                  >
                    {room.room_code}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {copied ? `✓ Copied invite for "${displayName}"` : `Click to copy invite for "${displayName}"`}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Players List */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span>Players</span>
                  <Badge variant="secondary">{participants.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        participant.id === currentParticipant.id
                          ? 'bg-primary/10 border border-primary/20'
                          : ''
                      }`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={participant.avatar_url || undefined} />
                        <AvatarFallback>
                          {participant.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 font-medium text-sm">
                        {participant.display_name}
                        {participant.id === currentParticipant.id && (
                          <span className="text-muted-foreground text-xs ml-2">(You)</span>
                        )}
                      </span>
                      {participant.is_host && (
                        <Badge variant="outline" className="text-primary border-primary text-xs">
                          Host
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                {participants.length < 2 && (
                  <p className="text-sm text-muted-foreground text-center mt-3">
                    Waiting for more players to join...
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Start Game Button - visible on mobile, hidden on desktop (shown at bottom of right column) */}
            <div className="lg:hidden">
              {isHost ? (
                <Button
                  onClick={onStartGame}
                  disabled={!canStart}
                  className="w-full h-14 text-lg"
                  size="lg"
                >
                  Start Game
                </Button>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  Waiting for host to start the game...
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Game Settings */}
          <div className="space-y-4">

        {/* Game Settings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Game Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isHost ? (
              <>
                {/* Songs Required */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Songs per player</Label>
                    <span className="text-sm font-medium">{settings.songsRequired}</span>
                  </div>
                  <Slider
                    value={[settings.songsRequired]}
                    onValueChange={([value]) => {
                      updateSetting('songsRequired', value)
                      // Ensure Christmas requirement doesn't exceed songs required
                      if (settings.christmasSongsRequired > value) {
                        updateSetting('christmasSongsRequired', value)
                      }
                    }}
                    max={20}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Christmas Songs Required */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Required Christmas songs</Label>
                    <span className="text-sm font-medium">
                      {settings.christmasSongsRequired === 0
                        ? 'None'
                        : settings.christmasSongsRequired === settings.songsRequired
                          ? 'All'
                          : settings.christmasSongsRequired}
                    </span>
                  </div>
                  <Slider
                    value={[settings.christmasSongsRequired]}
                    onValueChange={([value]) => updateSetting('christmasSongsRequired', value)}
                    max={settings.songsRequired}
                    min={0}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Recent Songs Required */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Songs from this year</Label>
                    <span className="text-sm font-medium">
                      {settings.recentSongsRequired === 0
                        ? 'None'
                        : settings.recentSongsRequired === settings.songsRequired
                          ? 'All'
                          : settings.recentSongsRequired}
                    </span>
                  </div>
                  <Slider
                    value={[settings.recentSongsRequired || 0]}
                    onValueChange={([value]) => updateSetting('recentSongsRequired', value)}
                    max={settings.songsRequired}
                    min={0}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Preview Length */}
                <div className="space-y-2">
                  <Label className="text-sm">Preview length</Label>
                  <div className="flex gap-2">
                    {([15, 30] as const).map(num => (
                      <Button
                        key={num}
                        variant={settings.previewLengthSeconds === num ? 'default' : 'outline'}
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
                  <Label className="text-sm">Guess timer</Label>
                  <div className="flex gap-2">
                    {[
                      { value: null, label: 'Off' },
                      { value: 15, label: '15s' },
                      { value: 30, label: '30s' },
                    ].map(({ value, label }) => (
                      <Button
                        key={label}
                        variant={settings.guessTimerSeconds === value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateSetting('guessTimerSeconds', value)}
                        className="flex-1"
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Toggle Options */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Chameleon Mode</Label>
                      <p className="text-xs text-muted-foreground">Pick one song disguised as someone else&apos;s taste - score if they guess wrong!</p>
                    </div>
                    <Switch
                      checked={settings.chameleonMode}
                      onCheckedChange={(checked) => updateSetting('chameleonMode', checked)}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Reveal after each round</Label>
                      <p className="text-xs text-muted-foreground">Show who picked each song immediately after guessing</p>
                    </div>
                    <Switch
                      checked={settings.revealAfterEachRound}
                      onCheckedChange={(checked) => updateSetting('revealAfterEachRound', checked)}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Allow duplicate songs</Label>
                      <p className="text-xs text-muted-foreground">Multiple players can pick the same song</p>
                    </div>
                    <Switch
                      checked={settings.allowDuplicateSongs}
                      onCheckedChange={(checked) => updateSetting('allowDuplicateSongs', checked)}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Trivia round</Label>
                      <p className="text-xs text-muted-foreground">Music trivia questions between song rounds</p>
                    </div>
                    <Switch
                      checked={settings.triviaEnabled}
                      onCheckedChange={(checked) => updateSetting('triviaEnabled', checked)}
                    />
                  </div>

                  {settings.triviaEnabled && (
                    <div className="space-y-2 pl-4 border-l-2 border-purple-500/30">
                      <Label className="text-sm text-muted-foreground">Trivia questions</Label>
                      <div className="flex gap-2">
                        {([5, 10] as const).map(num => (
                          <Button
                            key={num}
                            variant={settings.triviaQuestionCount === num ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateSetting('triviaQuestionCount', num)}
                            className="flex-1"
                          >
                            {num}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Read-only settings view for non-hosts */
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Songs per player</span>
                  <span className="font-medium">{settings.songsRequired}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Christmas songs required</span>
                  <span className="font-medium">
                    {settings.christmasSongsRequired === 0
                      ? 'None'
                      : settings.christmasSongsRequired === settings.songsRequired
                        ? 'All'
                        : settings.christmasSongsRequired}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Preview length</span>
                  <span className="font-medium">{settings.previewLengthSeconds}s</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Guess timer</span>
                  <span className="font-medium">
                    {settings.guessTimerSeconds ? `${settings.guessTimerSeconds}s` : 'Off'}
                  </span>
                </div>
                {settings.chameleonMode && (
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Chameleon Mode</span>
                    <span className="font-medium text-secondary">On</span>
                  </div>
                )}
                {settings.revealAfterEachRound && (
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Reveal after each round</span>
                    <span className="font-medium text-secondary">On</span>
                  </div>
                )}
                {settings.allowDuplicateSongs && (
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Duplicate songs allowed</span>
                    <span className="font-medium text-secondary">On</span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Trivia round</span>
                  <span className="font-medium">
                    {settings.triviaEnabled ? `${settings.triviaQuestionCount} questions` : 'Off'}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

            {/* Start Game Button - hidden on mobile, visible on desktop */}
            <div className="hidden lg:block">
              {isHost ? (
                <Button
                  onClick={onStartGame}
                  disabled={!canStart}
                  className="w-full h-14 text-lg"
                  size="lg"
                >
                  Start Game
                </Button>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  Waiting for host to start the game...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
