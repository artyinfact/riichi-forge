// src/utils/validator.test.ts
import { describe, it, expect } from 'vitest';
import {
  isValidTileId,
  validateTileArray,
  validateTileCount,
  validateCallString,
  validateRiichiString,
  isValidRoundLog,
} from './validator';
import type { TenhouRule, RoundLog } from '../types';

describe('validator utilities', () => {
  describe('isValidTileId', () => {
    it('should accept valid man tiles (11-19)', () => {
      for (let i = 11; i <= 19; i++) {
        expect(isValidTileId(i)).toBe(true);
      }
    });

    it('should accept valid pin tiles (21-29)', () => {
      for (let i = 21; i <= 29; i++) {
        expect(isValidTileId(i)).toBe(true);
      }
    });

    it('should accept valid sou tiles (31-39)', () => {
      for (let i = 31; i <= 39; i++) {
        expect(isValidTileId(i)).toBe(true);
      }
    });

    it('should accept valid honor tiles (41-47)', () => {
      for (let i = 41; i <= 47; i++) {
        expect(isValidTileId(i)).toBe(true);
      }
    });

    it('should accept red dora tiles (51-53)', () => {
      expect(isValidTileId(51)).toBe(true);
      expect(isValidTileId(52)).toBe(true);
      expect(isValidTileId(53)).toBe(true);
    });

    it('should reject invalid tile IDs', () => {
      expect(isValidTileId(0)).toBe(false);
      expect(isValidTileId(10)).toBe(false);
      expect(isValidTileId(20)).toBe(false);
      expect(isValidTileId(30)).toBe(false);
      expect(isValidTileId(40)).toBe(false);
      expect(isValidTileId(48)).toBe(false);
      expect(isValidTileId(50)).toBe(false);
      expect(isValidTileId(54)).toBe(false);
      expect(isValidTileId(60)).toBe(false);
      expect(isValidTileId(100)).toBe(false);
    });

    it('should reject non-numbers', () => {
      expect(isValidTileId('11')).toBe(false);
      expect(isValidTileId(null)).toBe(false);
      expect(isValidTileId(undefined)).toBe(false);
    });
  });

  describe('validateTileArray', () => {
    it('should return no errors for valid tiles', () => {
      const tiles = [11, 21, 31, 41, 51];
      const errors = validateTileArray(tiles, 'test');
      expect(errors.length).toBe(0);
    });

    it('should skip null values', () => {
      const tiles = [11, null, 21];
      const errors = validateTileArray(tiles, 'test');
      expect(errors.length).toBe(0);
    });

    it('should return errors for invalid tiles', () => {
      const tiles = [11, 100, 0];
      const errors = validateTileArray(tiles, 'test');
      expect(errors.length).toBe(2);
    });
  });

  describe('validateTileCount', () => {
    const rule: TenhouRule = { aka: 1 };

    it('should return no errors when tile counts are valid', () => {
      const tiles = [11, 11, 11, 11]; // 4 copies of 1m
      const errors = validateTileCount(tiles, rule);
      expect(errors.length).toBe(0);
    });

    it('should return error when tile appears more than 4 times', () => {
      const tiles = [11, 11, 11, 11, 11]; // 5 copies of 1m
      const errors = validateTileCount(tiles, rule);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('5 times');
    });

    it('should return error when red dora exceeds rule limit', () => {
      const tiles = [51, 51]; // 2 red 5m, but rule allows only 1
      const errors = validateTileCount(tiles, rule);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('Red tile');
    });

    it('should treat red and normal 5 as same tile for total count', () => {
      const tiles = [15, 15, 15, 51]; // 3 normal 5m + 1 red 5m = 4 total
      const errors = validateTileCount(tiles, rule);
      expect(errors.length).toBe(0);
    });
  });

  describe('validateCallString', () => {
    describe('chi (c)', () => {
      it('should accept valid chi strings', () => {
        const errors = validateCallString('c121113', 'test'); // chi 2m with 1m+3m
        expect(errors.length).toBe(0);
      });

      it('should accept chi with red dora', () => {
        const errors = validateCallString('c141351', 'test'); // chi 4m with 3m+red5m
        expect(errors.length).toBe(0);
      });

      it('should reject chi with wrong tile count', () => {
        const errors = validateCallString('c11121314', 'test'); // 4 tiles instead of 3
        expect(errors.some((e) => e.message.includes('3 tiles'))).toBe(true);
      });

      it('should reject chi with non-sequence', () => {
        const errors = validateCallString('c111113', 'test'); // not a sequence
        expect(errors.some((e) => e.message.includes('sequence'))).toBe(true);
      });
    });

    describe('pon (p)', () => {
      it('should accept valid pon strings', () => {
        expect(validateCallString('p181818', 'test').length).toBe(0); // pon from kamicha
        expect(validateCallString('18p1818', 'test').length).toBe(0); // pon from toimen
        expect(validateCallString('1818p18', 'test').length).toBe(0); // pon from shimocha
      });

      it('should reject pon with different tiles', () => {
        const errors = validateCallString('p181719', 'test');
        expect(errors.some((e) => e.message.includes('same'))).toBe(true);
      });
    });

    describe('kan (m/a/k)', () => {
      it('should accept valid minkan strings', () => {
        expect(validateCallString('m38383838', 'test').length).toBe(0);
        expect(validateCallString('38m383838', 'test').length).toBe(0);
        expect(validateCallString('383838m38', 'test').length).toBe(0);
      });

      it('should accept valid ankan strings', () => {
        expect(validateCallString('151515a15', 'test').length).toBe(0);
        expect(validateCallString('151515a51', 'test').length).toBe(0); // with red
      });

      it('should accept valid kakan strings', () => {
        expect(validateCallString('k18181818', 'test').length).toBe(0);
        expect(validateCallString('18k181818', 'test').length).toBe(0);
        expect(validateCallString('1818k1818', 'test').length).toBe(0);
      });

      it('should reject kan with wrong tile count', () => {
        const errors = validateCallString('m383838', 'test'); // only 3 tiles
        expect(errors.some((e) => e.message.includes('4 tiles'))).toBe(true);
      });
    });

    it('should reject strings with multiple type markers', () => {
      const errors = validateCallString('cp181818', 'test');
      expect(errors.some((e) => e.message.includes('exactly one'))).toBe(true);
    });

    it('should reject strings with no type markers', () => {
      const errors = validateCallString('181818', 'test');
      expect(errors.some((e) => e.message.includes('exactly one'))).toBe(true);
    });
  });

  describe('validateRiichiString', () => {
    it('should accept valid riichi strings', () => {
      expect(validateRiichiString('r15', 'test').length).toBe(0);
      expect(validateRiichiString('r60', 'test').length).toBe(0);
      expect(validateRiichiString('r51', 'test').length).toBe(0);
    });

    it('should reject strings not starting with r', () => {
      const errors = validateRiichiString('15', 'test');
      expect(errors.some((e) => e.message.includes("start with 'r'"))).toBe(true);
    });

    it('should reject invalid tile in riichi string', () => {
      const errors = validateRiichiString('r99', 'test');
      expect(errors.some((e) => e.message.includes('Invalid tile'))).toBe(true);
    });
  });

  describe('isValidRoundLog', () => {
    const rule: TenhouRule = { aka: 1 };

    it('should validate a minimal valid RoundLog', () => {
      const roundLog: RoundLog = [
        [0, 0, 0], // round info
        [25000, 25000, 25000, 25000], // starting points
        [37], // dora
        [], // ura dora
        [11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24], // East haipai
        [], // East draws
        [], // East discards
        [31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 43, 44], // South haipai
        [], // South draws
        [], // South discards
        [11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23, 24, 25], // West haipai
        [], // West draws
        [], // West discards
        [31, 32, 33, 34, 36, 37, 38, 39, 41, 42, 43, 44, 45], // North haipai
        [], // North draws
        [], // North discards
        ['流局', [0, 0, 0, 0]], // result
      ];

      expect(isValidRoundLog(roundLog, rule)).toBe(true);
    });
  });
});

