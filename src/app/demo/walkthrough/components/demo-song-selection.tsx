'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import { FestiveBackground } from '@/components/festive-background'
import {
  DEMO_ROOM,
  DEMO_SEARCH_RESULTS,
  DEMO_SELECTED_TRACKS,
} from '@/lib/demo-data'
import { Play } from 'lucide-react'

/**
 * Demo song selection view - mirrors the actual submission page
 */
export function DemoSongSelection() {
  const settings = DEMO_ROOM.settings
  const REQUIRED_SONGS = settings?.songsRequired || 5
  const REQUIRED_CHRISTMAS = settings?.christmasSongsRequired || 2
  const REQUIRED_RECENT = settings?.recentSongsRequired || 1
  const CHAMELEON_MODE = settings?.chameleonMode || false
  const CURRENT_YEAR = new Date().getFullYear()

  // Use 3 selected tracks for demo (partially filled)
  const selectedTracks = DEMO_SELECTED_TRACKS.slice(0, 3)
  const christmasSongCount = selectedTracks.filter(t => t.isLikelyChristmas).length
  const recentSongCount = selectedTracks.filter(t => t.releaseYear === CURRENT_YEAR).length
  const meetsChristmasRequirement = christmasSongCount >= REQUIRED_CHRISTMAS
  const meetsRecentRequirement = recentSongCount >= REQUIRED_RECENT
  const hasChameleonSelected = true // Mock - first track is chameleon

  return (
    <>
      <FestiveBackground showSnow={true} />
      <main className="flex min-h-screen flex-col p-4 pb-48">
        {/* Breadcrumbs */}
        <div className="max-w-6xl mx-auto w-full pt-2">
          <GameBreadcrumbs currentStage="submitting" />
        </div>

        {/* Room Info Header */}
        <div className="max-w-6xl mx-auto w-full mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-card/80 border border-border/50">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-bold">{DEMO_ROOM.name}</h1>
                <p className="text-xs text-muted-foreground font-mono">Code: {DEMO_ROOM.room_code}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1">
                <span>4</span>
                <span className="text-xs">(2 ready)</span>
              </Button>
              <Button variant="secondary" size="sm">
                Invite
              </Button>
            </div>
          </div>
        </div>

        {/* Progress Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur py-4 z-10 max-w-6xl mx-auto w-full">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold">Pick Your Songs</h1>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {selectedTracks.length}/{REQUIRED_SONGS}
            </Badge>
          </div>
          <Progress value={(selectedTracks.length / REQUIRED_SONGS) * 100} />
        </div>

        {/* Game Rules Explainer */}
        <div className="w-full max-w-6xl mx-auto mt-4">
          <div className="p-4 rounded-lg bg-card/90 backdrop-blur-md border border-white/10 space-y-2">
            <p className="text-sm">
              Pick songs that represent your taste — your friends will try to guess which ones are yours!
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {CHAMELEON_MODE && (
                <li className="flex items-start gap-2">
                  <span>+100 pts if others guess your chameleon&apos;s target</span>
                </li>
              )}
              {REQUIRED_CHRISTMAS > 0 && (
                <li className="flex items-start gap-2">
                  <span>At least {REQUIRED_CHRISTMAS} songs must be Christmas songs</span>
                </li>
              )}
              {REQUIRED_RECENT > 0 && (
                <li className="flex items-start gap-2">
                  <span>At least {REQUIRED_RECENT} song must be from {CURRENT_YEAR}</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6 mt-4">
          {/* Left Column - Search (3/5 width on large screens) */}
          <div className="lg:col-span-3 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Search for Songs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Start typing to search..."
                    defaultValue="christmas"
                    className="flex-1"
                  />
                  <Button variant="outline">
                    Search
                  </Button>
                </div>

                {/* Search Results */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {DEMO_SEARCH_RESULTS.map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                    >
                      {/* Album art with play button overlay */}
                      <div className="relative flex-shrink-0">
                        <img
                          src={track.albumArt || ''}
                          alt={track.name}
                          className="w-12 h-12 rounded"
                        />
                        <button
                          className="absolute inset-0 flex items-center justify-center bg-black/40 rounded opacity-0 hover:opacity-100 transition-opacity"
                        >
                          <Play className="w-4 h-4 text-white" />
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{track.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {track.releaseYear && <span>{track.releaseYear}</span>}
                          {track.albumName && (
                            <span className="truncate max-w-32">{track.albumName}</span>
                          )}
                        </div>
                      </div>

                      <Button size="sm" variant="outline">
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Selected Tracks (2/5 width on large screens) */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-24 space-y-4">
              <Card className="border-2 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    Your Selections
                    <Badge variant="secondary">{selectedTracks.length}/{REQUIRED_SONGS}</Badge>
                  </CardTitle>
                  {/* Christmas requirement indicator */}
                  {REQUIRED_CHRISTMAS > 0 && (
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Christmas songs</span>
                      <Badge
                        variant={meetsChristmasRequirement ? 'default' : 'destructive'}
                        className={meetsChristmasRequirement ? 'bg-green-600' : ''}
                      >
                        {christmasSongCount}/{REQUIRED_CHRISTMAS}
                      </Badge>
                    </div>
                  )}
                  {/* Recent songs requirement indicator */}
                  {REQUIRED_RECENT > 0 && (
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Songs from {CURRENT_YEAR}</span>
                      <Badge
                        variant={meetsRecentRequirement ? 'default' : 'destructive'}
                        className={meetsRecentRequirement ? 'bg-blue-600' : ''}
                      >
                        {recentSongCount}/{REQUIRED_RECENT}
                      </Badge>
                    </div>
                  )}
                  {/* Chameleon mode indicator */}
                  {CHAMELEON_MODE && (
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Chameleon pick</span>
                      <Badge
                        variant={hasChameleonSelected ? 'default' : 'outline'}
                        className={hasChameleonSelected ? 'bg-purple-600' : ''}
                      >
                        {hasChameleonSelected ? '1/1' : '0/1'}
                      </Badge>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {selectedTracks.map((track, index) => {
                      const isChristmas = track.isLikelyChristmas
                      const isChameleon = index === 0

                      return (
                        <div
                          key={track.id}
                          className={`flex items-center gap-2 p-2 rounded-lg ${
                            isChameleon
                              ? 'bg-purple-500/10 border border-purple-500/30'
                              : isChristmas
                                ? 'bg-green-500/10 border border-green-500/30'
                                : 'bg-muted/50'
                          }`}
                        >
                          <span className="text-sm text-muted-foreground w-5">{index + 1}.</span>
                          <div className="relative flex-shrink-0">
                            <img
                              src={track.albumArt || ''}
                              alt={track.name}
                              className="w-10 h-10 rounded ring-1 ring-border/40"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{track.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {REQUIRED_CHRISTMAS > 0 && (
                              <Button
                                variant={isChristmas ? 'default' : 'ghost'}
                                size="sm"
                                className={`h-7 w-7 p-0 ${isChristmas ? 'bg-green-600' : ''}`}
                              >
                                🎄
                              </Button>
                            )}
                            {CHAMELEON_MODE && (
                              <Button
                                variant={isChameleon ? 'default' : 'ghost'}
                                size="sm"
                                className={`h-7 w-7 p-0 ${isChameleon ? 'bg-purple-600' : ''}`}
                              >
                                🦎
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
