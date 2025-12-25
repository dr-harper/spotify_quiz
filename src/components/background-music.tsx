'use client'

import { createContext, useContext, useRef, useEffect, useState, useCallback } from 'react'

type MusicTrack = 'home' | 'app'

interface BackgroundMusicContextType {
  isPlaying: boolean
  currentTrack: MusicTrack
  stop: () => void
  play: () => void
  setTrack: (track: MusicTrack) => void
}

const TRACK_URLS: Record<MusicTrack, string> = {
  home: '/lobby-music.mp3',  // Festive music for home page
  app: '/app-music.mp3',     // Easy breeze for in-app
}

const STORAGE_KEY = 'festive-frequencies-music-enabled'

const BackgroundMusicContext = createContext<BackgroundMusicContextType>({
  isPlaying: false,
  currentTrack: 'home',
  stop: () => {},
  play: () => {},
  setTrack: () => {},
})

export function useBackgroundMusic() {
  return useContext(BackgroundMusicContext)
}

interface BackgroundMusicProviderProps {
  children: React.ReactNode
}

// Helper to safely read from localStorage
function getMusicPreference(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    // Default to true (music on) if no preference stored
    return stored === null ? true : stored === 'true'
  } catch {
    return true
  }
}

// Helper to safely write to localStorage
function saveMusicPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch {
    // Ignore storage errors (e.g., private browsing)
  }
}

export function BackgroundMusicProvider({ children }: BackgroundMusicProviderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<MusicTrack>('home')
  // Initialise from localStorage preference
  const shouldPlayRef = useRef(getMusicPreference())
  const hasStartedRef = useRef(false)

  // Create audio element on mount
  useEffect(() => {
    const audio = new Audio(TRACK_URLS[currentTrack])
    audio.loop = true
    audio.volume = 0.3
    audioRef.current = audio

    // Only try to autoplay if the user hasn't muted
    if (shouldPlayRef.current) {
      // Try to play immediately (may be blocked by autoplay policy)
      audio.play().then(() => {
        setIsPlaying(true)
        hasStartedRef.current = true
      }).catch(() => {
        // Autoplay blocked - will start on first user interaction
      })
    }

    // Start music on first user interaction if autoplay was blocked
    const handleInteraction = () => {
      if (!hasStartedRef.current && audioRef.current && shouldPlayRef.current) {
        audioRef.current.play().then(() => {
          setIsPlaying(true)
          hasStartedRef.current = true
        }).catch(() => {})
      }
    }

    // Listen for any interaction
    document.addEventListener('click', handleInteraction)
    document.addEventListener('touchstart', handleInteraction)
    document.addEventListener('keydown', handleInteraction)

    return () => {
      audio.pause()
      audio.src = ''
      document.removeEventListener('click', handleInteraction)
      document.removeEventListener('touchstart', handleInteraction)
      document.removeEventListener('keydown', handleInteraction)
    }
  }, [])

  // Handle track changes with crossfade
  useEffect(() => {
    if (audioRef.current && audioRef.current.src.includes(TRACK_URLS[currentTrack].slice(1))) {
      // Already playing this track
      return
    }

    if (audioRef.current) {
      const oldAudio = audioRef.current
      const wasPlaying = !oldAudio.paused
      const oldVolume = oldAudio.volume

      if (wasPlaying && shouldPlayRef.current) {
        // Create new audio for crossfade
        const newAudio = new Audio(TRACK_URLS[currentTrack])
        newAudio.loop = true
        newAudio.volume = 0

        // Start playing new track
        newAudio.play().then(() => {
          // Crossfade over 1 second
          const fadeSteps = 20
          const fadeInterval = 50 // 50ms intervals = 1 second total
          let step = 0

          const fadeTimer = setInterval(() => {
            step++
            const progress = step / fadeSteps

            // Fade out old, fade in new
            oldAudio.volume = Math.max(0, oldVolume * (1 - progress))
            newAudio.volume = Math.min(0.3, 0.3 * progress)

            if (step >= fadeSteps) {
              clearInterval(fadeTimer)
              oldAudio.pause()
              oldAudio.src = ''
              audioRef.current = newAudio
              setIsPlaying(true)
            }
          }, fadeInterval)
        }).catch(() => {
          // Fallback: just switch immediately
          oldAudio.src = TRACK_URLS[currentTrack]
          oldAudio.play().catch(() => {})
        })
      } else {
        // Not playing, just update source
        oldAudio.src = TRACK_URLS[currentTrack]
      }
    }
  }, [currentTrack])

  const stop = useCallback(() => {
    shouldPlayRef.current = false
    saveMusicPreference(false)
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }, [])

  const play = useCallback(() => {
    shouldPlayRef.current = true
    saveMusicPreference(true)
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true)
        hasStartedRef.current = true
      }).catch(() => {})
    }
  }, [])

  const setTrack = useCallback((track: MusicTrack) => {
    setCurrentTrack(track)
  }, [])

  return (
    <BackgroundMusicContext.Provider value={{ isPlaying, currentTrack, stop, play, setTrack }}>
      {children}
    </BackgroundMusicContext.Provider>
  )
}
