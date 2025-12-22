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

export function BackgroundMusicProvider({ children }: BackgroundMusicProviderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<MusicTrack>('home')
  const shouldPlayRef = useRef(true)
  const hasStartedRef = useRef(false)

  // Create audio element on mount
  useEffect(() => {
    const audio = new Audio(TRACK_URLS[currentTrack])
    audio.loop = true
    audio.volume = 0.3
    audioRef.current = audio

    // Try to play immediately (may be blocked by autoplay policy)
    audio.play().then(() => {
      setIsPlaying(true)
      hasStartedRef.current = true
    }).catch(() => {
      // Autoplay blocked - will start on first user interaction
    })

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
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }, [])

  const play = useCallback(() => {
    shouldPlayRef.current = true
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
