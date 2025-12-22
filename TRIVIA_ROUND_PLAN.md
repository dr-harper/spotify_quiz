# Trivia Round - Implementation Plan

## Overview
After the "Who picked this song?" round, add a bonus trivia round with 10 multiple-choice questions based on the songs everyone submitted.

## Question Pool (generate ~15, pick 10 randomly)

### Data-Driven Questions (No AI)

| Type | Question Template | Difficulty |
|------|-------------------|------------|
| **Artist Match** | "Who sang '[Song Title]'?" | Easy |
| **Release Decade** | "What decade was '[Song]' released?" | Easy |
| **Oldest Song** | "Which of these songs was released first?" | Medium |
| **Newest Song** | "Which song is the most recent release?" | Medium |
| **Fastest Tempo** | "Which song has the fastest beat?" | Medium |
| **Longest Track** | "Which of these songs is the longest?" | Easy |
| **Most Popular** | "Which song is most streamed on Spotify?" | Medium |
| **Happiest Song** | "Which song sounds the most cheerful?" | Medium |
| **Most Danceable** | "Which song would get you dancing?" | Medium |
| **Album Match** | "Which album features '[Song]'?" | Medium |

### AI-Generated Questions (Gemini)

| Type | Question Template | Difficulty |
|------|-------------------|------------|
| **Lyric Fill** | "Complete the lyric: 'Last Christmas I gave you my ___'" | Medium |
| **Fun Fact** | "Which of these facts about '[Song]' is true?" | Medium |
| **Movie/Advert** | "Which movie featured '[Song]'?" | Medium |
| **Original Artist** | "Who originally recorded '[Song]'?" (for covers) | Medium |
| **Year Guess** | "In what year was '[Song]' first released?" | Medium |

---

## Question Generation Logic

### For Data Questions

```typescript
// Example: "Which song was released first?"
function generateOldestSongQuestion(tracks: Track[]): TriviaQuestion {
  // Pick 4 random tracks with release years
  const tracksWithYears = tracks.filter(t => t.releaseYear)
  const selected = shuffle(tracksWithYears).slice(0, 4)

  // Sort to find the oldest
  const sorted = [...selected].sort((a, b) => a.releaseYear - b.releaseYear)
  const correctTrack = sorted[0]
  const correctIndex = selected.findIndex(t => t.id === correctTrack.id)

  return {
    type: 'data',
    category: 'year',
    question: "Which of these Christmas songs was released first?",
    options: selected.map(t => `${t.name} - ${t.artist}`),
    correctIndex,
    explanation: `"${correctTrack.name}" was released in ${correctTrack.releaseYear}`
  }
}
```

### For AI Questions

```typescript
// Send to Gemini with song info
const prompt = `Generate a fun trivia question about the song "${track.name}" by ${track.artist}.

The question should be:
- Multiple choice with exactly 4 options
- Medium difficulty (not too obscure)
- Fun and suitable for a Christmas party quiz
- About lyrics, movie appearances, fun facts, or the original artist

Return JSON:
{
  "question": "...",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "explanation": "Brief fun fact"
}`
```

---

## Game Flow

```
[ROUND 1: Who Picked This Song?]
         ↓
[All songs played]
         ↓
[ROUND 2: Trivia Time!]
  - "Let's test your Christmas music knowledge!"
  - 10 questions, ~15 seconds each
  - Points: 100 for correct, 0 for wrong
  - Show answer + explanation after each
         ↓
[Final Results]
  - Combined scores from both rounds
```

---

## UI Design

### Question Screen
```
┌─────────────────────────────────────┐
│  Question 3 of 10          ⏱️ 12s  │
├─────────────────────────────────────┤
│                                     │
│  Which of these Christmas songs     │
│  was released first?                │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ A) All I Want for Christmas │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ B) Last Christmas           │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ C) Rockin' Around           │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ D) Jingle Bell Rock         │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

### Answer Reveal
```
┌─────────────────────────────────────┐
│  ✓ Correct!              +100 pts  │
├─────────────────────────────────────┤
│                                     │
│  B) Last Christmas - Wham!          │
│                                     │
│  📝 Released in 1984, two years     │
│     before "Rockin' Around" hit     │
│     the charts again in 1986.       │
│                                     │
│  Your answer: B ✓                   │
│                                     │
│  [Next Question →]                  │
└─────────────────────────────────────┘
```

---

## Database Changes

```sql
-- New table for trivia questions (generated per game)
CREATE TABLE trivia_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  question_number INT NOT NULL,
  question_type TEXT NOT NULL, -- 'data' or 'ai'
  category TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL, -- ["A", "B", "C", "D"]
  correct_index INT NOT NULL,
  explanation TEXT,
  related_track_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trivia answers
CREATE TABLE trivia_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES trivia_questions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  selected_index INT,
  is_correct BOOLEAN,
  points_awarded INT DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, participant_id)
);
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/types/database.ts` | Add TriviaQuestion, TriviaAnswer types |
| `src/app/api/trivia/generate/route.ts` | Generate questions for a room |
| `src/app/room/[code]/components/trivia-view.tsx` | Trivia round UI |
| `src/app/room/[code]/page.tsx` | Add TRIVIA status handling |
| `supabase/migrations/add_trivia_tables.sql` | Database tables |

---

## Settings Addition

```typescript
interface GameSettings {
  // ... existing
  triviaRoundEnabled: boolean  // Default: true
  triviaQuestionCount: 5 | 10  // Default: 10
}
```

---

## Next Steps

1. Create database migration for trivia tables
2. Add trivia types to database.ts
3. Create question generation API endpoint
4. Build trivia view component
5. Update game flow in page.tsx
6. Add trivia settings to game settings modal
