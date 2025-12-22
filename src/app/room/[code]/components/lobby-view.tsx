'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import type { Room, Participant, GameSettings } from '@/types/database'
import { DEFAULT_GAME_SETTINGS } from '@/types/database'

interface LobbyViewProps {
  room: Room
  participants: Participant[]
  currentParticipant: Participant
  onStartGame: () => void
  onUpdateSettings: (settings: GameSettings) => void
}

export function LobbyView({
  room,
  participants,
  currentParticipant,
  onStartGame,
  onUpdateSettings,
}: LobbyViewProps) {
  const isHost = currentParticipant.is_host
  const [copied, setCopied] = useState(false)
  // Allow single player for testing (change to >= 2 for production)
  const canStart = participants.length >= 1

  const settings = room.settings || DEFAULT_GAME_SETTINGS

  const copyRoomLink = () => {
    const url = `${window.location.origin}/room/${room.room_code}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const updateSetting = <K extends keyof GameSettings>(
    key: K,
    value: GameSettings[K]
  ) => {
    onUpdateSettings({ ...settings, [key]: value })
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 pt-8">
      <div className="w-full max-w-md space-y-4">
        <GameBreadcrumbs currentStage="lobby" />

        {/* Room Code Display */}
        <Card className="border-2 border-primary/30 bg-card/50">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg text-muted-foreground">Room Code</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <button
              onClick={copyRoomLink}
              className="text-4xl font-mono font-bold tracking-[0.3em] text-secondary hover:text-secondary/80 transition-colors"
              title="Click to copy link"
            >
              {room.room_code}
            </button>
            <p className="text-xs text-muted-foreground mt-2">
              {copied ? '✓ Link copied!' : 'Click to copy invite link'}
            </p>
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

        {/* Game Settings - Inline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Game Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Songs Required */}
            <div className="space-y-2">
              <Label className="text-sm">Songs per player</Label>
              <div className="flex gap-2">
                {([5, 10, 15] as const).map(num => (
                  <Button
                    key={num}
                    variant={settings.songsRequired === num ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => isHost && updateSetting('songsRequired', num)}
                    className="flex-1"
                    disabled={!isHost}
                  >
                    {num}
                  </Button>
                ))}
              </div>
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
                onValueChange={([value]) => isHost && updateSetting('christmasSongsRequired', value)}
                max={settings.songsRequired}
                min={0}
                step={1}
                disabled={!isHost}
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
                    onClick={() => isHost && updateSetting('previewLengthSeconds', num)}
                    className="flex-1"
                    disabled={!isHost}
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
                    onClick={() => isHost && updateSetting('guessTimerSeconds', value)}
                    className="flex-1"
                    disabled={!isHost}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Toggle Options */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Chameleon Mode</Label>
                <Switch
                  checked={settings.chameleonMode}
                  onCheckedChange={(checked) => isHost && updateSetting('chameleonMode', checked)}
                  disabled={!isHost}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Reveal answers after each round</Label>
                <Switch
                  checked={settings.revealAfterEachRound}
                  onCheckedChange={(checked) => isHost && updateSetting('revealAfterEachRound', checked)}
                  disabled={!isHost}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Allow duplicate songs</Label>
                <Switch
                  checked={settings.allowDuplicateSongs}
                  onCheckedChange={(checked) => isHost && updateSetting('allowDuplicateSongs', checked)}
                  disabled={!isHost}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Trivia round</Label>
                <Switch
                  checked={settings.triviaEnabled}
                  onCheckedChange={(checked) => isHost && updateSetting('triviaEnabled', checked)}
                  disabled={!isHost}
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
                        onClick={() => isHost && updateSetting('triviaQuestionCount', num)}
                        className="flex-1"
                        disabled={!isHost}
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!isHost && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                Only the host can change settings
              </p>
            )}
          </CardContent>
        </Card>

        {/* Start Game Button (Host Only) */}
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
    </main>
  )
}
