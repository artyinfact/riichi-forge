// src/utils/tileNotation.ts
import type { TileId } from '../types';
import { toNormal } from './tile';

/**
 * Parse shorthand tile notation (e.g., "123m456p789s1234z") to TileId array
 * 
 * Format:
 * - Number tiles: digits + suit (m/p/s), e.g., "123m" = [11, 12, 13]
 * - Honor tiles: 1-7 + z, e.g., "1234567z" = [41, 42, 43, 44, 45, 46, 47]
 * - Red dora: 0 instead of 5, e.g., "0m" = 51 (red 5m)
 * 
 * @example
 * parseTileNotation("123456789m") // [11,12,13,14,15,16,17,18,19]
 * parseTileNotation("12340m")     // [11,12,13,14,51] (includes red 5m)
 * parseTileNotation("1234567z")   // [41,42,43,44,45,46,47]
 */
export function parseTileNotation(notation: string): TileId[] {
  const tiles: TileId[] = [];
  const normalized = notation.toLowerCase().trim();
  
  let buffer: string[] = [];
  
  for (const char of normalized) {
    if (/[0-9]/.test(char)) {
      buffer.push(char);
    } else if (/[mpsz]/.test(char)) {
      const suit = char;
      for (const num of buffer) {
        const tile = convertToTileId(num, suit);
        if (tile !== null) {
          tiles.push(tile);
        }
      }
      buffer = [];
    }
  }
  
  return tiles;
}

/**
 * Convert single digit + suit to TileId
 */
function convertToTileId(num: string, suit: string): TileId | null {
  const n = parseInt(num, 10);
  
  if (suit === 'z') {
    // Honor tiles: 1-7 -> 41-47
    if (n >= 1 && n <= 7) {
      return 40 + n;
    }
    return null;
  }
  
  // Number tiles
  const suitBase = suit === 'm' ? 10 : suit === 'p' ? 20 : 30;
  
  if (n === 0) {
    // Red 5
    return suitBase + 41; // 51, 52, 53
  }
  
  if (n >= 1 && n <= 9) {
    return suitBase + n;
  }
  
  return null;
}

/**
 * Convert TileId array to shorthand tile notation
 * 
 * @example
 * toTileNotation([11, 12, 13, 21, 22, 41]) // "123m12p1z"
 */
export function toTileNotation(tiles: TileId[]): string {
  if (tiles.length === 0) return '';
  
  const groups: { m: string[]; p: string[]; s: string[]; z: string[] } = {
    m: [], p: [], s: [], z: []
  };
  
  for (const tile of tiles) {
    const normal = toNormal(tile);
    
    if (normal >= 11 && normal <= 19) {
      groups.m.push(tile === 51 ? '0' : String(normal - 10));
    } else if (normal >= 21 && normal <= 29) {
      groups.p.push(tile === 52 ? '0' : String(normal - 20));
    } else if (normal >= 31 && normal <= 39) {
      groups.s.push(tile === 53 ? '0' : String(normal - 30));
    } else if (normal >= 41 && normal <= 47) {
      groups.z.push(String(normal - 40));
    }
  }
  
  let result = '';
  if (groups.m.length > 0) result += groups.m.join('') + 'm';
  if (groups.p.length > 0) result += groups.p.join('') + 'p';
  if (groups.s.length > 0) result += groups.s.join('') + 's';
  if (groups.z.length > 0) result += groups.z.join('') + 'z';
  
  return result;
}

/**
 * Validate tile notation format
 */
export function isValidTileNotation(notation: string): boolean {
  const tiles = parseTileNotation(notation);
  // Simple validation: if tiles can be parsed, it's valid
  return tiles.length > 0 || notation.trim() === '';
}
