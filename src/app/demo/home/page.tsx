'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import { FestiveBackground } from '@/components/festive-background'
import { LOBBY_NAME_MAX_LENGTH } from '@/constants/rooms'

/**
 * Demo page for the home/join screen - used for screenshots
 * Access at /demo/home
 */
export default function DemoHomePage() {
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
                  placeholder="e.g. Christmas Party 2024"
                  defaultValue="Christmas Party 2024"
                  maxLength={LOBBY_NAME_MAX_LENGTH}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground text-right">
                  20/{LOBBY_NAME_MAX_LENGTH} characters
                </p>
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
                <Label htmlFor="join-code" className="text-sm">Room code</Label>
                <Input
                  id="join-code"
                  placeholder="e.g. JINGLE"
                  defaultValue="JINGLE"
                  className="h-12 text-lg text-center tracking-widest font-mono"
                  maxLength={6}
                />
              </div>
              <Button
                variant="secondary"
                className="w-full h-12 text-lg"
              >
                Join Room
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Sessions Mock */}
        <Card className="border border-muted mt-6 max-w-md mx-auto lg:max-w-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <button className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm leading-tight">
                      Office Party
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-mono font-bold">SNOW42</span>
                      <span>·</span>
                      <span>6 players</span>
                      <span>·</span>
                      <span>2h ago</span>
                    </div>
                  </div>
                  <span className="text-xs text-primary">(Host)</span>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  Finished
                </span>
              </button>
              <button className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm leading-tight">
                      Family Quiz
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-mono font-bold">BELLS7</span>
                      <span>·</span>
                      <span>4 players</span>
                      <span>·</span>
                      <span>1d ago</span>
                    </div>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  Finished
                </span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
