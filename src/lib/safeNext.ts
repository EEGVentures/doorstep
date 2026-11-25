/**
 * Where to send someone after sign-in. Only paths on this site are allowed, so a
 * crafted link such as /signin?next=//evil.example cannot bounce a customer to a
 * look-alike site that asks for their password or card.
 */
export function safeNext(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || raw.length > 500) return fallback;
  if (!raw.startsWith('/')) return fallback;
  // "//host" and "/\host" are treated by browsers as another website.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  // Control characters (tabs, newlines) are stripped by browsers and can hide a "//".
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  return raw;
}
