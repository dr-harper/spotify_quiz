'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { Participant, Submission } from '@/types/database'

interface SubmissionWithParticipant extends Submission {
  participant: Participant
}

interface SongLibraryProps {
  roomId: string
  roomCode: string
  submissions: SubmissionWithParticipant[]
  hasSpotify: boolean
  onClose?: () => void
}

function formatDuration(ms: number | null): string {
  if (!ms) return '-'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function SongLibrary({
  roomId,
  roomCode,
  submissions,
  hasSpotify,
  onClose,
}: SongLibraryProps) {
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'submitter' | 'name' | 'year' | 'popularity'>('submitter')
  const [sortAsc, setSortAsc] = useState(true)

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortAsc(!sortAsc)
    } else {
      setSortBy(column)
      setSortAsc(true)
    }
  }

  const sortedSubmissions = [...submissions].sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'submitter':
        comparison = a.participant.display_name.localeCompare(b.participant.display_name)
        break
      case 'name':
        comparison = a.track_name.localeCompare(b.track_name)
        break
      case 'year':
        comparison = (a.release_year || 0) - (b.release_year || 0)
        break
      case 'popularity':
        comparison = (a.popularity || 0) - (b.popularity || 0)
        break
    }
    return sortAsc ? comparison : -comparison
  })

  const handleCreatePlaylist = async () => {
    setIsCreatingPlaylist(true)
    try {
      const response = await fetch('/api/spotify/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          playlistName: `Festive Frequencies - ${roomCode}`,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setPlaylistUrl(data.playlistUrl)
      } else {
        alert(data.error || 'Failed to create playlist')
      }
    } catch (error) {
      console.error('Playlist error:', error)
      alert('Failed to create playlist')
    } finally {
      setIsCreatingPlaylist(false)
    }
  }

  // Group by participant for summary stats
  const participantStats = submissions.reduce((acc, sub) => {
    const pid = sub.participant.id
    if (!acc[pid]) {
      acc[pid] = {
        participant: sub.participant,
        count: 0,
        avgPopularity: 0,
        popCount: 0,
      }
    }
    acc[pid].count++
    if (sub.popularity) {
      acc[pid].avgPopularity += sub.popularity
      acc[pid].popCount++
    }
    return acc
  }, {} as Record<string, { participant: Participant; count: number; avgPopularity: number; popCount: number }>)

  // Calculate averages
  Object.values(participantStats).forEach(stat => {
    if (stat.popCount > 0) stat.avgPopularity = stat.avgPopularity / stat.popCount
  })

  const SortHeader = ({ column, children }: { column: typeof sortBy; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(column)}
    >
      <span className="flex items-center gap-1">
        {children}
        {sortBy === column && (
          <span className="text-xs">{sortAsc ? '↑' : '↓'}</span>
        )}
      </span>
    </TableHead>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Song Library</h2>
          <p className="text-muted-foreground">{submissions.length} songs submitted</p>
        </div>
        <div className="flex gap-2">
          {playlistUrl ? (
            <Button asChild className="bg-[#1DB954] hover:bg-[#1ed760] text-white">
              <a href={playlistUrl} target="_blank" rel="noopener noreferrer">
                Open in Spotify
              </a>
            </Button>
          ) : hasSpotify ? (
            <Button
              onClick={handleCreatePlaylist}
              disabled={isCreatingPlaylist}
              className="bg-[#1DB954] hover:bg-[#1ed760] text-white"
            >
              {isCreatingPlaylist ? 'Creating...' : 'Create Playlist'}
            </Button>
          ) : (
            <Badge variant="outline">Login with Spotify to create playlist</Badge>
          )}
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Participant Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.values(participantStats).map(({ participant, count, avgPopularity, popCount }) => (
          <Card key={participant.id} className="p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 flex-shrink-0">
                <AvatarImage src={participant.avatar_url || undefined} />
                <AvatarFallback>
                  {participant.display_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold truncate">{participant.display_name}</span>
                  {participant.mood_tag && (
                    <Badge variant="secondary" className="text-xs">
                      {participant.mood_tag}
                    </Badge>
                  )}
                </div>
                {participant.ai_summary && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {participant.ai_summary}
                  </p>
                )}
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{count} songs</span>
                  {popCount > 0 && (
                    <span>Avg popularity: {Math.round(avgPopularity)}</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Songs Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <SortHeader column="submitter">Submitted by</SortHeader>
                  <SortHeader column="name">Song</SortHeader>
                  <TableHead>Artist</TableHead>
                  <SortHeader column="year">Year</SortHeader>
                  <TableHead>Duration</TableHead>
                  <SortHeader column="popularity">Popularity</SortHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSubmissions.map((sub, index) => (
                  <TableRow key={sub.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={sub.participant.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {sub.participant.display_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate max-w-24">
                          {sub.participant.display_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {sub.album_art_url && (
                          <img
                            src={sub.album_art_url}
                            alt=""
                            className="w-8 h-8 rounded flex-shrink-0"
                          />
                        )}
                        <span className="font-medium truncate max-w-40" title={sub.track_name}>
                          {sub.track_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="truncate max-w-32" title={sub.artist_name}>
                      {sub.artist_name}
                    </TableCell>
                    <TableCell>{sub.release_year || '-'}</TableCell>
                    <TableCell>{formatDuration(sub.duration_ms)}</TableCell>
                    <TableCell>
                      {sub.popularity !== null ? (
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${sub.popularity}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{sub.popularity}</span>
                        </div>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
