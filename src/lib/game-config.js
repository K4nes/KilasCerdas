/**
 * Centralised timing + game-rule constants.
 *
 * Imported by:
 *   - server.js              (CommonJS — room cleanup, rematch invite expiry)
 *   - src/lib/game-engine.js (CommonJS — per-question time limit, scoring)
 *   - src/lib/game-loop.js   (CommonJS — question countdown)
 *   - src/hooks/*.ts         (ESM via TS — client-side timer + rematch handshake)
 *
 * Single CommonJS module so it's consumable from both halves of the project
 * without dual-package hazards. TS files import via the @/lib alias and the
 * `allowJs` + `esModuleInterop` flags handle the interop.
 *
 * If you change a value here, both the server-authoritative timer (engine /
 * game-loop) and the client-rendered countdown (use-timer / rematch-modal)
 * pick up the change in lockstep — that synchronisation is the whole reason
 * this file exists.
 */

/** Time players have to answer one question (ms). */
const QUESTION_TIME_LIMIT_MS = 10000;

/** Time a rematch invite stays valid before timing out (ms). */
const REMATCH_INVITE_EXPIRY_MS = 10000;

/** Idle window before a finished/abandoned room is garbage-collected (ms). */
const ROOM_CLEANUP_MS = 30 * 60 * 1000;

/** Reconnect grace window after a disconnect (ms). */
const RECONNECT_GRACE_MS = 60000;

/** Client-side timeout when waiting for server `room_created` / `duel_started` (ms). */
const SERVER_ACK_TIMEOUT_MS = 10000;

module.exports = {
  QUESTION_TIME_LIMIT_MS,
  REMATCH_INVITE_EXPIRY_MS,
  ROOM_CLEANUP_MS,
  RECONNECT_GRACE_MS,
  SERVER_ACK_TIMEOUT_MS,
};
