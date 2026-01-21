// src/core/generator/LogGenerator.test.ts
import { describe, it, expect } from 'vitest';
import {
  isRoundLogComplete,
  isInputComplete,
  generate,
  generateJson,
  completeRoundLog,
  LogGenerator,
} from './LogGenerator';
import type { GeneratorInput, RoundLog, TenhouRule } from '../../types';

describe('LogGenerator', () => {
  // Helper to create a minimal valid RoundLog
  function createMinimalRoundLog(complete = true): RoundLog {
    const haipai = [11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24];
    const draws = complete ? [25] : [null];
    const discards = complete ? [11] : [null];

    return [
      [0, 0, 0], // round info
      [25000, 25000, 25000, 25000], // starting points
      [37], // dora
      [], // ura dora
      haipai, draws, discards, // East
      haipai, draws, discards, // South
      haipai, draws, discards, // West
      haipai, draws, discards, // North
      ['流局', [0, 0, 0, 0]], // result
    ] as RoundLog;
  }

  function createMinimalInput(complete = true): GeneratorInput {
    return {
      roundLog: createMinimalRoundLog(complete),
      playerEvents: [[], [], [], []],
      heroSeat: 0,
      rule: { aka: 1 },
    };
  }

  describe('isRoundLogComplete', () => {
    it('should return true for complete RoundLog', () => {
      const roundLog = createMinimalRoundLog(true);
      expect(isRoundLogComplete(roundLog)).toBe(true);
    });

    it('should return false when draws contain null', () => {
      const roundLog = createMinimalRoundLog(true);
      (roundLog[5] as (number | null)[])[0] = null; // East draws[0] = null
      expect(isRoundLogComplete(roundLog)).toBe(false);
    });

    it('should return false when discards contain null', () => {
      const roundLog = createMinimalRoundLog(true);
      (roundLog[6] as (number | null)[])[0] = null; // East discards[0] = null
      expect(isRoundLogComplete(roundLog)).toBe(false);
    });

    it('should return false when haipai is incomplete', () => {
      const roundLog = createMinimalRoundLog(true);
      (roundLog[4] as number[]).pop(); // Remove one tile from East haipai
      expect(isRoundLogComplete(roundLog)).toBe(false);
    });
  });

  describe('isInputComplete', () => {
    it('should return true for complete input', () => {
      const input = createMinimalInput(true);
      expect(isInputComplete(input)).toBe(true);
    });

    it('should return false for incomplete input', () => {
      const input = createMinimalInput(false);
      expect(isInputComplete(input)).toBe(false);
    });
  });

  describe('LogGenerator class', () => {
    it('should generate TenhouLogJson with default options', () => {
      const input = createMinimalInput(true);
      const generator = new LogGenerator(input);
      const result = generator.generate();

      expect(result.title).toBeDefined();
      expect(result.title.length).toBe(2);
      expect(result.name).toEqual(['東家', '南家', '西家', '北家']);
      expect(result.rule).toBeDefined();
      expect(result.log.length).toBe(1);
    });

    it('should use custom options when provided', () => {
      const input = createMinimalInput(true);
      const generator = new LogGenerator(input, {
        roomName: 'Test Room',
        playerNames: ['A', 'B', 'C', 'D'],
      });
      const result = generator.generate();

      expect(result.title[0]).toBe('Test Room');
      expect(result.name).toEqual(['A', 'B', 'C', 'D']);
    });
  });

  describe('generate function', () => {
    it('should generate TenhouLogJson from input', () => {
      const input = createMinimalInput(true);
      const result = generate(input);

      expect(result.title).toBeDefined();
      expect(result.log).toBeDefined();
    });
  });

  describe('generateJson function', () => {
    it('should return JSON string', () => {
      const input = createMinimalInput(true);
      const result = generateJson(input);

      expect(typeof result).toBe('string');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should format JSON when pretty=true', () => {
      const input = createMinimalInput(true);
      const compact = generateJson(input, {}, false);
      const pretty = generateJson(input, {}, true);

      expect(pretty.length).toBeGreaterThan(compact.length);
      expect(pretty).toContain('\n');
    });
  });

  describe('completeRoundLog function', () => {
    it('should return same RoundLog when already complete', () => {
      const input = createMinimalInput(true);
      const result = completeRoundLog(input);
      expect(result).toEqual(input.roundLog);
    });

    it('should complete RoundLog when incomplete', () => {
      const input = createMinimalInput(false);
      const result = completeRoundLog(input);

      // Check that null values have been filled
      for (let seat = 0; seat < 4; seat++) {
        const baseIdx = 4 + seat * 3;
        const draws = result[baseIdx + 1] as (number | string | null)[];
        const discards = result[baseIdx + 2] as (number | string | null)[];

        expect(draws.some((d) => d === null)).toBe(false);
        expect(discards.some((d) => d === null)).toBe(false);
      }
    });
  });
});

