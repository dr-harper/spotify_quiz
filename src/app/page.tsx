'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { FestiveBackground } from '@/components/festive-background'
import { useBackgroundMusic } from '@/components/background-music'

export default function Home() {
  const [isLoading, setIsLoading] = useState(false)
  const [isGuestLoading, setIsGuestLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [guestName, setGuestName] = useState('')
  const [showGuestForm, setShowGuestForm] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { isPlaying, stop, play } = useBackgroundMusic()

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/lobby')
      } else {
        setIsCheckingAuth(false)
      }
    }
    checkAuth()
  }, [router, supabase.auth])

  const handleSpotifyLogin = async () => {
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'spotify',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'user-read-email user-read-private playlist-modify-private playlist-modify-public',
      },
    })
    if (error) {
      console.error('Login error:', error)
      setIsLoading(false)
    }
  }

  const handleGuestLogin = async () => {
    if (!guestName.trim()) return
    setIsGuestLoading(true)

    try {
      // Sign in anonymously
      const { data, error } = await supabase.auth.signInAnonymously()

      if (error) throw error

      // Update the user's metadata with their chosen name
      if (data.user) {
        await supabase.auth.updateUser({
          data: {
            full_name: guestName.trim(),
            is_guest: true,
          }
        })
      }

      router.push('/lobby')
    } catch (error) {
      console.error('Guest login error:', error)
      setIsGuestLoading(false)
    }
  }

  if (isCheckingAuth) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="animate-pulse text-2xl">Loading...</div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 py-6 relative">
      <FestiveBackground />

      <Card className="w-full max-w-md border-2 border-primary/20 shadow-xl shadow-primary/10 relative z-10 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-2 sm:space-y-4 pb-2 sm:pb-6">
          <div className="text-4xl sm:text-6xl mb-1 sm:mb-2 animate-bounce">🎵</div>
          <CardTitle className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            Festive Frequencies
          </CardTitle>
          <CardDescription className="text-base sm:text-lg text-muted-foreground">
            The Christmas music guessing game
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="text-center space-y-2 sm:space-y-4 text-sm text-muted-foreground">
            <p>
              <span className="text-secondary font-semibold">1.</span> Join a room with friends
            </p>
            <p>
              <span className="text-secondary font-semibold">2.</span> Each person picks 10 songs
            </p>
            <p>
              <span className="text-secondary font-semibold">3.</span> Guess who gifted each tune!
            </p>
          </div>

          {/* Guest Login Form */}
          {showGuestForm ? (
            <div className="space-y-3">
              <Input
                placeholder="Enter your name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGuestLogin()}
                className="h-12 text-lg text-center"
                maxLength={20}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowGuestForm(false)}
                  className="flex-1 h-12"
                  disabled={isGuestLoading}
                >
                  Back
                </Button>
                <Button
                  onClick={handleGuestLogin}
                  disabled={!guestName.trim() || isGuestLoading}
                  className="flex-1 h-12"
                >
                  {isGuestLoading ? 'Joining...' : 'Join as Guest'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Spotify Login */}
              <Button
                onClick={handleSpotifyLogin}
                disabled={isLoading}
                className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold bg-[#1DB954] hover:bg-[#1ed760] text-white"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Connecting...
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                    Login with Spotify
                  </span>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              {/* Guest Option */}
              <Button
                variant="outline"
                onClick={() => setShowGuestForm(true)}
                className="w-full h-10 sm:h-12"
              >
                Continue as Guest
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Spotify login enables saving playlists to your account
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <footer className="absolute bottom-4 text-sm text-muted-foreground z-10">
        Made with festive cheer 🎄
      </footer>

      {/* Music Toggle Button */}
      <button
        onClick={() => isPlaying ? stop() : play()}
        className="fixed bottom-4 right-4 z-20 p-3 rounded-full bg-card/80 backdrop-blur-sm border border-border hover:bg-card transition-colors"
        aria-label={isPlaying ? 'Mute music' : 'Play music'}
      >
        {isPlaying ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        )}
      </button>
    </main>
  )
}
