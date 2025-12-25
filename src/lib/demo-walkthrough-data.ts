/**
 * Demo walkthrough data - characters, songs, and step definitions
 * Used for the guided demo that shows new users how the game works
 */

import type { Track } from '@/types/database'

// Demo Character type
export interface DemoCharacter {
  id: string
  name: string
  displayName: string
  avatarUrl: string
  aiSummary: string
  moodTag: string
  songs: DemoTrack[]
}

// Demo Track extends Track with owner info
export interface DemoTrack extends Track {
  ownerId: string
}

// Step definition for walkthrough
export interface DemoStep {
  id: string
  phase: 'intro' | 'song-selection' | 'quiz' | 'complete'
  title: string
  description: string
  highlightSelector?: string
  action: 'click-next' | 'click-element' | 'auto-advance'
  autoAdvanceMs?: number
  characterId?: string
}

// ============================================
// CHARACTERS
// ============================================

export const DEMO_CHARACTERS: DemoCharacter[] = [
  {
    id: 'churchill',
    name: 'Winston Churchill',
    displayName: 'Winston',
    avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=churchill&backgroundColor=b6e3f4',
    aiSummary: 'A wartime spirit with a taste for stirring anthems and songs that rally the nation. Expects music that echoes through the halls of history.',
    moodTag: 'Wartime Spirit',
    songs: [],
  },
  {
    id: 'attenborough',
    name: 'Sir David Attenborough',
    displayName: 'David',
    avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=attenborough&backgroundColor=c0aede',
    aiSummary: 'A contemplative soul who finds beauty in the natural world. Expects sweeping melodies that capture the majesty of our planet.',
    moodTag: "Nature's Narrator",
    songs: [],
  },
  {
    id: 'dench',
    name: 'Dame Judi Dench',
    displayName: 'Judi',
    avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=dench&backgroundColor=ffd5dc',
    aiSummary: 'Theatre royalty with impeccable taste. Her playlist reads like a West End greatest hits, with every song telling a story worth a standing ovation.',
    moodTag: 'Stage Legend',
    songs: [],
  },
  {
    id: 'fry',
    name: 'Stephen Fry',
    displayName: 'Stephen',
    avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=fry&backgroundColor=d1f4d1',
    aiSummary: 'An eclectic mix of British indie anthems and operatic grandeur. Expect clever lyrics and songs that make you think whilst tapping your foot.',
    moodTag: 'Clever Clogs',
    songs: [],
  },
  {
    id: 'user',
    name: 'You',
    displayName: 'You',
    avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=demouser&backgroundColor=ffeaa7',
    aiSummary: 'Getting started on their musical journey. Watch out, they might just surprise everyone!',
    moodTag: 'Rising Star',
    songs: [],
  },
]

// ============================================
// SONGS
// ============================================

// Placeholder album art colours (festive palette)
const ALBUM_COLOURS = [
  '#c41e3a', // Christmas red
  '#165b33', // Christmas green
  '#bb8e35', // Gold
  '#4a6fa5', // Winter blue
  '#7b3f61', // Plum
  '#2d5a27', // Forest green
  '#8b0000', // Dark red
  '#1e4d2b', // Pine green
]

// Generate a simple SVG placeholder with a colour based on the ID
const getPlaceholderAlbumArt = (id: string): string => {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const colour = ALBUM_COLOURS[hash % ALBUM_COLOURS.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect fill="${colour}" width="300" height="300"/><circle cx="150" cy="150" r="80" fill="${colour}" stroke="rgba(255,255,255,0.3)" stroke-width="4"/><circle cx="150" cy="150" r="25" fill="rgba(0,0,0,0.3)"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// Helper to create demo tracks
const createDemoTrack = (
  id: string,
  name: string,
  artist: string,
  albumName: string,
  releaseYear: number,
  ownerId: string,
  isChristmas = false
): DemoTrack => ({
  id,
  name,
  artist,
  albumName,
  albumArt: getPlaceholderAlbumArt(id),
  releaseDate: `${releaseYear}-01-01`,
  releaseYear,
  durationMs: 210000,
  popularity: 75,
  explicit: false,
  previewUrl: null,
  hasPreview: false,
  isLikelyChristmas: isChristmas,
  christmasKeywordMatches: isChristmas ? ['christmas'] : [],
  ownerId,
})

// Churchill's songs
const churchillSongs: DemoTrack[] = [
  createDemoTrack('ch-1', "We'll Meet Again", 'Vera Lynn', 'We\'ll Meet Again', 1939, 'churchill'),
  createDemoTrack('ch-2', 'Land of Hope and Glory', 'Edward Elgar', 'Pomp and Circumstance', 1902, 'churchill'),
  createDemoTrack('ch-3', 'Rule, Britannia!', 'Thomas Arne', 'Alfred', 1740, 'churchill'),
  createDemoTrack('ch-4', 'Jerusalem', 'Hubert Parry', 'And Did Those Feet', 1916, 'churchill'),
  createDemoTrack('ch-5', 'The White Cliffs of Dover', 'Vera Lynn', 'The White Cliffs of Dover', 1942, 'churchill'),
]

// Attenborough's songs
const attenboroughSongs: DemoTrack[] = [
  createDemoTrack('da-1', 'What a Wonderful World', 'Louis Armstrong', 'What a Wonderful World', 1967, 'attenborough'),
  createDemoTrack('da-2', 'Circle of Life', 'Elton John', 'The Lion King', 1994, 'attenborough'),
  createDemoTrack('da-3', 'Blackbird', 'The Beatles', 'The White Album', 1968, 'attenborough'),
  createDemoTrack('da-4', 'The Sound of Silence', 'Simon & Garfunkel', 'Wednesday Morning, 3 A.M.', 1964, 'attenborough'),
  createDemoTrack('da-5', 'Here Comes the Sun', 'The Beatles', 'Abbey Road', 1969, 'attenborough'),
]

// Judi Dench's songs
const denchSongs: DemoTrack[] = [
  createDemoTrack('jd-1', 'Memory', 'Elaine Paige', 'Cats', 1981, 'dench'),
  createDemoTrack('jd-2', 'Send in the Clowns', 'Judy Collins', 'A Little Night Music', 1973, 'dench'),
  createDemoTrack('jd-3', "Don't Cry for Me Argentina", 'Julie Covington', 'Evita', 1976, 'dench'),
  createDemoTrack('jd-4', 'I Dreamed a Dream', 'Patti LuPone', 'Les Misérables', 1985, 'dench'),
  createDemoTrack('jd-5', 'The Rose', 'Bette Midler', 'The Rose', 1979, 'dench'),
]

// Stephen Fry's songs
const frySongs: DemoTrack[] = [
  createDemoTrack('sf-1', 'Bohemian Rhapsody', 'Queen', 'A Night at the Opera', 1975, 'fry'),
  createDemoTrack('sf-2', 'Common People', 'Pulp', 'Different Class', 1995, 'fry'),
  createDemoTrack('sf-3', 'There Is a Light That Never Goes Out', 'The Smiths', 'The Queen Is Dead', 1986, 'fry'),
  createDemoTrack('sf-4', 'A Design for Life', 'Manic Street Preachers', 'Everything Must Go', 1996, 'fry'),
  createDemoTrack('sf-5', 'Perfect Day', 'Lou Reed', 'Transformer', 1972, 'fry'),
]

// User's pre-selected songs for the demo
const userSongs: DemoTrack[] = [
  createDemoTrack('u-1', 'Mr. Brightside', 'The Killers', 'Hot Fuss', 2004, 'user'),
  createDemoTrack('u-2', "Don't Look Back in Anger", 'Oasis', "(What's the Story) Morning Glory?", 1995, 'user'),
  createDemoTrack('u-3', 'Wonderwall', 'Oasis', "(What's the Story) Morning Glory?", 1995, 'user'),
]

// Assign songs to characters
DEMO_CHARACTERS[0].songs = churchillSongs
DEMO_CHARACTERS[1].songs = attenboroughSongs
DEMO_CHARACTERS[2].songs = denchSongs
DEMO_CHARACTERS[3].songs = frySongs
DEMO_CHARACTERS[4].songs = userSongs

// All songs combined for search results
export const DEMO_SONG_LIBRARY: DemoTrack[] = [
  ...churchillSongs,
  ...attenboroughSongs,
  ...denchSongs,
  ...frySongs,
  ...userSongs,
  // Additional songs for search variety
  createDemoTrack('extra-1', 'Champagne Supernova', 'Oasis', "(What's the Story) Morning Glory?", 1995, 'user'),
  createDemoTrack('extra-2', 'Live Forever', 'Oasis', 'Definitely Maybe', 1994, 'user'),
  createDemoTrack('extra-3', 'Stop Crying Your Heart Out', 'Oasis', 'Heathen Chemistry', 2002, 'user'),
]

// Quiz rounds - songs that will be played during the quiz demo
export const DEMO_QUIZ_ROUNDS = [
  {
    track: frySongs[0], // Bohemian Rhapsody
    owner: DEMO_CHARACTERS[3], // Stephen Fry
  },
  {
    track: attenboroughSongs[0], // What a Wonderful World
    owner: DEMO_CHARACTERS[1], // David Attenborough
  },
]

// ============================================
// WALKTHROUGH STEPS (5 steps matching app flow)
// ============================================

export const DEMO_STEPS: DemoStep[] = [
  // Step 1: Home - Create/Join
  {
    id: 'home',
    phase: 'intro',
    title: 'Create or Join a Room',
    description: "Start by creating a new room or joining one with a code. Share the room code with friends to invite them!",
    action: 'click-next',
  },

  // Step 2: Lobby - See players
  {
    id: 'lobby',
    phase: 'intro',
    title: 'Wait for Players',
    description: "See who's joined the room. Once everyone's ready, the host starts the game and you'll pick your songs.",
    action: 'click-next',
  },

  // Step 3: Song Selection
  {
    id: 'song-selection',
    phase: 'song-selection',
    title: 'Pick Your Songs',
    description: "Search Spotify and add songs that represent your taste. Your friends will try to guess which ones are yours!",
    action: 'click-next',
  },

  // Step 4: Quiz
  {
    id: 'quiz',
    phase: 'quiz',
    title: 'Guess Who Picked It',
    description: "Listen to each song and vote on who you think chose it. Tap a player to make your guess!",
    highlightSelector: '[data-demo="vote-buttons"]',
    action: 'click-element',
  },

  // Step 5: Results
  {
    id: 'results',
    phase: 'complete',
    title: 'See the Results!',
    description: "Find out who knows their friends best! The playlist is saved to Spotify so you can listen again.",
    action: 'click-next',
  },
]

// Helper to get character by ID
export const getCharacterById = (id: string): DemoCharacter | undefined => {
  return DEMO_CHARACTERS.find(c => c.id === id)
}

// Helper to get step by ID
export const getStepById = (id: string): DemoStep | undefined => {
  return DEMO_STEPS.find(s => s.id === id)
}

// Get current phase from step index
export const getPhaseFromStepIndex = (index: number): DemoStep['phase'] => {
  if (index < 0 || index >= DEMO_STEPS.length) return 'intro'
  return DEMO_STEPS[index].phase
}
