/**
 * Comprehensive tests for parser.js
 * Tests parseComment and parseArguments functions with edge cases
 */
import { describe, it, expect } from 'vitest';
import { parseComment, parseArguments } from './parser.js';

describe('parseComment', () => {
  it('returns null when bot not mentioned', () => {
    const result = parseComment('Regular comment without bot mention');
    expect(result).toBeNull();
  });

  it('returns null when mentioned but no command follows', () => {
    const result = parseComment('@gsd-bot');
    expect(result).toBeNull();
  });

  it('extracts command from "@gsd-bot new-milestone"', () => {
    const result = parseComment('@gsd-bot new-milestone');
    expect(result).toEqual({
      botMention: '@gsd-bot new-milestone',
      command: 'new-milestone',
      args: ''
    });
  });

  it('extracts command and args from "@gsd-bot plan-phase --phase=7"', () => {
    const result = parseComment('@gsd-bot plan-phase --phase=7');
    expect(result).toEqual({
      botMention: '@gsd-bot plan-phase --phase=7',
      command: 'plan-phase',
      args: '--phase=7'
    });
  });

  it('normalizes command to lowercase ("@gsd-bot NEW-MILESTONE" -> "new-milestone")', () => {
    const result = parseComment('@gsd-bot NEW-MILESTONE');
    expect(result).not.toBeNull();
    expect(result.command).toBe('new-milestone');
  });

  it('handles multiline comment (normalizes newlines)', () => {
    const result = parseComment('@gsd-bot\nplan-phase\n--phase=7');
    expect(result).toEqual({
      botMention: '@gsd-bot plan-phase --phase=7',
      command: 'plan-phase',
      args: '--phase=7'
    });
  });

  it('case-insensitive bot mention ("@GSD-BOT" works)', () => {
    const result = parseComment('@GSD-BOT new-milestone');
    expect(result).not.toBeNull();
    expect(result.command).toBe('new-milestone');
  });

  it('handles mixed case in bot mention ("@GsD-bOt")', () => {
    const result = parseComment('@GsD-bOt execute-phase');
    expect(result).not.toBeNull();
    expect(result.command).toBe('execute-phase');
  });

  it('handles Windows line endings (CRLF)', () => {
    const result = parseComment('@gsd-bot\r\nplan-phase\r\n--phase=7');
    expect(result).toEqual({
      botMention: '@gsd-bot plan-phase --phase=7',
      command: 'plan-phase',
      args: '--phase=7'
    });
  });

  it('trims whitespace from comment body', () => {
    const result = parseComment('  @gsd-bot new-milestone  ');
    expect(result).not.toBeNull();
    expect(result.command).toBe('new-milestone');
  });
});

describe('parseArguments', () => {
  it('returns empty object for empty string', () => {
    const result = parseArguments('');
    expect(result).toEqual({});
  });

  it('parses --key=value format', () => {
    const result = parseArguments('--phase=7');
    expect(result).toEqual({ phase: '7' });
  });

  it('parses quoted values: --name="My Milestone"', () => {
    const result = parseArguments('--name="My Milestone"');
    expect(result).toEqual({ name: 'My Milestone' });
  });

  it('parses single-quoted values: --name=\'My Milestone\'', () => {
    const result = parseArguments("--name='My Milestone'");
    expect(result).toEqual({ name: 'My Milestone' });
  });

  it('handles multiple arguments', () => {
    const result = parseArguments('--phase=7 --name="Testing Phase" --type=unit');
    expect(result).toEqual({
      phase: '7',
      name: 'Testing Phase',
      type: 'unit'
    });
  });

  it('ignores malformed arguments (no =)', () => {
    const result = parseArguments('--phase=7 invalid --name="Test"');
    expect(result).toEqual({
      phase: '7',
      name: 'Test'
    });
  });

  it('handles arguments with underscores in keys', () => {
    const result = parseArguments('--my_key=value');
    expect(result).toEqual({ my_key: 'value' });
  });

  it('handles arguments with numbers in keys', () => {
    const result = parseArguments('--phase2=value');
    expect(result).toEqual({ phase2: 'value' });
  });

  it('handles empty quoted values', () => {
    const result = parseArguments('--name=""');
    expect(result).toEqual({ name: '' });
  });

  it('handles values with spaces without quotes (takes first word)', () => {
    const result = parseArguments('--name=My Milestone');
    expect(result).toEqual({ name: 'My' });
  });
});
