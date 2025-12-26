'use client'

import { useState } from 'react'
import { ProcessingResults } from '@/app/room/[code]/components/processing-results'
import { Button } from '@/components/ui/button'

const MOCK_NARRATIVE = [
  "Tonight, we celebrate a connoisseur of the curd! From the K-pop chaos of \"CHEESE\" to the soulful serenade of \"Cheesecake\", this musical mastermind has taken us on a dairy-filled dream. Was it a love of fromage that guided them, or a tongue-in-cheek tribute to the tastiest of topics? Only our champion knows!",
  "This quiz was a battle of wits and beats, and our champion came out swinging! They started explosively, snatching four correct song IDs in Part 1 and immediately establishing a lead. They continued strong into Part 2, securing 3 more songs and earning the coveted Trivia Master award along the way. A dominant performance that left their competitor reeling!",
  "The competition was fierce, but this mystery victor proved to be an unstoppable force. With a commanding 250 point lead, they utterly vanquished their rival, showcasing a level of musical intuition that bordered on the superhuman. It was a masterclass in sonic strategy, a symphony of success, and a testament to their incredible knowledge!",
  "The lights are dimming, the tension is palpable, and the moment of truth is upon us. With a final score of 950 points, this musical titan has etched their name in music quiz history! But the question remains: who is this champion, and what melodic madness will they unleash next?"
]

export default function ProcessingDemoPage() {
  const [mode, setMode] = useState<'loading' | 'narrative'>('narrative')

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Mode toggle - only visible in demo */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <Button
          variant={mode === 'loading' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('loading')}
        >
          Loading State
        </Button>
        <Button
          variant={mode === 'narrative' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('narrative')}
        >
          Narrative State
        </Button>
      </div>

      <div className="max-w-lg mx-auto pt-16">
        <ProcessingResults
          narrative={mode === 'narrative' ? MOCK_NARRATIVE : []}
          isLoading={mode === 'loading'}
          onComplete={() => alert('Would reveal winner!')}
        />
      </div>
    </div>
  )
}
