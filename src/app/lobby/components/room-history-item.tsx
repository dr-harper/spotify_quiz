'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { AlertTriangle, Trash2 } from 'lucide-react'
import type { Room } from '@/types/database'

interface RoomHistoryItemProps {
  room: Room
  isHost: boolean
  playerCount: number
  submittedCount: number
  lastActive: Date
  onDelete: (room: Room) => Promise<void>
  isDeleting: boolean
}

const STATUS_CONFIG: Record<string, { text: string; className: string }> = {
  LOBBY: { text: 'Lobby', className: 'bg-blue-500/20 text-blue-500' },
  SUBMITTING: { text: 'Picking Songs', className: 'bg-amber-500/20 text-amber-500' },
  PLAYING_ROUND_1: { text: 'Part 1', className: 'bg-green-500/20 text-green-500' },
  PLAYING_ROUND_2: { text: 'Part 2', className: 'bg-green-500/20 text-green-500' },
  TRIVIA: { text: 'Trivia', className: 'bg-purple-500/20 text-purple-500' },
  default: { text: 'Finished', className: 'bg-muted text-muted-foreground' },
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function RoomHistoryItem({
  room,
  isHost,
  playerCount,
  submittedCount,
  lastActive,
  onDelete,
  isDeleting,
}: RoomHistoryItemProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)

  const hasUnfinishedSubmissions = room.status !== 'RESULTS' && submittedCount > 0
  const statusDisplay = STATUS_CONFIG[room.status] || STATUS_CONFIG.default

  const handleNavigate = () => {
    router.push(`/room/${room.room_code}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleNavigate()
    }
  }

  const handleDelete = async () => {
    await onDelete(room)
    setDialogOpen(false)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-border/50 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="font-semibold text-sm leading-tight">
            {room.name || 'Untitled lobby'}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono font-bold">
              {room.room_code}
            </span>
            <span>·</span>
            <span>{playerCount} {playerCount === 1 ? 'player' : 'players'}</span>
            <span>·</span>
            <span>{getRelativeTime(lastActive)}</span>
          </div>
          {hasUnfinishedSubmissions && (
            <div className="mt-1 inline-flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              <span>
                {submittedCount} {submittedCount === 1 ? 'player has' : 'players have'} submitted answers
                — quiz not finished
              </span>
            </div>
          )}
        </div>
        {isHost && (
          <span className="text-xs text-primary">(Host)</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-1 rounded-full ${statusDisplay.className}`}>
          {statusDisplay.text}
        </span>
        {isHost && (
          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                title="Delete lobby"
                aria-label="Delete lobby"
                onClick={(e) => e.stopPropagation()}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this lobby?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the lobby and its history for all players.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  )
}
