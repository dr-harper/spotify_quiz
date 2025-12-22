'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import { GameSettingsModal } from './game-settings-modal'
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
  const [showSettings, setShowSettings] = useState(false)
  const isHost = currentParticipant.is_host
  // Allow single player for testing (change to >= 2 for production)
  const canStart = participants.length >= 1

  const settings = room.settings || DEFAULT_GAME_SETTINGS

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.room_code)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <GameBreadcrumbs currentStage="lobby" />

        {/* Room Code Display */}
        <Card className="border-2 border-primary/30 bg-card/50">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg text-muted-foreground">Room Code</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <button
              onClick={copyRoomCode}
              className="text-4xl font-mono font-bold tracking-[0.3em] text-secondary hover:text-secondary/80 transition-colors"
              title="Click to copy"
            >
              {room.room_code}
            </button>
            <p className="text-xs text-muted-foreground mt-2">
              Click to copy • Share with friends!
            </p>
          </CardContent>
        </Card>

        {/* Players List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Players</span>
              <Badge variant="secondary">{participants.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className={`flex items-center gap-3 p-2 rounded-lg ${
                    participant.id === currentParticipant.id
                      ? 'bg-primary/10 border border-primary/20'
                      : ''
                  }`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={participant.avatar_url || undefined} />
                    <AvatarFallback>
                      {participant.display_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 font-medium">
                    {participant.display_name}
                    {participant.id === currentParticipant.id && (
                      <span className="text-muted-foreground text-sm ml-2">(You)</span>
                    )}
                  </span>
                  {participant.is_host && (
                    <Badge variant="outline" className="text-primary border-primary">
                      Host
                    </Badge>
                  )}
                </div>
              ))}
            </div>

            {participants.length < 2 && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Waiting for more players to join...
              </p>
            )}
          </CardContent>
        </Card>

        {/* Game Settings Card */}
        <Card className="border border-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              <span>Game Settings</span>
              {isHost && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                  className="h-7 text-xs"
                >
                  Edit
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Songs per player</span>
              <span className="font-medium">{settings.songsRequired}</span>
            </div>
            {settings.christmasSongsRequired > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Christmas songs required</span>
                <Badge variant="secondary" className="text-xs bg-red-500/20 text-red-500">
                  {settings.christmasSongsRequired === settings.songsRequired ? 'All' : settings.christmasSongsRequired}
                </Badge>
              </div>
            )}
            {settings.chameleonMode && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode</span>
                <Badge variant="secondary" className="text-xs">Chameleon</Badge>
              </div>
            )}
            {settings.guessTimerSeconds && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Guess timer</span>
                <span className="font-medium">{settings.guessTimerSeconds}s</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Preview length</span>
              <span className="font-medium">{settings.previewLengthSeconds}s</span>
            </div>
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
          <div className="text-center text-muted-foreground">
            Waiting for host to start the game...
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <GameSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
        settings={settings}
        onSave={onUpdateSettings}
      />
    </main>
  )
}
