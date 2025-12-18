// src/utils/tile.ts
import type { TileId } from '../types';

// ==========================================
// Constants & Helpers
// ==========================================

/**
 * Check if the tile is a red dora (aka dora)
 */
export const isRed = (tile: TileId): boolean => {
  return tile === 51 || tile === 52 || tile === 53;
};

/**
 * Convert red dora to normal tile ID (for logic calculation/sorting)
 * 51 -> 15 (5m)
 * 52 -> 25 (5p)
 * 53 -> 35 (5s)
 * Others -> return as is
 */
export const toNormal = (tile: TileId): TileId => {
  if (tile === 51) return 15;
  if (tile === 52) return 25;
  if (tile === 53) return 35;
  return tile;
};

/**
 * Convert normal 5 to red dora tile ID
 * 15 -> 51, 25 -> 52, 35 -> 53
 */
export const toRed = (tile: TileId): TileId => {
  if (tile === 15) return 51;
  if (tile === 25) return 52;
  if (tile === 35) return 53;
  return tile;
};

// ==========================================
// Deck Generators
// ==========================================

/**
 * Generate a complete deck of 136 tiles
 * @param withAka Whether to include red dora (default: true, one per suit)
 */
export const generateFullDeck = (withAka: boolean = true): TileId[] => {
  const deck: TileId[] = [];

  // 1. Generate number tiles (Man=10, Pin=20, Sou=30)
  const suits = [10, 20, 30];
  
  for (const suit of suits) {
    for (let i = 1; i <= 9; i++) {
      const tile = suit + i;
      
      // Handle red dora logic
      if (i === 5 && withAka) {
        // 3 normal 5s + 1 red 5
        // Red IDs: 51(m), 52(p), 53(s)
        // Mapping: 15->51, 25->52, 35->53
        let redId: number;
        if (suit === 10) redId = 51;
        else if (suit === 20) redId = 52;
        else redId = 53;

        deck.push(tile, tile, tile, redId);
      } else {
        // Normal case: 4 identical tiles
        deck.push(tile, tile, tile, tile);
      }
    }
  }

  // 2. Generate honor tiles (41-47)
  for (let i = 41; i <= 47; i++) {
    deck.push(i, i, i, i);
  }

  return deck;
};

// ==========================================
// Manipulators
// ==========================================

/**
 * Fisher-Yates shuffle algorithm (generic)
 * Returns a new shuffled array without modifying the original
 */
export const shuffle = <T>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Remove specified tiles from deck (for rigging/cheating deals)
 * Prints warning if the tile is not found in deck
 */
export const removeTilesFromDeck = (deck: TileId[], tilesToRemove: TileId[]): TileId[] => {
  const newDeck = [...deck];
  
  for (const t of tilesToRemove) {
    // Find tile position in deck
    const idx = newDeck.indexOf(t);
    
    if (idx > -1) {
      newDeck.splice(idx, 1);
    } else {
      // Fallback search: if requesting to remove 15 but only 51 exists, or vice versa?
      // Strategy: strict match. If Generator specifies red 5, must remove red 5.
      // For fuzzy removal, handle before calling this function.
      console.warn(`[Utils] removeTilesFromDeck: Tile ${t} not found in deck (ignored)`);
    }
  }
  return newDeck;
};

/**
 * Sort tiles for display (hand arrangement)
 * Order: Man -> Pin -> Sou -> Honor
 * Red dora (51,52,53) are treated as (15,25,35) for sorting, placed after normal 5s
 */
export const sortTiles = (tiles: TileId[]): TileId[] => {
  return [...tiles].sort((a, b) => {
    const valA = toNormal(a);
    const valB = toNormal(b);

    if (valA !== valB) {
      return valA - valB;
    }

    // If values are equal (e.g., both are 5m), put red dora after normal
    // Normal 5 (15) < Red 5 (51)
    return a - b;
  });
};

/**
 * Get tile suit (for debugging)
 * @returns 'm' | 'p' | 's' | 'z'
 */
export const getSuit = (tile: TileId): string => {
  const normal = toNormal(tile);
  if (normal >= 11 && normal <= 19) return 'm';
  if (normal >= 21 && normal <= 29) return 'p';
  if (normal >= 31 && normal <= 39) return 's';
  return 'z';
};
