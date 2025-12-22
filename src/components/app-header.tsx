'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function AppHeader() {
  const [user, setUser] = useState<User | null>(null)
  const [userMeta, setUserMeta] = useState<{ name: string; avatar: string | null; isGuest: boolean }>({ name: '', avatar: null, isGuest: false })
  const [isLoading, setIsLoading] = useState(true)
  const [showAbout, setShowAbout] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        const meta = user.user_metadata
        setUserMeta({
          name: meta?.full_name || meta?.name || user.email || 'Player',
          avatar: meta?.avatar_url || meta?.picture || null,
          isGuest: user.is_anonymous || meta?.is_guest || false,
        })
      }
      setIsLoading(false)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        const meta = session.user.user_metadata
        setUserMeta({
          name: meta?.full_name || meta?.name || session.user.email || 'Player',
          avatar: meta?.avatar_url || meta?.picture || null,
          isGuest: session.user.is_anonymous || meta?.is_guest || false,
        })
      } else {
        setUser(null)
        setUserMeta({ name: '', avatar: null, isGuest: false })
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleConnectSpotify = async () => {
    setIsConnecting(true)
    const { error } = await supabase.auth.linkIdentity({
      provider: 'spotify',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'user-read-email user-read-private playlist-modify-private playlist-modify-public',
      },
    })
    if (error) {
      console.error('Error connecting Spotify:', error)
      setIsConnecting(false)
    }
  }

  const handleLogoClick = () => {
    if (user) {
      router.push('/lobby')
    } else {
      router.push('/')
    }
  }

  const handleSeedTestData = async () => {
    setIsSeeding(true)
    try {
      const response = await fetch('/api/seed-test', { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        alert(`Test room created! Code: ${data.roomCode}\n${data.message}`)
        router.push(`/room/${data.roomCode}`)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      alert(`Error: ${error}`)
    } finally {
      setIsSeeding(false)
    }
  }

  // Don't show header on the landing page
  if (pathname === '/') {
    return null
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-6xl mx-auto items-center px-4">
        {/* Logo / Title */}
        <button
          onClick={handleLogoClick}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <span className="text-xl">*</span>
          <span className="font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            Festive Frequencies
          </span>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User info & Menu */}
        {!isLoading && user && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium hidden sm:inline">{userMeta.name}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={userMeta.avatar || undefined} alt={userMeta.name} />
                    <AvatarFallback className="text-xs">
                      {userMeta.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {userMeta.isGuest && (
                  <>
                    <DropdownMenuItem
                      onClick={handleConnectSpotify}
                      disabled={isConnecting}
                      className="text-[#1DB954]"
                    >
                      {isConnecting ? 'Connecting...' : 'Connect Spotify'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => setShowAbout(true)}>
                  About
                </DropdownMenuItem>
                {process.env.NODE_ENV !== 'production' && (
                  <DropdownMenuItem
                    onClick={handleSeedTestData}
                    disabled={isSeeding}
                    className="text-amber-500"
                  >
                    {isSeeding ? 'Creating...' : 'Create Test Game'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* About Dialog */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">*</span>
              Festive Frequencies
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-4 pt-4">
                <p>
                  Build a collaborative playlist with friends, then play a guessing game to see who knows each other&apos;s music taste best!
                </p>
                <div className="space-y-2 text-sm">
                  <p><strong>How it works:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Everyone secretly picks their favourite songs</li>
                    <li>All songs get shuffled into one shared playlist</li>
                    <li>Listen together and guess who picked each track</li>
                    <li>Score points for knowing your friends&apos; taste!</li>
                  </ol>
                </div>
                <div className="pt-2 text-xs text-muted-foreground">
                  <p>Save the playlist to Spotify when you&apos;re done.</p>
                  <p className="mt-2">Made with festive cheer 🎄</p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </header>
  )
}
