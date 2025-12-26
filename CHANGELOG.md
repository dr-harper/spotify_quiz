# Changelog

All notable changes to Festive Frequencies will be documented in this file.

## [Unreleased]

### Added

- **Demo Mode & Screenshots**: New demo pages for screenshot generation
  - `/demo/home` - Home/join screen with mock data
  - `/demo/lobby` - Game lobby with mock participants
  - `/demo/submission` - Song selection interface with mock tracks
  - Playwright test suite for automated screenshot capture
  - GitHub Action to auto-generate screenshots on demo page changes
  - Updated README with screenshots and proper documentation

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

- **Favourites Voting Round**: New voting phase after Round 2
  - Players vote for their top 3 favourite songs
  - Can't vote for own submissions
  - Songs shown anonymously (no submitter revealed)
  - 50 points awarded per vote received
  - Real-time tracking of who has voted
  - Demo page at `/demo/favourites` for UI testing

- **Quiz Intro Screen**: New overview screen before quiz starts
  - Shows all game phases with descriptions
  - Dynamically adapts based on settings (hides trivia if disabled)
  - Displays scoring information
  - Host-controlled "Let's Go!" button syncs all players
  - Demo page at `/demo/intro` for UI testing

- **New Awards**: Additional awards in results reveal
  - ⭐ People's Favourite (+200 points) - most votes received (supports ties)
  - 🧠 Trivia Champ (+150 points) - highest trivia score (if trivia enabled)
  - Total of 5 awards now available

- **Image Fallback**: Broken Spotify album art images now show a fallback icon

### Changed

- Room statuses updated: `PLAYING` split into `PLAYING_ROUND_1`, `TRIVIA`, `PLAYING_ROUND_2`, and `FAVOURITES`
- Quiz view now shows "Part 1" or "Part 2" badge to indicate current phase
- Lobby page updated to show trivia status with purple indicator
- Game flow: LOBBY → SUBMITTING → PLAYING_ROUND_1 → TRIVIA → PLAYING_ROUND_2 → FAVOURITES → RESULTS

### Database

- New `trivia_questions` table for storing generated questions per game
- New `trivia_answers` table for storing player responses
- New `favourite_votes` table for storing player favourite song votes
- Row-level security policies for all new tables
