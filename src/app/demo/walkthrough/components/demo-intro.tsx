'use client'

import { LobbyView } from '@/app/room/[code]/components/lobby-view'
import { FestiveBackground } from '@/components/festive-background'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import {
  DEMO_ROOM,
  DEMO_PARTICIPANTS,
  DEMO_CURRENT_PARTICIPANT,
} from '@/lib/demo-data'
import { useWalkthrough } from './walkthrough-provider'

// Import the actual home page content
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function DemoIntro() {
  const { currentStep } = useWalkthrough()

  // Home screen - shows the create/join room page (lobby)
  if (currentStep.id === 'home') {
    return (
      <main className="flex min-h-screen flex-col items-center p-4 py-8 pb-48">
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
                  <label className="text-sm">Lobby name (optional)</label>
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="e.g. Christmas Quiz"
                    defaultValue="Christmas Quiz"
                  />
                </div>
                <Button className="w-full h-12 text-lg">
                  Create Room
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
                  <label className="text-sm">Room code</label>
                  <input
                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-lg text-center tracking-widest font-mono"
                    placeholder="e.g. JING42"
                    defaultValue=""
                  />
                </div>
                <Button variant="secondary" className="w-full h-12 text-lg">
                  Join Room
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Sessions */}
          <Card className="border border-muted mt-6 max-w-md mx-auto lg:max-w-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <button className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left border border-border/50">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Family Quiz Night</span>
                    <span className="text-xs text-muted-foreground font-mono">XMAS24 · 6 players · 2h ago</span>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-500">Part 1</span>
                </button>
                <button className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left border border-border/50">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Office Party</span>
                    <span className="text-xs text-muted-foreground font-mono">WORK99 · 8 players · 1d ago</span>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">Finished</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  // Lobby screen - use the actual LobbyView component
  if (currentStep.id === 'lobby') {
    return (
      <div className="pb-48">
        <FestiveBackground showSnow={true} />
        <LobbyView
          room={DEMO_ROOM}
          participants={DEMO_PARTICIPANTS}
          currentParticipant={DEMO_CURRENT_PARTICIPANT}
          onStartGame={() => {}}
          onPickSongs={() => {}}
          onUpdateRoomName={() => {}}
          onRemoveParticipant={async () => {}}
        />
      </div>
    )
  }

  return null
}
