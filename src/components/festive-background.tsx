'use client'

interface Snowflake {
  id: number
  left: string
  size: number
  duration: number
  delay: number
  opacity: number
}

interface Decoration {
  id: number
  emoji: string
  left: string
  top: string
  size: number
  delay: number
}

interface Star {
  id: number
  left: string
  top: string
  delay: number
  duration: number
}

// Seeded pseudo-random number generator (stable across renders)
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 9999) * 10000
  return x - Math.floor(x)
}

// Generate stable random values once
const generateSnowflakes = (): Snowflake[] =>
  Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: `${seededRandom(i * 17 + 3) * 100}%`,
    size: seededRandom(i * 23 + 7) * 4 + 2,
    duration: seededRandom(i * 31 + 11) * 10 + 10,
    delay: seededRandom(i * 37 + 13) * 10,
    opacity: seededRandom(i * 41 + 19) * 0.6 + 0.2,
  }))

const generateDecorations = (): Decoration[] => {
  const decorationEmojis = ['🎵', '🎶', '🔊', '🎧', '🎄', '🎁', '⭐', '🎅', '❄️', '🦌']
  return Array.from({ length: 15 }, (_, i) => ({
    id: i,
    emoji: decorationEmojis[i % decorationEmojis.length],
    left: `${seededRandom(i * 43 + 29) * 85 + 5}%`,
    top: `${seededRandom(i * 47 + 31) * 70 + 15}%`,
    size: seededRandom(i * 53 + 37) * 1.5 + 1,
    delay: seededRandom(i * 59 + 41) * 5,
  }))
}

const generateStars = (): Star[] =>
  Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${seededRandom(i * 61 + 43) * 90 + 5}%`,
    top: `${seededRandom(i * 67 + 47) * 85 + 10}%`, // Keep away from top edge
    delay: seededRandom(i * 71 + 53) * 3,
    duration: seededRandom(i * 73 + 59) * 2 + 1,
  }))

// Pre-generate all elements
const SNOWFLAKES = generateSnowflakes()
const DECORATIONS = generateDecorations()
const STARS = generateStars()

export function FestiveBackground() {

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-secondary/5" />

      {/* Falling snowflakes */}
      {SNOWFLAKES.map((flake) => (
        <div
          key={flake.id}
          className="absolute animate-snowfall"
          style={{
            left: flake.left,
            top: -20, // Start off-screen
            width: flake.size,
            height: flake.size,
            backgroundColor: 'white',
            borderRadius: '50%',
            opacity: flake.opacity,
            animationDuration: `${flake.duration}s`,
            animationDelay: `${flake.delay}s`,
            boxShadow: '0 0 4px rgba(255, 255, 255, 0.5)',
          }}
        />
      ))}

      {/* Floating decorations */}
      {DECORATIONS.map((deco) => (
        <div
          key={deco.id}
          className="absolute animate-float"
          style={{
            left: deco.left,
            top: deco.top,
            fontSize: `${deco.size}rem`,
            opacity: 0.15,
            animationDelay: `${deco.delay}s`,
          }}
        >
          {deco.emoji}
        </div>
      ))}

      {/* Twinkling stars effect */}
      {STARS.map((star) => (
        <div
          key={`star-${star.id}`}
          className="absolute animate-twinkle"
          style={{
            left: star.left,
            top: star.top,
            width: 3,
            height: 3,
            backgroundColor: 'white',
            borderRadius: '50%',
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          }}
        />
      ))}

      <style jsx>{`
        @keyframes snowfall {
          0% {
            transform: translateY(-20px) rotate(0deg);
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
          }
        }
        .animate-snowfall {
          animation-name: snowfall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-15px) rotate(5deg);
          }
          50% {
            transform: translateY(-5px) rotate(-3deg);
          }
          75% {
            transform: translateY(-20px) rotate(3deg);
          }
        }
        .animate-float {
          animation: float 8s ease-in-out infinite;
        }

        @keyframes twinkle {
          0%, 100% {
            opacity: 0.1;
            transform: scale(0.8);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.2);
          }
        }
        .animate-twinkle {
          animation: twinkle ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
