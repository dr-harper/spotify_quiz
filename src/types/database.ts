export type RoomStatus = 'LOBBY' | 'SUBMITTING' | 'PLAYING_ROUND_1' | 'TRIVIA' | 'PLAYING_ROUND_2' | 'RESULTS'

export interface GameSettings {
  songsRequired: 5 | 10 | 15
  christmasSongsRequired: number // 0 = no requirement, or 1-15
  chameleonMode: boolean
  guessTimerSeconds: number | null // null = unlimited, 15, or 30
  previewLengthSeconds: 15 | 30
  revealAfterEachRound: boolean
  allowDuplicateSongs: boolean
  lobbyMusic: boolean
  triviaEnabled: boolean
  triviaQuestionCount: 5 | 10
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  songsRequired: 10,
  christmasSongsRequired: 3,
  chameleonMode: false,
  guessTimerSeconds: null,
  previewLengthSeconds: 30,
  revealAfterEachRound: false,
  allowDuplicateSongs: false,
  lobbyMusic: true,
  triviaEnabled: true,
  triviaQuestionCount: 10,
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

// Audio features from Spotify API
export interface AudioFeatures {
  tempo: number // BPM
  key: number // 0-11 (C=0, C#=1, etc.)
  mode: number // 1=major, 0=minor
  timeSignature: number
  danceability: number // 0.0-1.0
  energy: number // 0.0-1.0
  valence: number // 0.0-1.0 (happiness/positivity)
  acousticness: number // 0.0-1.0
  instrumentalness: number // 0.0-1.0
  speechiness: number // 0.0-1.0
  liveness: number // 0.0-1.0
  loudness: number // dB
}

// Simplified track for UI with rich metadata
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
  audioFeatures: AudioFeatures | null
  // Computed/heuristic fields
  isLikelyChristmas: boolean // Based on keywords
  christmasKeywordMatches: string[] // Which keywords matched
}

// Trivia question types
export type TriviaQuestionType = 'data' | 'ai'
export type TriviaCategory =
  | 'artist'      // Who sang this song?
  | 'year'        // Release year questions
  | 'tempo'       // BPM comparisons
  | 'duration'    // Song length
  | 'popularity'  // Spotify popularity
  | 'mood'        // Valence/energy questions
  | 'album'       // Album matching
  | 'lyrics'      // Lyric completion (AI)
  | 'trivia'      // Fun facts (AI)
  | 'movie'       // Movie/advert appearances (AI)

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
