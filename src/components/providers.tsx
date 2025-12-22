'use client'

import { BackgroundMusicProvider } from './background-music'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <BackgroundMusicProvider>
      {children}
    </BackgroundMusicProvider>
  )
}
