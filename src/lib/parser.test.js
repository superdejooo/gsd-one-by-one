/**
 * Smoke test for test infrastructure
 *
 * This is NOT the full parser test suite - just a validation that
 * the test infrastructure works (vitest config, imports, etc).
 *
 * Full parser tests will be added in Plan 10-02.
 */
import { describe, it, expect } from 'vitest';
import { parseComment, parseArguments } from './parser.js';

describe('parseComment', () => {
  it('returns null when bot not mentioned', () => {
    const result = parseComment('Regular comment');
    expect(result).toBeNull();
  });
});

describe('parseArguments', () => {
  it('returns empty object for empty string', () => {
    const result = parseArguments('');
    expect(result).toEqual({});
  });
});
