'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { GameBreadcrumbs } from '@/components/game-breadcrumbs'
import { FestiveBackground } from '@/components/festive-background'
import { useWalkthrough } from './walkthrough-provider'
import {
  DEMO_PARTICIPANTS,
  DEMO_SUBMISSIONS,
} from '@/lib/demo-data'

/**
 * Demo quiz view - mirrors the actual quiz-view component
 */
export function DemoQuiz() {
  const { currentStep, submitVote, userVote } = useWalkthrough()

  // Use actual demo submissions
  const currentSubmission = DEMO_SUBMISSIONS[0] // First submission for demo
  const submittedParticipants = DEMO_PARTICIPANTS.filter(p => p.has_submitted)

  const isVotingStep = currentStep.id === 'quiz'
  const hasVoted = userVote !== null

  return (
    <>
      <FestiveBackground showSnow={true} />
      <main className="flex min-h-screen flex-col items-center justify-center p-4 pb-48">
        <div className="w-full max-w-lg space-y-6">
          <GameBreadcrumbs currentStage="quiz" />

          {/* Progress */}
          <div className="space-y-2">
            <div className="text-sm text-center">
              <Badge variant="secondary" className="mb-2">
                🎵 Part 1
              </Badge>
              <p className="text-muted-foreground">
                Song 1 of 10
              </p>
            </div>
            <Progress value={10} />
          </div>

          {/* Audio Player & Song Info */}
          <Card className="border-2 border-primary/30">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-4">
                {currentSubmission.album_art_url && (
                  <img
                    src={currentSubmission.album_art_url}
                    alt="Album art"
                    className="w-48 h-48 rounded-lg shadow-lg"
                  />
                )}

                <div className="text-center">
                  <p className="font-bold text-lg">{currentSubmission.track_name}</p>
                  <p className="text-muted-foreground">{currentSubmission.artist_name}</p>
                </div>

                {/* Fake audio controls */}
                <div className="w-full space-y-2">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-1/3" />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0:10</span>
                    <span>0:30</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Voting */}
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Who picked this song?</CardTitle>
              {/* Timer display */}
              {!hasVoted && (
                <div className="flex justify-center mt-2">
                  <Badge variant="secondary" className="text-lg px-4 py-1">
                    30s
                  </Badge>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div
                className="grid grid-cols-2 gap-3"
                data-demo="vote-buttons"
              >
                {submittedParticipants.map((participant) => (
                  <Button
                    key={participant.id}
                    onClick={() => isVotingStep && !hasVoted && submitVote(participant.id)}
                    disabled={hasVoted}
                    variant={userVote === participant.id ? 'default' : 'outline'}
                    className="h-auto py-3 flex flex-col items-center gap-2"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={participant.avatar_url || undefined} />
                      <AvatarFallback>{participant.display_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{participant.display_name}</span>
                  </Button>
                ))}
              </div>

              {hasVoted && (
                <p className="text-center text-muted-foreground mt-4">
                  Vote submitted! Waiting for others...
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
