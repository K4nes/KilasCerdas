/**
 * Socket.io event names — the single source of truth for the wire protocol.
 *
 * Kept as a CommonJS module so it's consumable from both halves of the
 * project: `server.js` (CommonJS) and the TS client (via the `@/lib/...`
 * alias + `allowJs: true`). The `@type {const}` JSDoc gives TS the
 * literal-type narrowing it needs for the payload-map interfaces in
 * `socket-events.ts`.
 *
 * If you add a new event:
 *   1. Add the key here (the wire string is the source of truth).
 *   2. Add the matching payload type to socket-events.ts.
 *   3. The TS compiler will fail any callsite that doesn't match.
 */

const Events = /** @type {const} */ ({
  /* ── Client → Server ── */
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  RESYNC: 'resync',
  START_DUEL: 'start_duel',
  REMATCH_INVITE: 'rematch_invite',
  REMATCH_RESPONSE: 'rematch_response',
  REMATCH_START: 'rematch_start',
  SUBMIT_ANSWER: 'submit_answer',

  /* ── Server → Client ── */
  ROOM_CREATED: 'room_created',
  JOINED: 'joined',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  PLAYER_DISCONNECTED: 'player_disconnected',
  PLAYER_RECONNECTED: 'player_reconnected',
  ERROR_MESSAGE: 'error_message',
  DUEL_STARTED: 'duel_started',
  COUNTDOWN: 'countdown',
  NEW_QUESTION: 'new_question',
  ANSWER_RESULT: 'answer_result',
  SCORE_UPDATE: 'score_update',
  DUEL_END: 'duel_end',
  REMATCH_INVITE_RECEIVED: 'rematch_invite_received',
  REMATCH_RESOLVED: 'rematch_resolved',
  ROOM_STATE_CHANGED: 'room_state_changed',
});

module.exports = { Events };
