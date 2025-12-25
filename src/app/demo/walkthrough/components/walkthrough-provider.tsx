'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  DEMO_STEPS,
  DEMO_CHARACTERS,
  DEMO_SONG_LIBRARY,
  DEMO_QUIZ_ROUNDS,
  getPhaseFromStepIndex,
  type DemoStep,
  type DemoTrack,
  type DemoCharacter,
} from '@/lib/demo-walkthrough-data'

interface WalkthroughState {
  // Step management
  currentStepIndex: number
  currentStep: DemoStep
  totalSteps: number
  phase: DemoStep['phase']

  // Song selection mock state
  mockSearchQuery: string
  mockSearchResults: DemoTrack[]
  mockSelectedTracks: DemoTrack[]

  // Quiz mock state
  currentQuizRoundIndex: number
  userVote: string | null
  showingAnswer: boolean
  correctGuesses: number
  score: number

  // Characters
  characters: DemoCharacter[]
  getCharacter: (id: string) => DemoCharacter | undefined
}

interface WalkthroughActions {
  nextStep: () => void
  prevStep: () => void
  skipDemo: () => void
  goToStep: (index: number) => void

  // Song selection actions
  setSearchQuery: (query: string) => void
  addTrack: (track: DemoTrack) => void
  removeTrack: (trackId: string) => void

  // Quiz actions
  submitVote: (participantId: string) => void
  revealAnswer: () => void
  nextQuizRound: () => void
}

type WalkthroughContextType = WalkthroughState & WalkthroughActions

const WalkthroughContext = createContext<WalkthroughContextType | null>(null)

export function useWalkthrough() {
  const context = useContext(WalkthroughContext)
  if (!context) {
    throw new Error('useWalkthrough must be used within a WalkthroughProvider')
  }
  return context
}

interface WalkthroughProviderProps {
  children: React.ReactNode
}

export function WalkthroughProvider({ children }: WalkthroughProviderProps) {
  const router = useRouter()

  // Step management
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const currentStep = DEMO_STEPS[currentStepIndex] || DEMO_STEPS[0]
  const phase = getPhaseFromStepIndex(currentStepIndex)

  // Song selection mock state
  const [mockSearchQuery, setMockSearchQuery] = useState('')
  const [mockSearchResults, setMockSearchResults] = useState<DemoTrack[]>([])
  const [mockSelectedTracks, setMockSelectedTracks] = useState<DemoTrack[]>([])

  // Quiz mock state
  const [currentQuizRoundIndex, setCurrentQuizRoundIndex] = useState(0)
  const [userVote, setUserVote] = useState<string | null>(null)
  const [showingAnswer, setShowingAnswer] = useState(false)
  const [correctGuesses, setCorrectGuesses] = useState(0)
  const [score, setScore] = useState(0)

  // Get character helper
  const getCharacter = useCallback((id: string) => {
    return DEMO_CHARACTERS.find(c => c.id === id)
  }, [])

  // Update search results when query changes
  useEffect(() => {
    if (!mockSearchQuery.trim()) {
      setMockSearchResults([])
      return
    }

    const lowerQuery = mockSearchQuery.toLowerCase()
    const results = DEMO_SONG_LIBRARY.filter(
      track =>
        track.name.toLowerCase().includes(lowerQuery) ||
        track.artist.toLowerCase().includes(lowerQuery)
    ).slice(0, 5)

    setMockSearchResults(results)
  }, [mockSearchQuery])

  // Auto-advance handling
  useEffect(() => {
    if (currentStep.action === 'auto-advance' && currentStep.autoAdvanceMs) {
      const timer = setTimeout(() => {
        setCurrentStepIndex(prev => {
          if (prev < DEMO_STEPS.length - 1) {
            return prev + 1
          }
          return prev
        })
      }, currentStep.autoAdvanceMs)
      return () => clearTimeout(timer)
    }
  }, [currentStepIndex, currentStep.action, currentStep.autoAdvanceMs])

  // Pre-populate data when reaching song selection step
  useEffect(() => {
    if (currentStep.id === 'song-selection') {
      // Set search query and results
      setMockSearchQuery('Oasis')
      // Add user's demo songs as selected
      const userCharacter = DEMO_CHARACTERS.find(c => c.id === 'user')
      if (userCharacter && mockSelectedTracks.length === 0) {
        setMockSelectedTracks(userCharacter.songs.slice(0, 3))
      }
    }
  }, [currentStep.id, mockSelectedTracks.length])

  // Navigation actions
  const nextStep = useCallback(() => {
    if (currentStepIndex < DEMO_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1)
    } else {
      // Demo complete
      router.push('/')
    }
  }, [currentStepIndex, router])

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1)
    }
  }, [currentStepIndex])

  const skipDemo = useCallback(() => {
    router.push('/')
  }, [router])

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < DEMO_STEPS.length) {
      setCurrentStepIndex(index)
    }
  }, [])

  // Song selection actions
  const setSearchQuery = useCallback((query: string) => {
    setMockSearchQuery(query)
  }, [])

  const addTrack = useCallback((track: DemoTrack) => {
    setMockSelectedTracks(prev => {
      if (prev.find(t => t.id === track.id)) return prev
      return [...prev, track]
    })
  }, [])

  const removeTrack = useCallback((trackId: string) => {
    setMockSelectedTracks(prev => prev.filter(t => t.id !== trackId))
  }, [])

  // Quiz actions
  const submitVote = useCallback((participantId: string) => {
    setUserVote(participantId)
    const currentRound = DEMO_QUIZ_ROUNDS[currentQuizRoundIndex]
    if (currentRound && participantId === currentRound.owner.id) {
      setCorrectGuesses(prev => prev + 1)
      setScore(prev => prev + 100)
    }
    // Auto-advance to voted step
    setCurrentStepIndex(prev => {
      if (prev < DEMO_STEPS.length - 1) {
        return prev + 1
      }
      return prev
    })
  }, [currentQuizRoundIndex])

  const revealAnswer = useCallback(() => {
    setShowingAnswer(true)
  }, [])

  const nextQuizRound = useCallback(() => {
    if (currentQuizRoundIndex < DEMO_QUIZ_ROUNDS.length - 1) {
      setCurrentQuizRoundIndex(prev => prev + 1)
      setUserVote(null)
      setShowingAnswer(false)
    }
  }, [currentQuizRoundIndex])

  const value: WalkthroughContextType = {
    // State
    currentStepIndex,
    currentStep,
    totalSteps: DEMO_STEPS.length,
    phase,
    mockSearchQuery,
    mockSearchResults,
    mockSelectedTracks,
    currentQuizRoundIndex,
    userVote,
    showingAnswer,
    correctGuesses,
    score,
    characters: DEMO_CHARACTERS,
    getCharacter,

    // Actions
    nextStep,
    prevStep,
    skipDemo,
    goToStep,
    setSearchQuery,
    addTrack,
    removeTrack,
    submitVote,
    revealAnswer,
    nextQuizRound,
  }

  return (
    <WalkthroughContext.Provider value={value}>
      {children}
    </WalkthroughContext.Provider>
  )
}
