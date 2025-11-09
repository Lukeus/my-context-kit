/**
 * Time Helpers Unit Tests
 * 
 * Tests for centralized time/duration formatting utilities
 */

import { describe, it, expect } from 'vitest';
import { formatDuration, formatTime, nowIso, isStale, elapsed } from '../../src/renderer/services/assistant/timeHelpers';

describe('timeHelpers', () => {
  describe('formatDuration', () => {
    it('formats milliseconds correctly', () => {
      expect(formatDuration(0)).toBe('0ms');
      expect(formatDuration(42)).toBe('42ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('formats seconds correctly', () => {
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(59999)).toBe('60.0s');
    });

    it('formats minutes correctly', () => {
      expect(formatDuration(60000)).toBe('1.0m');
      expect(formatDuration(90000)).toBe('1.5m');
      expect(formatDuration(3600000)).toBe('60.0m');
    });

    it('handles hours (extended case)', () => {
      // Current implementation doesn't have hour formatting
      // This would format as minutes
      expect(formatDuration(7200000)).toBe('120.0m'); // 2 hours = 120 minutes
      // TODO: Consider adding hour formatting if needed
    });

    it('handles edge cases', () => {
      expect(formatDuration(0)).toBe('0ms');
      // Negative durations (shouldn't occur but test for robustness)
      // TODO: Add negative duration handling if needed
    });
  });

  describe('formatTime', () => {
    it('formats ISO timestamps correctly', () => {
      const iso = '2025-11-08T12:00:00.000Z';
      const formatted = formatTime(iso);
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('handles invalid timestamps gracefully', () => {
      const invalid = 'not-a-timestamp';
      expect(formatTime(invalid)).toBe(invalid);
    });
  });

  describe('nowIso', () => {
    it('returns valid ISO 8601 timestamp', () => {
      const timestamp = nowIso();
      expect(typeof timestamp).toBe('string');
      expect(() => new Date(timestamp)).not.toThrow();
      const date = new Date(timestamp);
      expect(date.toISOString()).toBe(timestamp);
    });
  });

  describe('isStale', () => {
    it('returns true for null/undefined timestamps', () => {
      expect(isStale(null, 1000)).toBe(true);
      expect(isStale(undefined, 1000)).toBe(true);
    });

    it('returns true for invalid timestamps', () => {
      expect(isStale('invalid', 1000)).toBe(true);
    });

    it('returns true for stale timestamps', () => {
      const oldTimestamp = new Date(Date.now() - 10000).toISOString();
      expect(isStale(oldTimestamp, 5000)).toBe(true);
    });

    it('returns false for fresh timestamps', () => {
      const freshTimestamp = new Date(Date.now() - 1000).toISOString();
      expect(isStale(freshTimestamp, 5000)).toBe(false);
    });
  });

  describe('elapsed', () => {
    it('calculates elapsed time correctly', () => {
      const start = Date.now() - 1000;
      const elapsedMs = elapsed(start);
      expect(elapsedMs).toBeGreaterThanOrEqual(1000);
      expect(elapsedMs).toBeLessThan(1100); // Allow small margin
    });
  });
});
