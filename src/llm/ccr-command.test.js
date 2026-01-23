import { describe, it, expect } from 'vitest';
import { formatCcrCommand, formatCcrCommandWithOutput } from './ccr-command.js';

describe('ccr-command', () => {
  describe('formatCcrCommand', () => {
    it('formats GSD command with github-actions-testing prefix', () => {
      const result = formatCcrCommand('/gsd:plan-phase 7');

      expect(result).toBe('ccr code --print "/gsd:plan-phase 7 /github-actions-testing"');
    });

    it('handles execute-phase command', () => {
      const result = formatCcrCommand('/gsd:execute-phase');

      expect(result).toContain('github-actions-testing');
      expect(result).toContain('/gsd:execute-phase');
    });

    it('handles complete-milestone command', () => {
      const result = formatCcrCommand('/gsd:complete-milestone');

      expect(result).toContain('github-actions-testing');
      expect(result).toContain('/gsd:complete-milestone');
    });
  });

  describe('formatCcrCommandWithOutput', () => {
    it('adds output redirect', () => {
      const result = formatCcrCommandWithOutput('/gsd:plan-phase 5', 'output.txt');

      expect(result).toBe('ccr code --print "/gsd:plan-phase 5 /github-actions-testing" > output.txt 2>&1');
    });

    it('handles dynamic output paths', () => {
      const result = formatCcrCommandWithOutput('/gsd:execute-phase 3', 'output-123456.txt');

      expect(result).toContain('> output-123456.txt 2>&1');
    });
  });
});
