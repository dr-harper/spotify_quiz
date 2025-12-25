'use client'

import { WalkthroughProvider, useWalkthrough } from './components/walkthrough-provider'
import { StepOverlay } from './components/step-overlay'
import { DemoIntro } from './components/demo-intro'
import { DemoSongSelection } from './components/demo-song-selection'
import { DemoQuiz } from './components/demo-quiz'
import { DemoComplete } from './components/demo-complete'

function WalkthroughContent() {
  const { phase } = useWalkthrough()

  return (
    <div className="min-h-screen">
      {/* Render the appropriate phase view */}
      {phase === 'intro' && <DemoIntro />}
      {phase === 'song-selection' && <DemoSongSelection />}
      {phase === 'quiz' && <DemoQuiz />}
      {phase === 'complete' && <DemoComplete />}

      {/* Step overlay (always visible) */}
      <StepOverlay />
    </div>
  )
}

export default function WalkthroughPage() {
  return (
    <WalkthroughProvider>
      <WalkthroughContent />
    </WalkthroughProvider>
  )
}
