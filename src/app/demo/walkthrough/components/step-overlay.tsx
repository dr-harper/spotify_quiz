'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useWalkthrough } from './walkthrough-provider'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export function StepOverlay() {
  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    phase,
    nextStep,
    prevStep,
    skipDemo,
    getCharacter,
  } = useWalkthrough()

  const character = currentStep.characterId ? getCharacter(currentStep.characterId) : null
  const canGoBack = currentStepIndex > 0
  const isLastStep = currentStepIndex === totalSteps - 1
  const isComplete = phase === 'complete'

  // Phase labels for progress
  const phaseLabels: Record<string, string> = {
    'intro': 'Introduction',
    'song-selection': 'Song Selection',
    'quiz': 'Quiz Time',
    'complete': 'All Done!',
  }

  // Don't render if waiting for click-element action (user needs to interact with UI)
  const waitingForInteraction = currentStep.action === 'click-element' && currentStep.id === 'quiz-vote'

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 max-w-lg mx-auto">
      <Card className="border-2 border-primary shadow-2xl bg-card/95 backdrop-blur">
        <CardContent className="p-4 space-y-3">
          {/* Phase indicator */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              {phaseLabels[phase]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {currentStepIndex + 1} / {totalSteps}
            </span>
          </div>

          {/* Character display */}
          {character && (
            <div className="flex items-center gap-3 pb-2 border-b border-border">
              <Avatar className="h-12 w-12 border-2 border-primary">
                <AvatarImage src={character.avatarUrl} alt={character.name} />
                <AvatarFallback>{character.displayName[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{character.name}</p>
                <Badge variant="secondary" className="text-xs">
                  {character.moodTag}
                </Badge>
              </div>
            </div>
          )}

          {/* Step content */}
          <div>
            <h3 className="font-bold text-lg">{currentStep.title}</h3>
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
              {currentStep.description}
            </p>
          </div>

          {/* Interaction hint for vote step */}
          {waitingForInteraction && (
            <div className="bg-primary/10 rounded-lg p-2 text-center">
              <p className="text-sm text-primary font-medium">
                Tap on a player above to vote!
              </p>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={skipDemo}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Skip Demo
            </Button>

            <div className="flex gap-2">
              {canGoBack && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              {!waitingForInteraction && (
                <Button onClick={nextStep} size="sm">
                  {isComplete ? 'Create a Room' : isLastStep ? 'Finish' : 'Next'}
                  {!isComplete && !isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              )}
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-1 pt-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStepIndex
                    ? 'w-4 bg-primary'
                    : i < currentStepIndex
                    ? 'w-1.5 bg-primary/50'
                    : 'w-1.5 bg-muted'
                }`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
