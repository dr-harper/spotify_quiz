import { Suspense } from 'react'
import { DuplicateNameContent } from './duplicate-name-content'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { FestiveBackground } from '@/components/festive-background'

// Prevent static prerendering since this page uses searchParams
export const dynamic = 'force-dynamic'

function LoadingCard() {
  return (
    <Card className="w-full max-w-md border-2 border-muted/30 shadow-xl relative z-10 bg-card/95 backdrop-blur-sm">
      <CardHeader className="text-center">
        <div className="text-4xl mb-2 animate-pulse">⏳</div>
        <CardTitle className="text-xl">Loading...</CardTitle>
      </CardHeader>
    </Card>
  )
}

export default function DuplicateNamePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <FestiveBackground />
      <Suspense fallback={<LoadingCard />}>
        <DuplicateNameContent />
      </Suspense>
    </main>
  )
}
