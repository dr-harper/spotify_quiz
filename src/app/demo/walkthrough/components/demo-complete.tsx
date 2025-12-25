'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { FestiveBackground } from '@/components/festive-background'
import { useWalkthrough } from './walkthrough-provider'
import { Trophy, Music, Home } from 'lucide-react'
import Link from 'next/link'

export function DemoComplete() {
  const { characters, score } = useWalkthrough()

  // Create mock leaderboard
  const leaderboard = [
    { ...characters[3], score: 450 }, // Stephen Fry
    { ...characters[1], score: 380 }, // David Attenborough
    { ...characters.find(c => c.id === 'user')!, score: score || 300, isYou: true },
    { ...characters[2], score: 250 }, // Judi Dench
    { ...characters[0], score: 180 }, // Churchill
  ].sort((a, b) => b.score - a.score)

  const medals = ['🥇', '🥈', '🥉']

  return (
    <>
      <FestiveBackground showSnow={true} />
      <main className="flex min-h-screen flex-col p-4 pb-48">
        <div className="max-w-2xl mx-auto w-full space-y-4 pt-4">
          {/* Winner announcement */}
          <Card className="bg-gradient-to-b from-yellow-500/20 to-transparent border-yellow-500/30">
            <CardContent className="p-6 text-center">
              <Trophy className="h-12 w-12 mx-auto text-yellow-500 mb-3" />
              <h1 className="text-2xl font-bold mb-1">Game Complete!</h1>
              <p className="text-muted-foreground">
                {leaderboard[0].displayName} wins with {leaderboard[0].score} points!
              </p>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Final Scores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {leaderboard.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    'isYou' in player && player.isYou
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-muted/30'
                  }`}
                >
                  <span className="text-xl w-8 text-center">
                    {index < 3 ? medals[index] : `${index + 1}.`}
                  </span>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={player.avatarUrl} />
                    <AvatarFallback>{player.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">
                      {player.displayName}
                      {'isYou' in player && player.isYou && (
                        <span className="text-primary ml-1">(You)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{player.moodTag}</p>
                  </div>
                  <Badge variant="secondary" className="text-lg px-3">
                    {player.score}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Playlist saved */}
          <Card className="bg-[#1DB954]/10 border-[#1DB954]/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded bg-[#1DB954] flex items-center justify-center">
                <Music className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Playlist Saved!</p>
                <p className="text-sm text-muted-foreground">
                  25 songs added to your Spotify
                </p>
              </div>
              <Button variant="outline" size="sm">
                Open
              </Button>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="pt-4 space-y-3">
            <Link href="/" className="block">
              <Button className="w-full h-12 text-lg" size="lg">
                Create Your Own Room
              </Button>
            </Link>
            <Link href="/" className="block">
              <Button variant="outline" className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
