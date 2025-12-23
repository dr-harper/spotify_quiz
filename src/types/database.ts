export type RoomStatus = 'LOBBY' | 'SUBMITTING' | 'PLAYING_ROUND_1' | 'TRIVIA' | 'PLAYING_ROUND_2' | 'RESULTS'

export type ThemeColor = 'green' | 'red' | 'blue' | 'purple' | 'gold'

export interface GameSettings {
  songsRequired: number // 1-20
  christmasSongsRequired: number // 0 = no requirement, up to songsRequired
  recentSongsRequired: number // 0 = no requirement, songs from current/last year
  chameleonMode: boolean
  guessTimerSeconds: number | null // null = unlimited, 15, or 30
  previewLengthSeconds: 15 | 30
  revealAfterEachRound: boolean
  allowDuplicateSongs: boolean
  lobbyMusic: boolean
  triviaEnabled: boolean
  triviaQuestionCount: 5 | 10
  // Visual settings
  snowEffect: boolean
  themeColor: ThemeColor
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  songsRequired: 10,
  christmasSongsRequired: 0,
  recentSongsRequired: 0,
  chameleonMode: false,
  guessTimerSeconds: null,
  previewLengthSeconds: 30,
  revealAfterEachRound: false,
  allowDuplicateSongs: false,
  lobbyMusic: true,
  triviaEnabled: true,
  triviaQuestionCount: 10,
  snowEffect: true,
  themeColor: 'green',
}

export interface Room {
  id: string
  room_code: string
  host_id: string
  name: string | null
  status: RoomStatus
  current_round: number
  settings: GameSettings | null
  created_at: string
  updated_at: string
}

export interface Participant {
  id: string
  room_id: string
  user_id: string
  spotify_id: string
  display_name: string
  avatar_url: string | null
  score: number
  is_host: boolean
  has_submitted: boolean
  created_at: string
  // AI-generated music taste summary
  ai_summary: string | null
  mood_tag: string | null  // Two-word playful mood descriptor
}

export interface Submission {
  id: string
  participant_id: string
  track_id: string
  track_name: string
  artist_name: string
  album_art_url: string | null
  preview_url: string
  submission_order: number
  played: boolean
  created_at: string
  // Metadata fields (added via migration for trivia)
  album_name: string | null
  release_year: number | null
  duration_ms: number | null
  popularity: number | null
  // Chameleon mode - this song is disguised as someone else's taste
  is_chameleon: boolean
}

export interface QuizRound {
  id: string
  room_id: string
  submission_id: string
  round_number: number
  started_at: string | null
  ended_at: string | null
}

export interface Vote {
  id: string
  round_id: string
  voter_id: string
  guessed_participant_id: string
  is_correct: boolean | null
  points_awarded: number
  voted_at: string
}

// Spotify track from API
export interface SpotifyTrack {
  id: string
  name: string
  artists: { name: string }[]
  album: {
    name: string
    images: { url: string; height: number; width: number }[]
  }
  preview_url: string | null
  duration_ms: number
}

// Simplified track for UI with rich metadata
// Note: Audio features (tempo, danceability, energy, valence) are no longer available
// as Spotify deprecated the audio-features endpoint in late 2024
export interface Track {
  id: string
  name: string
  artist: string
  albumName: string | null
  albumArt: string | null
  releaseDate: string | null // YYYY-MM-DD or YYYY
  releaseYear: number | null
  durationMs: number | null
  popularity: number | null // 0-100
  explicit: boolean
  previewUrl: string | null
  hasPreview: boolean
  // Computed/heuristic fields
  isLikelyChristmas: boolean // Based on keywords
  christmasKeywordMatches: string[] // Which keywords matched
  // Chameleon mode
  isChameleon?: boolean // Marked as the chameleon pick
}

// Trivia question types
export type TriviaQuestionType = 'data'
export type TriviaCategory =
  | 'artist'      // Who sang this song?
  | 'year'        // Release year questions
  | 'duration'    // Song length
  | 'popularity'  // Spotify popularity
  | 'album'       // Album matching

export interface TriviaQuestion {
  id: string
  room_id: string
  question_number: number
  question_type: TriviaQuestionType
  category: TriviaCategory
  question_text: string
  options: [string, string, string, string] // Always 4 options
  correct_index: number // 0-3
  explanation: string | null
  related_track_id: string | null
  created_at: string
}

export interface TriviaAnswer {
  id: string
  question_id: string
  participant_id: string
  selected_index: number | null // null if didn't answer
  is_correct: boolean
  points_awarded: number
  answered_at: string
}
