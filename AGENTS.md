# AGENTS.md — Kilas Cerdas (BrainClash)

## Dev commands

```bash
npm run dev      # Boot server: node server.js → Next.js + Socket.io on same port
npm run build    # next build (standalone output)
npm run start    # Production: node server.js
npm test         # Node native test runner (--experimental-strip-types)
```

`npm run dev` uses `node server.js`, **not** `next dev`. The server handles both HTTP (Next.js) and WebSocket (Socket.io) on one port. If you run `next dev` separately, sockets won't work.

## Required env

| Key | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API for AI question generation |

Copy `.env.example` to `.env`. Without `GEMINI_API_KEY`, question generation returns a `no_key` error to the client — there is no hardcoded fallback question bank.

Optional: `PORT` overrides the default (3000). Only set if you need a custom port.

## Architecture

### Dual-module system (CJS + ESM)

The project bridge CommonJS (server) and ESM/TS (client):

- **`server.js`**, **`src/lib/game-engine.js`**, **`src/lib/game-loop.js`** — CommonJS, Node.js runtime
- **`src/lib/game-config.js`** — CommonJS **constants shared by both sides**. TS imports it via `allowJs: true` + `esModuleInterop`. Server `require()`s it. **If you change timing constants here, both client and server pick up the change.**
- **`src/lib/socket-event-names.js`** — CommonJS **event name registry**. Add new events here first, then add TS payload types in `socket-events.ts`. TS gets literal-type narrowing from the `@type {const}` JSDoc.
- **`src/lib/socket-events.ts`** — TypeScript payload type definitions for the wire protocol

### Server (`server.js`)

Single monolith. Creates HTTP server, mounts Next.js request handler, attaches Socket.io on same port. All game logic lives in `GameEngine` class — **no Socket.io references in the engine**, just pure state management. Server wires events to engine calls.

Game flow (socket events):
```
CREATE_ROOM → ROOM_CREATED
JOIN_ROOM → JOINED / PLAYER_JOINED
START_DUEL → DUEL_STARTED + countdown
SUBMIT_ANSWER → ANSWER_RESULT / SCORE_UPDATE / DUEL_END
REMATCH_INVITE → REMATCH_INVITE_RECEIVED
REMATCH_RESPONSE → REMATCH_RESOLVED / ROOM_STATE_CHANGED
REMATCH_START → DUEL_STARTED
```

### Client (`src/`)

| Dir | Purpose |
|---|---|
| `app/` | Next.js App Router pages (home, /create, /room/[id], API route) |
| `components/` | React components (room screens, modals, toast, topic-picker) |
| `hooks/` | `use-game-socket.ts` (main hook wiring sockets to state), `use-timer.ts` |
| `lib/` | Shared libs: engine, config, types, socket events, gemini, reducer |

State management: `room-reducer.ts` (dispatch-based reducer) + `use-game-socket.ts` (hook that connects socket events → dispatch → UI re-render).

Client socket (`src/lib/socket.ts`) is a singleton — reuses the same connection across renders.

Room screen phases (driven by `status` field):
```
waiting → lobby_screen → countdown → duel_screen → result_screen
                                                          ↓ (rematch)
                                                   topic_select → countdown → ...
```

### API Route

`POST /api/generate-soal` — calls Gemini to generate quiz questions. Accepts `{ topic, questionCount, chatId? }`. Returns `{ success, questions, chatId }`.

- `chatId` enables **multi-turn deduplication**: the same chat session is reused for all question generations in the same room (including rematches). Gemini sees its previous questions and avoids repeats.
- Chat sessions are stored in server memory with a 30-min TTL.
- When a model hits rate limit (429), the route automatically falls back through a chain of models (see below). If all models fail, a structured error is returned to the client.
- The client never receives silently-repeated fallback questions — errors are surfaced directly.

#### Gemini model fallback chain

Defined in `src/lib/gemini.ts:15-22`. When the primary model fails (rate limit, format error, etc.), the route retries with the next model in order:

```
gemini-3.5-flash → gemini-3.1-flash-lite → gemini-3-flash-preview → gemini-2.5-flash → gemini-2.5-flash-lite → gemini-flash-latest
```

Each model maintains its own chat session (keyed `modelId:chatId`), so switching models starts a fresh conversation context. Only `GeminiNoKeyError` (missing API key) bypasses the fallback chain.

### chatId flow

1. `topic-picker` calls `/api/generate-soal` → API returns `chatId` with questions
2. `create/page.tsx` includes `chatId` in `CREATE_ROOM` socket event
3. Server stores `chatId` in the room object (`game-engine.js`)
4. Room state includes `chatId` → returned to client on `JOINED` / `ROOM_CREATED`
5. On rematch, `topic-select-screen` reads `chatId` from room state and passes it to `topic-picker`
6. `topic-picker` sends `chatId` in the API request → same chat session continues

## CSS/Tailwind

- Tailwind v4 via `@tailwindcss/postcss` plugin (postcss.config.js)
- Custom CSS properties defined in `globals.css` for card colors (`--color-card-purple`, `--color-card-pink`, etc.)
- `.card` / `.card-purple` / `.card-mint` etc. reusable classes in globals.css
- No tailwind.config.js — all config via CSS and the `@theme` directive (Tailwind v4 pattern)

## Tests

Test command targets `src/lib/*.test.js` and `src/lib/*.test.ts`. Uses Node's built-in test runner with `--experimental-strip-types`. No test framework (Jest/Vitest) installed. Currently no test files exist.

## Conventions

- **Language**: Indonesian UI strings throughout
- **No login/auth** — player identity stored in localStorage (`kilascerdas_player_name`, `kilascerdas_player_id`)
- **Room codes** — 6-character alphanumeric, uppercase
- **Next.js output**: `standalone` mode (for containerized deployment)
- **Path alias**: `@/*` → `./src/*`
