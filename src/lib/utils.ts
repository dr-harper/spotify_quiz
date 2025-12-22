import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Generate a festive room code (6 characters)
export function generateRoomCode(): string {
  const festiveWords = [
    'JINGLE', 'MERRY', 'FROSTY', 'HOLLY', 'TINSEL', 'CAROL',
    'SNOWFL', 'REINDE', 'SLEIGH', 'CANDY', 'CHEER', 'BELLS'
  ]
  // Pick a random word and add 2 random digits
  const word = festiveWords[Math.floor(Math.random() * festiveWords.length)]
  const digits = Math.floor(Math.random() * 100).toString().padStart(2, '0')
  return `${word.slice(0, 4)}${digits}`
}

// Format duration from ms to mm:ss
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
