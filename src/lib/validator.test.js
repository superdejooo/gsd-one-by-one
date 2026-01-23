/**
 * Comprehensive tests for validator.js
 * Tests validateCommand and sanitizeArguments with edge cases
 */
import { describe, it, expect } from 'vitest';
import { validateCommand, sanitizeArguments } from './validator.js';
import * as core from '@actions/core';
import { vi } from 'vitest';

describe('validateCommand', () => {
  it('accepts "new-milestone" (in allowlist)', () => {
    expect(() => validateCommand('new-milestone')).not.toThrow();
    expect(vi.mocked(core.info)).toHaveBeenCalledWith('Command validated: new-milestone');
  });

  it('accepts "plan-phase" (in allowlist)', () => {
    expect(() => validateCommand('plan-phase')).not.toThrow();
    expect(vi.mocked(core.info)).toHaveBeenCalledWith('Command validated: plan-phase');
  });

  it('accepts "execute-phase" (in allowlist)', () => {
    expect(() => validateCommand('execute-phase')).not.toThrow();
    expect(vi.mocked(core.info)).toHaveBeenCalledWith('Command validated: execute-phase');
  });

  it('accepts "complete-milestone" (in allowlist)', () => {
    expect(() => validateCommand('complete-milestone')).not.toThrow();
    expect(vi.mocked(core.info)).toHaveBeenCalledWith('Command validated: complete-milestone');
  });

  it('throws for unknown command "invalid-command"', () => {
    expect(() => validateCommand('invalid-command')).toThrow(
      'Unknown command: invalid-command'
    );
  });

  it('throws for non-kebab-case command "NewMilestone"', () => {
    expect(() => validateCommand('NewMilestone')).toThrow(
      'Unknown command: NewMilestone'
    );
  });

  it('error message includes valid commands list', () => {
    expect(() => validateCommand('unknown')).toThrow(
      'Valid commands: new-milestone, plan-phase, execute-phase, complete-milestone'
    );
  });

  it('throws for command with uppercase letters', () => {
    expect(() => validateCommand('PLAN-PHASE')).toThrow(
      'Unknown command: PLAN-PHASE'
    );
  });

  it('throws for command with spaces', () => {
    expect(() => validateCommand('new milestone')).toThrow(
      'Unknown command: new milestone'
    );
  });

  it('throws for command with special characters', () => {
    expect(() => validateCommand('plan_phase')).toThrow(
      'Unknown command: plan_phase'
    );
  });
});

describe('sanitizeArguments', () => {
  it('returns sanitized object for valid args', () => {
    const args = { phase: '7', name: 'Test' };
    const result = sanitizeArguments(args);
    expect(result).toEqual({ phase: '7', name: 'Test' });
  });

  it('throws for empty value', () => {
    const args = { phase: '' };
    expect(() => sanitizeArguments(args)).toThrow(
      'Argument phase cannot be empty'
    );
  });

  it('throws for value exceeding 500 chars', () => {
    const args = { name: 'a'.repeat(501) };
    expect(() => sanitizeArguments(args)).toThrow(
      'Argument name exceeds maximum length (500 chars)'
    );
  });

  it('removes semicolon shell metacharacter', () => {
    const args = { name: 'test;rm -rf /' };
    const result = sanitizeArguments(args);
    expect(result.name).toBe('testrm -rf /');
    expect(result.name).not.toContain(';');
  });

  it('removes ampersand shell metacharacter', () => {
    const args = { name: 'test&whoami' };
    const result = sanitizeArguments(args);
    expect(result.name).toBe('testwhoami');
    expect(result.name).not.toContain('&');
  });

  it('removes pipe shell metacharacter', () => {
    const args = { name: 'test|cat /etc/passwd' };
    const result = sanitizeArguments(args);
    expect(result.name).toBe('testcat /etc/passwd');
    expect(result.name).not.toContain('|');
  });

  it('removes backtick shell metacharacter', () => {
    const args = { name: 'test`whoami`' };
    const result = sanitizeArguments(args);
    expect(result.name).toBe('testwhoami');
    expect(result.name).not.toContain('`');
  });

  it('removes dollar sign shell metacharacter', () => {
    const args = { name: 'test$(whoami)' };
    const result = sanitizeArguments(args);
    expect(result.name).toBe('testwhoami');
    expect(result.name).not.toContain('$');
  });

  it('removes parentheses shell metacharacters', () => {
    const args = { name: 'test(command)' };
    const result = sanitizeArguments(args);
    expect(result.name).toBe('testcommand');
    expect(result.name).not.toContain('(');
    expect(result.name).not.toContain(')');
  });

  it('removes all shell metacharacters: ; & | ` $ ( )', () => {
    const args = { name: ';test&value|here`with$metacharacters(all)' };
    const result = sanitizeArguments(args);
    expect(result.name).toBe('testvalueherewithmetacharactersall');
  });

  it('trims whitespace from values', () => {
    const args = { name: '  Test Value  ' };
    const result = sanitizeArguments(args);
    expect(result.name).toBe('Test Value');
  });

  it('handles multiple arguments with sanitization', () => {
    const args = {
      phase: '  7  ',
      name: 'test;injection',
      type: 'unit|test'
    };
    const result = sanitizeArguments(args);
    expect(result).toEqual({
      phase: '7',
      name: 'testinjection',
      type: 'unittest'
    });
  });

  it('allows exactly 500 characters', () => {
    const args = { name: 'a'.repeat(500) };
    expect(() => sanitizeArguments(args)).not.toThrow();
  });

  it('throws for null value', () => {
    const args = { name: null };
    expect(() => sanitizeArguments(args)).toThrow(
      'Argument name cannot be empty'
    );
  });

  it('throws for undefined value', () => {
    const args = { name: undefined };
    expect(() => sanitizeArguments(args)).toThrow(
      'Argument name cannot be empty'
    );
  });

  it('preserves valid special characters (hyphens, underscores)', () => {
    const args = { name: 'test-value_with-special' };
    const result = sanitizeArguments(args);
    expect(result.name).toBe('test-value_with-special');
  });

  it('preserves numbers and letters', () => {
    const args = { name: 'test123ABC' };
    const result = sanitizeArguments(args);
    expect(result.name).toBe('test123ABC');
  });
});
