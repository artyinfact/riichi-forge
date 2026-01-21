// src/utils/tile.test.ts
import { describe, it, expect } from 'vitest';
import {
  isRed,
  toNormal,
  toRed,
  generateFullDeck,
  shuffle,
  removeTilesFromDeck,
  sortTiles,
  getSuit,
} from './tile';

describe('tile utilities', () => {
  describe('isRed', () => {
    it('should return true for red dora tiles', () => {
      expect(isRed(51)).toBe(true); // red 5m
      expect(isRed(52)).toBe(true); // red 5p
      expect(isRed(53)).toBe(true); // red 5s
    });

    it('should return false for normal tiles', () => {
      expect(isRed(15)).toBe(false); // normal 5m
      expect(isRed(25)).toBe(false); // normal 5p
      expect(isRed(35)).toBe(false); // normal 5s
      expect(isRed(11)).toBe(false); // 1m
      expect(isRed(41)).toBe(false); // east
    });
  });

  describe('toNormal', () => {
    it('should convert red dora to normal tiles', () => {
      expect(toNormal(51)).toBe(15);
      expect(toNormal(52)).toBe(25);
      expect(toNormal(53)).toBe(35);
    });

    it('should return normal tiles unchanged', () => {
      expect(toNormal(15)).toBe(15);
      expect(toNormal(11)).toBe(11);
      expect(toNormal(47)).toBe(47);
    });
  });

  describe('toRed', () => {
    it('should convert normal 5s to red dora', () => {
      expect(toRed(15)).toBe(51);
      expect(toRed(25)).toBe(52);
      expect(toRed(35)).toBe(53);
    });

    it('should return non-5 tiles unchanged', () => {
      expect(toRed(11)).toBe(11);
      expect(toRed(19)).toBe(19);
      expect(toRed(41)).toBe(41);
    });
  });

  describe('generateFullDeck', () => {
    it('should generate 136 tiles with aka', () => {
      const deck = generateFullDeck(true);
      expect(deck.length).toBe(136);
    });

    it('should generate 136 tiles without aka', () => {
      const deck = generateFullDeck(false);
      expect(deck.length).toBe(136);
    });

    it('should include exactly one red dora per suit when withAka=true', () => {
      const deck = generateFullDeck(true);
      expect(deck.filter((t) => t === 51).length).toBe(1);
      expect(deck.filter((t) => t === 52).length).toBe(1);
      expect(deck.filter((t) => t === 53).length).toBe(1);
      // 3 normal 5s per suit
      expect(deck.filter((t) => t === 15).length).toBe(3);
      expect(deck.filter((t) => t === 25).length).toBe(3);
      expect(deck.filter((t) => t === 35).length).toBe(3);
    });

    it('should have no red dora when withAka=false', () => {
      const deck = generateFullDeck(false);
      expect(deck.filter((t) => t === 51).length).toBe(0);
      expect(deck.filter((t) => t === 52).length).toBe(0);
      expect(deck.filter((t) => t === 53).length).toBe(0);
      // 4 normal 5s per suit
      expect(deck.filter((t) => t === 15).length).toBe(4);
      expect(deck.filter((t) => t === 25).length).toBe(4);
      expect(deck.filter((t) => t === 35).length).toBe(4);
    });

    it('should have 4 copies of each non-5 tile', () => {
      const deck = generateFullDeck(true);
      expect(deck.filter((t) => t === 11).length).toBe(4); // 1m
      expect(deck.filter((t) => t === 19).length).toBe(4); // 9m
      expect(deck.filter((t) => t === 41).length).toBe(4); // east
      expect(deck.filter((t) => t === 47).length).toBe(4); // chun
    });
  });

  describe('shuffle', () => {
    it('should return a new array with same length', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffle(original);
      expect(shuffled.length).toBe(original.length);
    });

    it('should not modify the original array', () => {
      const original = [1, 2, 3, 4, 5];
      const copy = [...original];
      shuffle(original);
      expect(original).toEqual(copy);
    });

    it('should contain all original elements', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffle(original);
      expect(shuffled.sort()).toEqual(original.sort());
    });
  });

  describe('removeTilesFromDeck', () => {
    it('should remove specified tiles', () => {
      const deck = [11, 11, 12, 13, 14];
      const result = removeTilesFromDeck(deck, [11, 12]);
      expect(result.length).toBe(3);
      expect(result.filter((t) => t === 11).length).toBe(1);
      expect(result.includes(12)).toBe(false);
    });

    it('should not modify the original deck', () => {
      const deck = [11, 12, 13];
      const copy = [...deck];
      removeTilesFromDeck(deck, [11]);
      expect(deck).toEqual(copy);
    });

    it('should handle missing tiles gracefully', () => {
      const deck = [11, 12, 13];
      // Should not throw, just warn
      const result = removeTilesFromDeck(deck, [99]);
      expect(result).toEqual(deck);
    });
  });

  describe('sortTiles', () => {
    it('should sort tiles in order: man -> pin -> sou -> honor', () => {
      const tiles = [41, 21, 31, 11]; // east, 1p, 1s, 1m
      const sorted = sortTiles(tiles);
      expect(sorted).toEqual([11, 21, 31, 41]);
    });

    it('should sort within each suit by number', () => {
      const tiles = [19, 15, 11, 13];
      const sorted = sortTiles(tiles);
      expect(sorted).toEqual([11, 13, 15, 19]);
    });

    it('should place red dora after normal 5', () => {
      const tiles = [51, 15, 14, 16]; // red 5m, 5m, 4m, 6m
      const sorted = sortTiles(tiles);
      expect(sorted).toEqual([14, 15, 51, 16]);
    });

    it('should not modify the original array', () => {
      const tiles = [21, 11, 31];
      const copy = [...tiles];
      sortTiles(tiles);
      expect(tiles).toEqual(copy);
    });
  });

  describe('getSuit', () => {
    it('should return m for man tiles', () => {
      expect(getSuit(11)).toBe('m');
      expect(getSuit(15)).toBe('m');
      expect(getSuit(19)).toBe('m');
      expect(getSuit(51)).toBe('m'); // red 5m
    });

    it('should return p for pin tiles', () => {
      expect(getSuit(21)).toBe('p');
      expect(getSuit(25)).toBe('p');
      expect(getSuit(29)).toBe('p');
      expect(getSuit(52)).toBe('p'); // red 5p
    });

    it('should return s for sou tiles', () => {
      expect(getSuit(31)).toBe('s');
      expect(getSuit(35)).toBe('s');
      expect(getSuit(39)).toBe('s');
      expect(getSuit(53)).toBe('s'); // red 5s
    });

    it('should return z for honor tiles', () => {
      expect(getSuit(41)).toBe('z'); // east
      expect(getSuit(44)).toBe('z'); // north
      expect(getSuit(47)).toBe('z'); // chun
    });
  });
});

