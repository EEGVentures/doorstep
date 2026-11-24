import { describe, expect, it } from 'vitest';
import { safeNext } from '../../src/lib/safeNext.js';

describe('safeNext (sign-in return path)', () => {
  it('keeps paths on this site', () => {
    expect(safeNext('/events/jazz-night?x=1')).toBe('/events/jazz-night?x=1');
    expect(safeNext('/go/BLUELIGHT-ABC12')).toBe('/go/BLUELIGHT-ABC12');
  });
  it('refuses other websites and tricks', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', '/\t/evil.example', 'javascript:alert(1)', '', null, undefined, '/' + 'a'.repeat(600)]) {
      expect(safeNext(bad as string)).toBe('/');
    }
  });
});
