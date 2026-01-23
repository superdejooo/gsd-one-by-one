/**
 * Comprehensive tests for branches.js slugify function
 * Tests only the pure slugify function - git operations tested in Plan 04
 */
import { describe, it, expect } from 'vitest';
import { slugify } from './branches.js';

describe('slugify', () => {
  it('converts to lowercase', () => {
    const result = slugify('TEST PHASE');
    expect(result).toBe('test-phase');
  });

  it('replaces spaces with hyphens', () => {
    const result = slugify('my test phase');
    expect(result).toBe('my-test-phase');
  });

  it('replaces special characters with hyphens', () => {
    const result = slugify('test@phase#name');
    expect(result).toBe('test-phase-name');
  });

  it('removes leading/trailing hyphens', () => {
    const result = slugify('--test-phase--');
    expect(result).toBe('test-phase');
  });

  it('limits length to 50 characters', () => {
    const longName = 'a'.repeat(100);
    const result = slugify(longName);
    expect(result.length).toBe(50);
  });

  it('returns empty string for null', () => {
    const result = slugify(null);
    expect(result).toBe('');
  });

  it('returns empty string for undefined', () => {
    const result = slugify(undefined);
    expect(result).toBe('');
  });

  it('handles consecutive special characters (no double hyphens)', () => {
    const result = slugify('test@@@@phase');
    expect(result).toBe('test-phase');
    expect(result).not.toContain('--');
  });

  it('handles mixed case with numbers', () => {
    const result = slugify('Phase 7 Testing');
    expect(result).toBe('phase-7-testing');
  });

  it('handles strings with only special characters', () => {
    const result = slugify('@@##$$');
    expect(result).toBe('');
  });

  it('preserves hyphens from original text', () => {
    const result = slugify('already-kebab-case');
    expect(result).toBe('already-kebab-case');
  });

  it('handles empty string', () => {
    const result = slugify('');
    expect(result).toBe('');
  });

  it('handles string with tabs and newlines', () => {
    const result = slugify('test\tphase\nname');
    expect(result).toBe('test-phase-name');
  });

  it('handles unicode characters', () => {
    const result = slugify('tëst phåse');
    expect(result).toBe('t-st-ph-se');
  });

  it('handles leading special characters', () => {
    const result = slugify('###test');
    expect(result).toBe('test');
  });

  it('handles trailing special characters', () => {
    const result = slugify('test###');
    expect(result).toBe('test');
  });

  it('handles string at exactly 50 characters', () => {
    const name = 'a'.repeat(50);
    const result = slugify(name);
    expect(result.length).toBe(50);
  });

  it('handles string just over 50 characters', () => {
    const name = 'a'.repeat(51);
    const result = slugify(name);
    expect(result.length).toBe(50);
  });

  it('combines all transformations correctly', () => {
    const result = slugify('  My Test@Phase#123!!  ');
    expect(result).toBe('my-test-phase-123');
  });

  it('handles multiple consecutive spaces', () => {
    const result = slugify('test    phase');
    expect(result).toBe('test-phase');
  });
});
