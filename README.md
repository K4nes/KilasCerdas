# Kilas Cerdas — Real-Time Knowledge Duel

1v1 real-time quiz duels with AI-generated questions (Google Gemini). Pick a topic, share a room code, answer fast — fastest and most accurate wins.

**No login, no ads, no hassle.**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + React 18 + TypeScript |
| Styling | Tailwind CSS v4 |
| Real-time | Socket.io (WebSocket) |
| AI | Google Gemini API |
| Runtime | Node.js |

HTTP server and WebSocket run on **a single port** — `server.js` handles both Next.js and Socket.io.

## Running Locally

### Prerequisites

- Node.js 18+
- Google Gemini API key ([get one here](https://aistudio.google.com/app/api-keys))

### Setup

```bash
git clone https://github.com/K4nes/KilasCerdas.git
cd KilasCerdas
cp .env.example .env
# Fill in GEMINI_API_KEY in .env
npm install
```

### Development

```bash
npm run dev
# Open http://localhost:3000
```

### Production

```bash
npm run build
npm start
```

Without `GEMINI_API_KEY`, the app still runs but uses hardcoded fallback questions (not AI-generated).

---

## Architecture

```
client (TS/ESM)          server (CJS)           shared (CJS)
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Next.js      │ HTTP │ server.js    │      │ game-config  │
│ App Router   │◄────►│              │      │ (timers,     │
│              │      │ GameEngine   │      │  rules)      │
│ Socket.io    │ WS   │              │      ├──────────────┤
│ client       │◄────►│ GameLoop     │      │ socket-event │
│              │      │              │      │ -names (wire │
│ room-reducer │      │ Socket.io    │      │  protocol)   │
│ (state)      │      │ server       │      └──────────────┘
└──────────────┘      └──────────────┘
```

- **GameEngine** — pure game logic, no Socket.io references. Server wires socket events to engine methods.
- **GameLoop** — question timers, duel progression, decides when to advance to next question / end the duel.
- **room-reducer** — client-side state management (dispatch-based). The `use-game-socket` hook wires socket events to reducer dispatches.

### Room Flow

```
lobby → countdown → duel → result
                            ↓
                        rematch → topic_select → countdown → duel → ...
```

### Socket Events

```
CREATE_ROOM    → ROOM_CREATED
JOIN_ROOM      → JOINED / PLAYER_JOINED
START_DUEL     → DUEL_STARTED + countdown
SUBMIT_ANSWER  → ANSWER_RESULT / SCORE_UPDATE / DUEL_END
REMATCH_INVITE → REMATCH_INVITE_RECEIVED
REMATCH_RESPONSE → REMATCH_RESOLVED / ROOM_STATE_CHANGED
REMATCH_START  → DUEL_STARTED
```

### Shared Constants

`src/lib/game-config.js` — single source of truth for all timing values (question time limit, rematch expiry, reconnect grace period, etc). This CommonJS file is consumed by the server (`require`) and the client (`import` via `allowJs: true`). Change here → changes everywhere.

---

## Commands

```bash
npm run dev      # Development (node server.js)
npm run build    # Production build
npm run start    # Production
npm test         # Node test runner
```

> **Important:** `npm run dev` runs `node server.js`, **not** `next dev`. Running `next dev` separately breaks WebSocket.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Homepage
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Tailwind v4 + custom CSS properties
│   ├── create/page.tsx       # Room creation page
│   ├── room/[id]/page.tsx    # Room page (lobby/duel/result)
│   └── api/generate-soal/    # API route for AI question generation
├── components/
│   ├── room/                 # Room screens (lobby, countdown, duel, result, topic-select)
│   ├── topic-picker.tsx      # Topic picker + question generation
│   ├── rematch-modal.tsx     # Rematch invitation modal
│   ├── rate-limit-modal.tsx  # Gemini rate limit modal
│   └── toast.tsx             # Toast notifications
├── hooks/
│   ├── use-game-socket.ts    # Main hook (socket ↔ reducer ↔ UI)
│   └── use-timer.ts          # Client-side timer
└── lib/
    ├── game-engine.js        # GameEngine class (CJS)
    ├── game-loop.js          # GameLoop class (CJS)
    ├── game-config.js        # Timing constants (CJS — shared by server & client)
    ├── socket-event-names.js # Socket event name registry (CJS)
    ├── socket-events.ts      # Event payload type definitions (TS)
    ├── socket.ts             # Singleton Socket.io client
    ├── room-reducer.ts       # Reducer state management
    ├── gemini.ts             # Gemini API wrapper
    ├── gemini-error.ts       # Gemini error handling (rate limits, etc.)
    ├── utils.ts              # Fallback questions, helpers
    ├── types.ts              # Data types (Room, Player, Question, etc.)
    ├── resolve-winner.js     # Winner resolution logic
    └── confetti.ts           # Canvas confetti animation
```

---

## Features

- AI-generated questions every duel (no static question bank)
- Real-time timer synced via WebSocket
- Instant score feedback after answering (correct/wrong + timing)
- Rematch — challenge opponent again without creating a new room
- Auto-reconnect on disconnect (60-second grace period)
- Progress bar, score animations, confetti
- Responsive — mobile & desktop

## Limits

- Max 2 players per room
- 5, 10, or 15 questions per duel
- 10 seconds per question
- Rooms expire 30 minutes after creation (timer resets on rematch only; disconnect during active play gives 60s to reconnect before removal)


