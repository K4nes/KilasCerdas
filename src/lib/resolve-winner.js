/**
 * resolveWinner — pure function that turns a finished room's scores into a
 * winner / draw / stats triple.
 *
 * Extracted out of `GameEngine.advanceQuestion` and `GameEngine.getWinner`,
 * which previously hand-rolled the same logic in two places. Tests live
 * alongside in `resolve-winner.test.js`.
 *
 * Tie semantics: any number of players sharing the top score → draw,
 * `winner === null`, `stats[*].isWinner === false` for everyone. Includes
 * the 0-0 case (both wrong / both timed out).
 *
 * @param {Record<string, number>} scores
 * @param {Array<{ id: string, name: string }>} players
 * @returns {{
 *   winner: { id: string, name: string } | null,
 *   stats: Array<{ name: string, score: number, isWinner: boolean }>,
 *   isDraw: boolean,
 * }}
 */
function resolveWinner(scores, players) {
  const safeScores = scores || {};
  const safePlayers = Array.isArray(players) ? players : [];

  // Empty room or no scores recorded yet → treat as draw with no winner.
  const scoreEntries = Object.entries(safeScores);
  if (scoreEntries.length === 0) {
    return {
      winner: null,
      stats: safePlayers.map((p) => ({
        name: p.name,
        score: 0,
        isWinner: false,
      })),
      isDraw: true,
    };
  }

  let maxScore = -Infinity;
  for (const [, sc] of scoreEntries) {
    if (sc > maxScore) maxScore = sc;
  }
  const topScorers = scoreEntries.filter(([, sc]) => sc === maxScore);
  const isDraw = topScorers.length !== 1;
  const winnerId = isDraw ? null : topScorers[0][0];

  const winnerPlayer = winnerId
    ? safePlayers.find((p) => p.id === winnerId) || null
    : null;
  const winner = winnerPlayer
    ? { id: winnerPlayer.id, name: winnerPlayer.name }
    : null;

  const stats = safePlayers.map((p) => ({
    name: p.name,
    score: safeScores[p.id] || 0,
    isWinner: !isDraw && p.id === winnerId,
  }));

  return { winner, stats, isDraw };
}

module.exports = { resolveWinner };
