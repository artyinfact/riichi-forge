// src/core/solver/NaiveSolver.test.ts
import { describe, it, expect } from 'vitest';
import { NaiveSolver, solve } from './NaiveSolver';
import type { GeneratorInput, RoundLog, TileId } from '../../types';

describe('NaiveSolver', () => {
  // Create a minimal input with hero at seat 0
  function createTestInput(overrides: Partial<GeneratorInput> = {}): GeneratorInput {
    // Hero has a complete hand
    const heroHaipai: TileId[] = [11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24];

    const roundLog: RoundLog = [
      [0, 0, 0], // round info
      [25000, 25000, 25000, 25000], // starting points
      [37], // dora indicator
      [], // ura dora
      heroHaipai, [null, null, null], [null, null, null], // East (hero)
      [], [null, null, null], [null, null, null], // South
      [], [null, null, null], [null, null, null], // West
      [], [null, null, null], [null, null, null], // North
      ['流局', [0, 0, 0, 0]], // result
    ];

    return {
      roundLog,
      playerEvents: [[], [], [], []],
      heroSeat: 0,
      rule: { aka: 1 },
      ...overrides,
    };
  }

  describe('basic completion', () => {
    it('should fill in opponent haipai', () => {
      const input = createTestInput();
      const solver = new NaiveSolver(input);
      const result = solver.solve();

      // Check all opponents have 13 tiles
      for (let seat = 1; seat < 4; seat++) {
        const baseIdx = 4 + seat * 3;
        const haipai = result[baseIdx] as TileId[];
        expect(haipai.length).toBe(13);
      }
    });

    it('should fill in null draws', () => {
      const input = createTestInput();
      const solver = new NaiveSolver(input);
      const result = solver.solve();

      // Check draws are filled
      for (let seat = 0; seat < 4; seat++) {
        const baseIdx = 4 + seat * 3;
        const draws = result[baseIdx + 1] as (number | string | null)[];

        for (const draw of draws) {
          expect(draw).not.toBe(null);
        }
      }
    });

    it('should fill in null discards', () => {
      const input = createTestInput();
      const solver = new NaiveSolver(input);
      const result = solver.solve();

      // Check discards are filled
      for (let seat = 0; seat < 4; seat++) {
        const baseIdx = 4 + seat * 3;
        const discards = result[baseIdx + 2] as (number | string | null)[];

        for (const discard of discards) {
          expect(discard).not.toBe(null);
        }
      }
    });
  });

  describe('solve convenience function', () => {
    it('should work the same as NaiveSolver.solve()', () => {
      const input = createTestInput();
      const solverResult = new NaiveSolver(input).solve();
      const funcResult = solve(input);

      // Results should have same structure
      expect(funcResult.length).toBe(solverResult.length);
    });
  });

  describe('player events', () => {
    it('should handle ankan event', () => {
      // Hero has 4 of a tile for ankan
      const heroHaipai: TileId[] = [11, 11, 11, 11, 15, 16, 17, 18, 19, 21, 22, 23, 24];

      const roundLog: RoundLog = [
        [0, 0, 0],
        [25000, 25000, 25000, 25000],
        [37],
        [],
        heroHaipai, [25, null, null], [null, null, null], // East
        [], [null, null, null], [null, null, null],
        [], [null, null, null], [null, null, null],
        [], [null, null, null], [null, null, null],
        ['流局', [0, 0, 0, 0]],
      ];

      const input: GeneratorInput = {
        roundLog,
        playerEvents: [
          [{ type: 'ANKAN', turn: 0, callMelds: [11, 11, 11, 11] }], // East ankans 1m
          [],
          [],
          [],
        ],
        heroSeat: 0,
        rule: { aka: 1 },
      };

      const solver = new NaiveSolver(input);
      const result = solver.solve();

      // Check that ankan string appears in East's draws
      const eastDraws = result[5] as (number | string)[];
      const hasAnkan = eastDraws.some(
        (d) => typeof d === 'string' && d.includes('a')
      );
      expect(hasAnkan).toBe(true);

      // Check that 0 placeholder appears in discards
      const eastDiscards = result[6] as (number | string)[];
      expect(eastDiscards.includes(0)).toBe(true);
    });
  });

  describe('tile accounting', () => {
    it('should generate valid tiles from deck', () => {
      const input = createTestInput();
      const solver = new NaiveSolver(input);
      const result = solver.solve();

      // Check that draws contain valid tile IDs or call strings
      for (let seat = 0; seat < 4; seat++) {
        const baseIdx = 4 + seat * 3;
        const draws = result[baseIdx + 1] as (number | string)[];

        for (const d of draws) {
          if (typeof d === 'number') {
            // Valid tile IDs: 11-19, 21-29, 31-39, 41-47, 51-53
            const isValid =
              (d >= 11 && d <= 19) ||
              (d >= 21 && d <= 29) ||
              (d >= 31 && d <= 39) ||
              (d >= 41 && d <= 47) ||
              (d >= 51 && d <= 53);
            expect(isValid).toBe(true);
          } else if (typeof d === 'string') {
            // Should be a valid call string
            expect(d.match(/[cpamk]/)).not.toBe(null);
          }
        }
      }
    });
  });
});

