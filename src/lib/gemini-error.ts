/**
 * Gemini API error parsing — typed errors + retry-delay extraction.
 *
 * Pulled out of `gemini.ts` so the parser logic is independently testable
 * without mocking the Google SDK. The shape of `errorDetails` is the
 * google.rpc envelope returned by `@google/generative-ai` on quota
 * exhaustion; see https://ai.google.dev/gemini-api/docs/rate-limits.
 */

const DEFAULT_RETRY_AFTER_SEC = 60;

/**
 * Thrown when the Gemini API responds with HTTP 429.
 * Carries the server-suggested retry delay (in seconds) when available;
 * defaults to {@link DEFAULT_RETRY_AFTER_SEC} when no `RetryInfo` detail
 * is present.
 */
export class GeminiRateLimitError extends Error {
  retryAfterSec: number;
  constructor(retryAfterSec: number) {
    super(`Gemini API rate limit exceeded. Retry after ${retryAfterSec}s.`);
    this.name = 'GeminiRateLimitError';
    this.retryAfterSec = retryAfterSec;
  }
}

/**
 * Extracts a retry delay (seconds, ceiled) from the `errorDetails` array
 * the Google SDK attaches to thrown errors. Looks for the `RetryInfo`
 * detail with a `retryDelay` field formatted like `"34s"` or
 * `"34.534329445s"`.
 *
 * Returns {@link DEFAULT_RETRY_AFTER_SEC} when:
 *   - errorDetails is not an array
 *   - no RetryInfo entry is present
 *   - the retryDelay string doesn't match the `<seconds>s` pattern
 */
export function extractRetryDelaySec(errorDetails: unknown): number {
  if (!Array.isArray(errorDetails)) return DEFAULT_RETRY_AFTER_SEC;
  for (const detail of errorDetails) {
    if (
      detail &&
      typeof detail === 'object' &&
      '@type' in detail &&
      typeof (detail as { '@type': string })['@type'] === 'string' &&
      (detail as { '@type': string })['@type'].includes('RetryInfo')
    ) {
      const raw = (detail as { retryDelay?: string }).retryDelay;
      if (typeof raw === 'string') {
        const match = raw.match(/^(\d+(?:\.\d+)?)s$/);
        if (match) return Math.ceil(parseFloat(match[1]));
      }
    }
  }
  return DEFAULT_RETRY_AFTER_SEC;
}

/**
 * Detects whether a thrown value represents an HTTP 429 from the Gemini
 * API. Two signals:
 *   - `err.status === 429` (modern SDK)
 *   - error message contains `[429` (legacy / formatted error string)
 */
export function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; message?: string };
  if (e.status === 429) return true;
  return typeof e.message === 'string' && e.message.includes('[429');
}
