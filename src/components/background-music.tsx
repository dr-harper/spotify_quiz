'use client'

import { createContext, useContext, useRef, useEffect, useState, useCallback } from 'react'

interface BackgroundMusicContextType {
  isPlaying: boolean
  stop: () => void
  play: () => void
}

const BackgroundMusicContext = createContext<BackgroundMusicContextType>({
  isPlaying: false,
  stop: () => {},
  play: () => {},
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
  const shouldPlayRef = useRef(true) // Track if we want music playing
  const hasStartedRef = useRef(false) // Track if we've successfully started

  // Create audio element on mount
  useEffect(() => {
    const audio = new Audio('/lobby-music.mp3')
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

  return (
    <BackgroundMusicContext.Provider value={{ isPlaying, stop, play }}>
      {children}
    </BackgroundMusicContext.Provider>
  )
}
