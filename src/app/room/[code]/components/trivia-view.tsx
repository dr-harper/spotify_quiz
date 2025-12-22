'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import { createClient } from '@/lib/supabase/client'
import type { Room, Participant, TriviaQuestion } from '@/types/database'
import { DEFAULT_GAME_SETTINGS } from '@/types/database'

interface TriviaViewProps {
  room: Room
  participants: Participant[]
  currentParticipant: Participant
  onTriviaEnd: () => void
  onNavigateToLobby: () => void
}

export function TriviaView({
  room,
  participants,
  currentParticipant,
  onTriviaEnd,
  onNavigateToLobby,
}: TriviaViewProps) {
  const settings = room.settings || DEFAULT_GAME_SETTINGS
  const [questions, setQuestions] = useState<TriviaQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState<number>(15)
  const [score, setScore] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()
  const isHost = currentParticipant.is_host

  // Fetch or generate trivia questions
  const initTrivia = useCallback(async () => {
    // First, try to fetch existing questions
    const { data: existingQuestions } = await supabase
      .from('trivia_questions')
      .select('*')
      .eq('room_id', room.id)
      .order('question_number', { ascending: true })

    if (existingQuestions && existingQuestions.length > 0) {
      setQuestions(existingQuestions as TriviaQuestion[])
      setIsLoading(false)
      return
    }

    // If host, generate questions
    if (isHost) {
      try {
        const response = await fetch('/api/trivia/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: room.id,
            questionCount: settings.triviaQuestionCount || 10,
          }),
        })

        if (response.ok) {
          // Fetch the generated questions
          const { data } = await supabase
            .from('trivia_questions')
            .select('*')
            .eq('room_id', room.id)
            .order('question_number', { ascending: true })

          if (data) {
            setQuestions(data as TriviaQuestion[])
          }
        }
      } catch (error) {
        console.error('Failed to generate trivia:', error)
      }
    } else {
      // Non-host: poll for questions
      const pollForQuestions = async () => {
        const { data } = await supabase
          .from('trivia_questions')
          .select('*')
          .eq('room_id', room.id)
          .order('question_number', { ascending: true })

        if (data && data.length > 0) {
          setQuestions(data as TriviaQuestion[])
          setIsLoading(false)
        } else {
          setTimeout(pollForQuestions, 1000)
        }
      }
      pollForQuestions()
      return
    }

    setIsLoading(false)
  }, [room.id, isHost, settings.triviaQuestionCount, supabase])

  useEffect(() => {
    initTrivia()
  }, [initTrivia])

  // Timer countdown
  useEffect(() => {
    if (isLoading || questions.length === 0 || hasAnswered || showResult) {
      return
    }

    setTimeRemaining(15)

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          // Time's up - auto submit with no answer
          handleAnswer(null)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [currentQuestionIndex, isLoading, questions.length, hasAnswered, showResult])

  // Listen for question sync from host
  useEffect(() => {
    if (!room.id) return

    const channel = supabase
      .channel(`trivia-sync:${room.id}`)
      .on('broadcast', { event: 'next_question' }, ({ payload }) => {
        if (payload.questionIndex !== undefined) {
          setCurrentQuestionIndex(payload.questionIndex)
          setSelectedAnswer(null)
          setHasAnswered(false)
          setShowResult(false)
        }
      })
      .on('broadcast', { event: 'show_result' }, () => {
        setShowResult(true)
      })
      .on('broadcast', { event: 'trivia_end' }, () => {
        onTriviaEnd()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [room.id, supabase, onTriviaEnd])

  const handleAnswer = async (answerIndex: number | null) => {
    if (hasAnswered) return

    if (timerRef.current) clearInterval(timerRef.current)
    setSelectedAnswer(answerIndex)
    setHasAnswered(true)

    const currentQuestion = questions[currentQuestionIndex]
    const isCorrect = answerIndex === currentQuestion.correct_index
    const points = isCorrect ? 100 : 0

    if (isCorrect) {
      setScore(prev => prev + 100)
    }

    // Save answer to database
    await supabase.from('trivia_answers').insert({
      question_id: currentQuestion.id,
      participant_id: currentParticipant.id,
      selected_index: answerIndex,
      is_correct: isCorrect,
      points_awarded: points,
    })

    // Update participant score
    if (isCorrect) {
      await supabase
        .from('participants')
        .update({ score: currentParticipant.score + points })
        .eq('id', currentParticipant.id)
    }
  }

  const handleShowResult = async () => {
    setShowResult(true)
    // Broadcast to all players
    await supabase.channel(`trivia-sync:${room.id}`).send({
      type: 'broadcast',
      event: 'show_result',
      payload: {},
    })
  }

  const handleNextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1
      await supabase.channel(`trivia-sync:${room.id}`).send({
        type: 'broadcast',
        event: 'next_question',
        payload: { questionIndex: nextIndex },
      })
      setCurrentQuestionIndex(nextIndex)
      setSelectedAnswer(null)
      setHasAnswered(false)
      setShowResult(false)
    } else {
      // Trivia finished
      await supabase.channel(`trivia-sync:${room.id}`).send({
        type: 'broadcast',
        event: 'trivia_end',
        payload: {},
      })
      onTriviaEnd()
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-4xl animate-bounce">🎄</div>
          <div className="text-xl">Preparing trivia questions...</div>
        </div>
      </main>
    )
  }

  if (questions.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-xl text-muted-foreground">No trivia questions available</div>
        {isHost && (
          <Button onClick={onTriviaEnd} className="mt-4">
            Skip to Next Round
          </Button>
        )}
      </main>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <GameBreadcrumbs
          currentStage="quiz"
          canNavigate={isHost}
          onNavigate={(stage) => stage === 'lobby' && onNavigateToLobby()}
        />

        {/* Header */}
        <div className="text-center">
          <Badge variant="secondary" className="text-lg px-4 py-1 mb-2">
            🎄 Trivia Round
          </Badge>
          <p className="text-muted-foreground text-sm">Test your Christmas music knowledge!</p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
            <span className="font-semibold">Score: {score}</span>
          </div>
          <Progress value={progress} />
        </div>

        {/* Timer */}
        {!hasAnswered && !showResult && (
          <div className="flex justify-center">
            <Badge
              variant={timeRemaining <= 5 ? 'destructive' : 'secondary'}
              className={`text-2xl px-6 py-2 ${timeRemaining <= 5 ? 'animate-pulse' : ''}`}
            >
              {timeRemaining}s
            </Badge>
          </div>
        )}

        {/* Question Card */}
        <Card className="border-2 border-primary/30">
          <CardHeader>
            <CardTitle className="text-center text-lg">
              {currentQuestion.question_text}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(currentQuestion.options as string[]).map((option, index) => {
              const isSelected = selectedAnswer === index
              const isCorrect = index === currentQuestion.correct_index
              const showCorrectness = showResult || (hasAnswered && isSelected)

              let buttonVariant: 'default' | 'outline' | 'destructive' = 'outline'
              let extraClasses = ''

              if (showResult) {
                if (isCorrect) {
                  buttonVariant = 'default'
                  extraClasses = 'bg-green-600 hover:bg-green-600 border-green-600'
                } else if (isSelected && !isCorrect) {
                  buttonVariant = 'destructive'
                }
              } else if (isSelected) {
                buttonVariant = 'default'
              }

              return (
                <Button
                  key={index}
                  onClick={() => !hasAnswered && handleAnswer(index)}
                  disabled={hasAnswered}
                  variant={buttonVariant}
                  className={`w-full h-auto py-3 text-left justify-start ${extraClasses}`}
                >
                  <span className="font-bold mr-3">{String.fromCharCode(65 + index)}.</span>
                  <span className="flex-1">{option}</span>
                  {showResult && isCorrect && <span className="ml-2">✓</span>}
                  {showResult && isSelected && !isCorrect && <span className="ml-2">✗</span>}
                </Button>
              )
            })}
          </CardContent>
        </Card>

        {/* Result Explanation */}
        {showResult && currentQuestion.explanation && (
          <Card className="border border-muted bg-muted/30">
            <CardContent className="py-4">
              <p className="text-sm text-center">
                <span className="font-semibold">💡 </span>
                {currentQuestion.explanation}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Host Controls */}
        {isHost && hasAnswered && !showResult && (
          <Button onClick={handleShowResult} className="w-full">
            Reveal Answer
          </Button>
        )}

        {isHost && showResult && (
          <Button onClick={handleNextQuestion} className="w-full" size="lg">
            {currentQuestionIndex < questions.length - 1 ? 'Next Question →' : 'Continue to Songs →'}
          </Button>
        )}

        {!isHost && hasAnswered && !showResult && (
          <p className="text-center text-muted-foreground">
            Waiting for host to reveal answer...
          </p>
        )}

        {!isHost && showResult && (
          <p className="text-center text-muted-foreground">
            Waiting for host to continue...
          </p>
        )}
      </div>
    </main>
  )
}
