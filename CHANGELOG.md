# Changelog

All notable changes to Festive Frequencies will be documented in this file.

## [Unreleased]

### Added

- **Background Music**: Jazz music plays in the lobby while waiting for players
  - Automatically stops when game starts (song selection phase)
  - Loops continuously at comfortable volume (30%)

- **Results Reveal Experience**: New interactive results presentation
  - Live-updating score chart with fixed X axis (chart stays stable as lines progress)
  - Song-by-song reveals with up to 30 seconds audio preview
  - Auto-advances to next song after 5 seconds (audio continues)
  - Trivia scores animated onto chart after Part 1 songs
  - Positive award system with compact badges at bottom of chart:
    - 🎯 Best Guesser: +150 points
    - 👏 Crowd Pleaser: +100 points
    - 🧠 Trivia Champ: +75 points
  - Awards reveal one-by-one with animated badges
  - Dramatic winner reveal with confetti animation and celebration music
  - Skip controls for those who want to jump ahead

- **Trivia Round**: New bonus trivia round between song guessing halves
  - 10 multiple-choice questions based on submitted songs
  - Data-driven questions: artist match, oldest/newest song, fastest tempo, longest track, most popular, happiest song, most danceable, most energetic, release decade
  - AI-generated questions via Gemini: fun facts, lyrics, movie appearances
  - 15-second timer per question with real-time scoring
  - Configurable question count (5 or 10 questions)
  - Toggle to enable/disable trivia in game settings

- **3-Round Game Structure**: Game now split into three phases
  - Part 1: First half of "Who picked this song?" rounds
  - Trivia: Bonus trivia round (if enabled)
  - Part 2: Second half of "Who picked this song?" rounds
  - Results: Final scores from all rounds combined

- **Trivia Settings**: New options in game settings modal
  - Toggle to enable/disable trivia round
  - Question count selector (5 or 10 questions)

### Changed

- Room statuses updated: `PLAYING` split into `PLAYING_ROUND_1`, `TRIVIA`, and `PLAYING_ROUND_2`
- Quiz view now shows "Part 1" or "Part 2" badge to indicate current phase
- Lobby page updated to show trivia status with purple indicator

### Database

- New `trivia_questions` table for storing generated questions per game
- New `trivia_answers` table for storing player responses
- Row-level security policies for both tables
