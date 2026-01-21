// src/core/solver/NaiveSolver.ts

import type {
  GeneratorInput,
  RoundLog,
  TileId,
  TenhouJsonDraw,
  TenhouJsonDiscard,
  TenhouRule,
  PlayerEvent,
} from '../../types';
import { removeTilesFromDeck, shuffle, toNormal } from '../../utils/tile';

/**
 * NaiveSolver - Complete unknown parts of input Tenhou Log
 *
 * Discard priority:
 * 1. Genbutsu (safe tiles) (if someone riichi'd: riichi player's discards + all discards after riichi)
 * 2. Honor tiles (41-47)
 * 3. 19 (x1, x9)
 * 4. 28 (x2, x8)
 * 5. 37 (x3, x7)
 * 6. 456 (x4, x5, x6)
 *
 * Random selection within same priority
 */

// ==========================================
// Priority Constants
// ==========================================

const PRIORITY_GENBUTSU = 0; // Genbutsu (safe tiles) - highest priority
const PRIORITY_HONOR = 1; // Honor tiles
const PRIORITY_TERMINAL = 2; // 19
const PRIORITY_28 = 3; // 28
const PRIORITY_37 = 4; // 37
const PRIORITY_456 = 5; // 456

// ==========================================
// Types
// ==========================================

interface ScheduledEvent extends PlayerEvent {
  seat: number;
  turn: number; // Determined turn number
  processed: boolean;
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Get tile discard priority (excluding genbutsu)
 */
function getBasePriority(tile: TileId): number {
  const normal = toNormal(tile);

  // Honor tiles 41-47
  if (normal >= 41 && normal <= 47) {
    return PRIORITY_HONOR;
  }

  // Number tiles
  const num = normal % 10;
  if (num === 1 || num === 9) return PRIORITY_TERMINAL;
  if (num === 2 || num === 8) return PRIORITY_28;
  if (num === 3 || num === 7) return PRIORITY_37;
  return PRIORITY_456; // 4, 5, 6
}

/**
 * Extract actual TileId from discard
 */
function extractTileFromDiscard(discard: TenhouJsonDiscard): TileId | null {
  if (discard === null || discard === 0) return null;

  if (typeof discard === 'number') {
    return discard === 60 ? null : discard;
  }

  // Riichi string "r15" -> 15, "r60" -> null
  if (typeof discard === 'string' && discard.startsWith('r')) {
    const tileStr = discard.slice(1);
    const tileNum = parseInt(tileStr, 10);
    return tileNum === 60 ? null : tileNum;
  }

  return null;
}

/**
 * Check if discard is riichi declaration
 */
function isRiichiDiscard(discard: TenhouJsonDiscard): boolean {
  return typeof discard === 'string' && discard.startsWith('r');
}

/**
 * Check if string is call (meld)
 */
function isCallString(draw: TenhouJsonDraw): boolean {
  if (typeof draw !== 'string') return false;
  return (
    draw.includes('c') ||
    draw.includes('p') ||
    draw.includes('m') ||
    draw.includes('a') ||
    draw.includes('k')
  );
}

/**
 * Check if kan (minkan, ankan, kakan)
 */
function isKanString(draw: TenhouJsonDraw): boolean {
  if (typeof draw !== 'string') return false;
  return draw.includes('m') || draw.includes('a') || draw.includes('k');
}

/**
 * Extract related tiles from call string
 */
function extractTilesFromCallString(callStr: string): TileId[] {
  const tiles: TileId[] = [];
  const cleaned = callStr.replace(/[cpamk]/g, '');

  for (let i = 0; i < cleaned.length; i += 2) {
    const tileStr = cleaned.slice(i, i + 2);
    const tile = parseInt(tileStr, 10);
    if (!isNaN(tile)) {
      tiles.push(tile);
    }
  }

  return tiles;
}

/**
 * Format tile number as 2-digit string
 */
function formatTile(tile: TileId): string {
  return tile.toString().padStart(2, '0');
}

/**
 * Build chi call string
 * Chi: "c" + called_tile + hand_tile1 + hand_tile2
 */
function buildChiString(
  calledTile: TileId,
  meldTiles: TileId[]
): string {
  return `c${formatTile(calledTile)}${formatTile(meldTiles[0])}${formatTile(meldTiles[1])}`;
}

/**
 * Build pon call string
 * Pon: "p" position indicates source
 *   Index 0: from kamicha (left player)  → "p181818"
 *   Index 2: from toimen (across player)   → "18p1818"
 *   Index 4: from shimocha (right player) → "1818p18"
 */
function buildPonString(
  calledTile: TileId,
  meldTiles: TileId[],
  callerSeat: number,
  fromSeat: number
): string {
  const relPos = (fromSeat - callerSeat + 4) % 4; // 3=kamicha, 2=toimen, 1=shimocha
  const t1 = formatTile(meldTiles[0]);
  const t2 = formatTile(meldTiles[1]);
  const tc = formatTile(calledTile);

  if (relPos === 3) {
    // kamicha (left player)
    return `p${tc}${t1}${t2}`;
  } else if (relPos === 2) {
    // toimen (across player)
    return `${tc}p${t1}${t2}`;
  } else {
    // shimocha (right player, relPos === 1)
    return `${t1}${t2}p${tc}`;
  }
}

/**
 * Build minkan call string
 * Minkan: "m" position indicates source
 *   Index 0: from kamicha (left player)  → "m38383838"
 *   Index 2: from toimen (across player)   → "38m383838"
 *   Index 6: from shimocha (right player) → "383838m38"
 */
function buildMinkanString(
  calledTile: TileId,
  meldTiles: TileId[],
  callerSeat: number,
  fromSeat: number
): string {
  const relPos = (fromSeat - callerSeat + 4) % 4; // 3=kamicha, 2=toimen, 1=shimocha
  const tc = formatTile(calledTile);
  const t1 = formatTile(meldTiles[0]);
  const t2 = formatTile(meldTiles[1]);
  const t3 = formatTile(meldTiles[2]);

  if (relPos === 3) {
    // kamicha (left player)
    return `m${tc}${t1}${t2}${t3}`;
  } else if (relPos === 2) {
    // toimen (across player)
    return `${tc}m${t1}${t2}${t3}`;
  } else {
    // shimocha (right player, relPos === 1)
    return `${t1}${t2}${t3}m${tc}`;
  }
}

/**
 * Build ankan call string
 * Ankan: "a" always at index 6
 *   "151515a15"
 */
function buildAnkanString(meldTiles: TileId[]): string {
  const t1 = formatTile(meldTiles[0]);
  const t2 = formatTile(meldTiles[1]);
  const t3 = formatTile(meldTiles[2]);
  const t4 = formatTile(meldTiles[3]);
  return `${t1}${t2}${t3}a${t4}`;
}

/**
 * Build kakan call string
 * Kakan: "k" position matches original pon
 */
function buildKakanString(
  addedTile: TileId,
  originalPonTiles: TileId[],
  callerSeat: number,
  originalFromSeat: number
): string {
  const relPos = (originalFromSeat - callerSeat + 4) % 4; // 3=kamicha, 2=toimen, 1=shimocha
  const tc = formatTile(addedTile);
  const t1 = formatTile(originalPonTiles[0]);
  const t2 = formatTile(originalPonTiles[1]);
  const t3 = formatTile(originalPonTiles[2]);

  if (relPos === 3) {
    // kamicha (left player)
    return `k${tc}${t1}${t2}${t3}`;
  } else if (relPos === 2) {
    // toimen (across player)
    return `${tc}k${t1}${t2}${t3}`;
  } else {
    // shimocha (right player, relPos === 1)
    return `${t1}${t2}k${tc}${t3}`;
  }
}

/**
 * Get aka (red dora) count config
 */
function getAkaCount(rule: TenhouRule): {
  aka51: number;
  aka52: number;
  aka53: number;
} {
  if (rule.aka !== undefined) {
    return { aka51: rule.aka, aka52: rule.aka, aka53: rule.aka };
  }
  return {
    aka51: rule.aka51 ?? 1,
    aka52: rule.aka52 ?? 1,
    aka53: rule.aka53 ?? 1,
  };
}

/**
 * Generate deck with custom red dora count
 */
function generateDeckWithAka(akaCount: {
  aka51: number;
  aka52: number;
  aka53: number;
}): TileId[] {
  const deck: TileId[] = [];
  const suits = [10, 20, 30];
  const redIds = [51, 52, 53];

  for (let suitIdx = 0; suitIdx < suits.length; suitIdx++) {
    const suit = suits[suitIdx];
    const redId = redIds[suitIdx];
    const redCount =
      suitIdx === 0
        ? akaCount.aka51
        : suitIdx === 1
          ? akaCount.aka52
          : akaCount.aka53;

    for (let i = 1; i <= 9; i++) {
      const tile = suit + i;

      if (i === 5 && redCount > 0) {
        const normalCount = 4 - redCount;
        for (let j = 0; j < normalCount; j++) deck.push(tile);
        for (let j = 0; j < redCount; j++) deck.push(redId);
      } else {
        deck.push(tile, tile, tile, tile);
      }
    }
  }

  for (let i = 41; i <= 47; i++) {
    deck.push(i, i, i, i);
  }

  return deck;
}

// ==========================================
// NaiveSolver Class
// ==========================================

export class NaiveSolver {
  private input: GeneratorInput;
  private deck: TileId[];
  private genbutsu: Set<number>;
  private riichiInfo: Map<number, { turn: number; discards: TileId[] }>;
  private scheduledEvents: ScheduledEvent[];
  private ponRegistry: Map<number, { tiles: TileId[]; fromSeat: number }[]>; // seat -> list of pons
  private lateEventStartTurn: number;
  private heroPreGeneratedDraws: TileId[] = [];
  private heroTargetFinalHand: TileId[] = [];
  private heroLastTurn: number = -1; // Hero's last turn (draw only, no discard)

  constructor(input: GeneratorInput) {
    this.input = input;
    this.genbutsu = new Set();
    this.riichiInfo = new Map();
    this.scheduledEvents = [];
    this.ponRegistry = new Map();
    this.lateEventStartTurn = 0;

    // Initialize deck
    this.deck = this.initializeDeck();

    // Process playerEvents
    this.processPlayerEvents();
  }

  /**
   * Initialize deck, remove known tiles
   */
  private initializeDeck(): TileId[] {
    const { rule, roundLog, playerEvents } = this.input;
    const akaCount = getAkaCount(rule);

    let deck = generateDeckWithAka(akaCount);
    const knownTiles: TileId[] = [];

    // Dora indicators
    knownTiles.push(...(roundLog[2] as number[]));
    knownTiles.push(...(roundLog[3] as number[]));

    // 4 players' hands and known draws/discards
    // Note: Hero's haipai is "final hand", not "starting hand", so don't remove from deck
    const { heroSeat } = this.input;
    for (let seat = 0; seat < 4; seat++) {
      const baseIdx = 4 + seat * 3;
      const haipai = roundLog[baseIdx] as TileId[];
      const draws = roundLog[baseIdx + 1] as TenhouJsonDraw[];
      const discards = roundLog[baseIdx + 2] as TenhouJsonDiscard[];

      // Hero's haipai is final hand, needs special handling (handled in solve())
      if (seat !== heroSeat) {
        knownTiles.push(...haipai);
      }

      for (const draw of draws) {
        if (draw !== null) {
          if (typeof draw === 'number') {
            knownTiles.push(draw);
          } else if (isCallString(draw)) {
            knownTiles.push(...extractTilesFromCallString(draw));
          }
        }
      }

      for (const discard of discards) {
        const tile = extractTileFromDiscard(discard);
        if (tile !== null) {
          knownTiles.push(tile);
        }
      }
    }

    // Remove callMelds from playerEvents (caller's hand tiles)
    // Note: Don't remove callTarget, it comes from others' discards, needs to stay in deck
    for (let seat = 0; seat < 4; seat++) {
      const events = playerEvents[seat];
      for (const event of events) {
        if (event.callMelds) {
          knownTiles.push(...event.callMelds);
        }
      }
    }

    deck = removeTilesFromDeck(deck, knownTiles);
    return shuffle(deck);
  }

  /**
   * Process playerEvents, determine turn for each event
   */
  private processPlayerEvents(): void {
    const { playerEvents } = this.input;

    for (let seat = 0; seat < 4; seat++) {
      const events = playerEvents[seat];

      for (const event of events) {
        const scheduledEvent: ScheduledEvent = {
          ...event,
          seat,
          turn: event.turn ?? -1, // -1 means needs auto-determination
          processed: false,
        };
        this.scheduledEvents.push(scheduledEvent);
      }
    }

    // Sort events with explicit turn
    this.scheduledEvents.sort((a, b) => {
      if (a.turn === -1 && b.turn === -1) return 0;
      if (a.turn === -1) return 1;
      if (b.turn === -1) return -1;
      return a.turn - b.turn;
    });
  }

  /**
   * Find event to trigger at specified turn
   */
  private findEventForTurn(
    seat: number,
    turn: number,
    lastDiscard: { seat: number; tile: TileId } | null
  ): ScheduledEvent | null {
    for (const event of this.scheduledEvents) {
      if (event.processed) continue;
      if (event.seat !== seat) continue;

      // If explicit turn, check if matches
      if (event.turn !== -1 && event.turn !== turn) continue;

      // For events needing auto-determination, check if conditions met
      if (event.turn === -1) {
        switch (event.type) {
          case 'CHI': {
            if (turn < this.lateEventStartTurn) break;
            // Chi requires kamicha to discard callTarget
            const kamicha = (seat + 3) % 4;
            if (
              lastDiscard &&
              lastDiscard.seat === kamicha &&
              event.callTarget !== undefined &&
              toNormal(lastDiscard.tile) === toNormal(event.callTarget)
            ) {
              event.turn = turn;
              return event;
            }
            break;
          }
          case 'PON':
          case 'MINKAN': {
            if (turn < this.lateEventStartTurn) break;
            // Pon/Minkan requires other player to discard callTarget
            if (
              lastDiscard &&
              lastDiscard.seat !== seat &&
              event.callTarget !== undefined &&
              toNormal(lastDiscard.tile) === toNormal(event.callTarget)
            ) {
              event.turn = turn;
              return event;
            }
            break;
          }
          case 'ANKAN':
          case 'KAKAN':
          case 'RIICHI': {
            // These trigger on own turn, simply return first unprocessed
            event.turn = turn;
            return event;
          }
        }
      } else {
        // Turn already matches
        return event;
      }
    }
    return null;
  }

  /**
   * Draw tile from deck
   */
  private drawFromDeck(): TileId {
    if (this.deck.length === 0) {
      console.warn('[NaiveSolver] Deck is empty, returning placeholder tile');
      return 41;
    }
    return this.deck.pop()!;
  }


  /**
   * Record riichi
   */
  private recordRiichi(seat: number, turn: number, discards: TenhouJsonDiscard[]): void {
    const riichiDiscards: TileId[] = [];
    for (let i = 0; i <= turn; i++) {
      if (i < discards.length) {
        const tile = extractTileFromDiscard(discards[i]);
        if (tile !== null) {
          riichiDiscards.push(tile);
          this.genbutsu.add(toNormal(tile));
        }
      }
    }
    this.riichiInfo.set(seat, { turn, discards: riichiDiscards });
  }

  /**
   * Ensure discard array has enough length
   */
  private ensureDiscardSlot(discards: TenhouJsonDiscard[], turn: number): void {
    while (discards.length <= turn) {
      discards.push(null);
    }
  }

  /**
   * If discard unknown (null) for this turn, force write target tile
   */
  private setDiscardIfUnknown(
    roundLog: RoundLog,
    seat: number,
    turn: number,
    tile: TileId
  ): void {
    if (turn < 0) return;
    const baseIdx = 4 + seat * 3;
    const discards = roundLog[baseIdx + 2] as TenhouJsonDiscard[];
    this.ensureDiscardSlot(discards, turn);
    if (discards[turn] === null) {
      discards[turn] = tile;
    }
  }

  /**
   * Force "consume" a tile from hand (if not found, remove another tile and deduct from deck)
   */
  private forceConsumeTileFromHand(seat: number, tile: TileId, hands: TileId[][]): void {
    const removed = this.removeFromHand(hands[seat], tile);
    if (removed) return;

    // Tile not in hand: swap a hand tile with target (keep total count unchanged)
    if (hands[seat].length > 0) {
      const poppedTile = hands[seat].pop()!;
      this.deck.push(poppedTile); // Put removed tile back to deck
    } else {
      console.warn(`[NaiveSolver] Hand is empty when forcing tile ${tile}`);
    }

    this.deck = removeTilesFromDeck(this.deck, [tile]);
  }

  /**
   * Ensure required tiles exist in hand (fill from deck if needed)
   */
  private ensureTilesInHand(seat: number, tiles: TileId[], hands: TileId[][]): void {
    for (const tile of tiles) {
      this.forceConsumeTileFromHand(seat, tile, hands);
    }
  }

  /**
   * Find seat of player who discarded target tile
   */
  private findSeatByDiscard(
    roundLog: RoundLog,
    callerSeat: number,
    turn: number,
    target: TileId
  ): number {
    for (let seat = 0; seat < 4; seat++) {
      if (seat === callerSeat) continue;
      const baseIdx = 4 + seat * 3;
      const discards = roundLog[baseIdx + 2] as TenhouJsonDiscard[];
      if (turn >= discards.length) continue;
      const tile = extractTileFromDiscard(discards[turn]);
      if (tile !== null && toNormal(tile) === toNormal(target)) {
        return seat;
      }
    }
    return -1;
  }

  /**
   * Pre-lock discards for chi/pon/minkan based on playerEvents
   */
  private applyPlannedCallDiscards(roundLog: RoundLog): void {
    for (const event of this.scheduledEvents) {
      if (event.turn === -1) continue;
      if (event.callTarget === undefined) continue;
      const sourceTurn = event.turn; // Same-turn discard

      if (event.type === 'CHI') {
        const fromSeat = this.getKamicha(event.seat);
        this.setDiscardIfUnknown(roundLog, fromSeat, sourceTurn, event.callTarget);
      } else if (event.type === 'PON' || event.type === 'MINKAN') {
        let fromSeat = this.findSeatByDiscard(
          roundLog,
          event.seat,
          sourceTurn,
          event.callTarget
        );
        if (fromSeat === -1) {
          fromSeat = this.getKamicha(event.seat);
        }
        this.setDiscardIfUnknown(roundLog, fromSeat, sourceTurn, event.callTarget);
      }
    }
  }

  /**
   * Get target tiles current seat needs to discard to trigger calls
   */
  private getPendingCallTargetsForSeat(seat: number): TileId[] {
    const targets: TileId[] = [];
    for (const event of this.scheduledEvents) {
      if (event.processed) continue;
      if (event.turn !== -1) continue;
      if (event.callTarget === undefined) continue;

      if (event.type === 'CHI') {
        const kamicha = this.getKamicha(event.seat);
        if (seat === kamicha) targets.push(event.callTarget);
      } else if (event.type === 'PON' || event.type === 'MINKAN') {
        if (seat !== event.seat) targets.push(event.callTarget);
      }
    }
    return targets;
  }

  /**
   * Update genbutsu set
   */
  private updateGenbutsu(tile: TileId, currentTurn: number): void {
    for (const [, info] of this.riichiInfo) {
      if (currentTurn >= info.turn) {
        this.genbutsu.add(toNormal(tile));
      }
    }
  }

  /**
   * Get tiles to reserve for current seat (for own calls + to discard for others' calls + riichi tile)
   */
  private getReservedTilesForSeat(seat: number): TileId[] {
    const reserved: TileId[] = [];
    for (const event of this.scheduledEvents) {
      if (event.processed) continue;

      // Own callMelds for calls
      if (event.seat === seat && event.callMelds) {
        reserved.push(...event.callMelds);
      }

      // Own riichi discard tile
      if (event.seat === seat && event.type === 'RIICHI' && event.discardTile !== undefined) {
        reserved.push(event.discardTile);
      }

      // callTarget to discard for others' calls
      if (event.callTarget !== undefined && event.turn !== -1) {
        let fromSeat: number;
        if (event.type === 'CHI') {
          fromSeat = this.getKamicha(event.seat);
        } else if (event.type === 'PON' || event.type === 'MINKAN') {
          // Simplified: assume kamicha discards
          fromSeat = this.getKamicha(event.seat);
        } else {
          continue;
        }
        if (fromSeat === seat) {
          reserved.push(event.callTarget);
        }
      }
    }
    return reserved;
  }

  /**
   * Select discard by priority
   * 
   * Hero special: prioritize discarding tiles not in targetFinalHand to ensure correct final hand
   */
  private selectDiscard(hand: TileId[], seat: number): TileId {
    if (hand.length === 0) {
      throw new Error('[NaiveSolver] Hand is empty, cannot select discard');
    }

    const { heroSeat } = this.input;
    const isHero = seat === heroSeat;

    // Get tiles reserved for future calls for this seat
    const reserved = this.getReservedTilesForSeat(seat);
    const reservedCounts: Map<number, number> = new Map();
    for (const t of reserved) {
      const n = toNormal(t);
      reservedCounts.set(n, (reservedCounts.get(n) ?? 0) + 1);
    }

    // Count each tile type in hand
    const handCounts: Map<number, number> = new Map();
    for (const t of hand) {
      const n = toNormal(t);
      handCounts.set(n, (handCounts.get(n) ?? 0) + 1);
    }

    // Hero special: count required amount of each tile in targetFinalHand
    let targetCounts: Map<number, number> = new Map();
    if (isHero && this.heroTargetFinalHand.length > 0) {
      for (const t of this.heroTargetFinalHand) {
        const n = toNormal(t);
        targetCounts.set(n, (targetCounts.get(n) ?? 0) + 1);
      }
    }

    const groups: Map<number, TileId[]> = new Map();

    for (const tile of hand) {
      const normalTile = toNormal(tile);

      // If tile is reserved and no extras in hand, skip
      const neededCount = reservedCounts.get(normalTile) ?? 0;
      const haveCount = handCounts.get(normalTile) ?? 0;
      if (neededCount > 0 && haveCount <= neededCount) {
        continue; // Cannot discard this tile
      }

      let priority: number;

      // Hero special priority: tiles not in targetFinalHand have highest discard priority
      if (isHero && this.heroTargetFinalHand.length > 0) {
        const targetNeed = targetCounts.get(normalTile) ?? 0;
        if (haveCount > targetNeed) {
          // Have extras (more than final hand needs), prioritize discarding
          priority = -1; // Highest priority
        } else {
          // Hand count <= final needed count, should not discard
          continue;
        }
      } else {
        // Normal priority for non-Hero
        if (this.genbutsu.has(normalTile)) {
          priority = PRIORITY_GENBUTSU;
        } else {
          priority = getBasePriority(tile);
        }
      }

      if (!groups.has(priority)) {
        groups.set(priority, []);
      }
      groups.get(priority)!.push(tile);
    }

    // If all tiles reserved (or all Hero's tiles needed for final), fall back to random
    if (groups.size === 0) {
      const idx = Math.floor(Math.random() * hand.length);
      return hand[idx];
    }

    const minPriority = Math.min(...groups.keys());
    const candidates = groups.get(minPriority)!;
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
  }

  /**
   * Remove one tile from hand
   */
  private removeFromHand(hand: TileId[], tile: TileId): boolean {
    const idx = hand.indexOf(tile);
    if (idx > -1) {
      hand.splice(idx, 1);
      return true;
    }
    // Try matching normalized value
    const normalIdx = hand.findIndex((t) => toNormal(t) === toNormal(tile));
    if (normalIdx > -1) {
      hand.splice(normalIdx, 1);
      return true;
    }
    return false;
  }

  /**
   * Remove multiple tiles from hand
   */
  private removeMultipleFromHand(hand: TileId[], tiles: TileId[]): void {
    for (const tile of tiles) {
      this.removeFromHand(hand, tile);
    }
  }

  /**
   * Get kamicha (left player) seat number
   */
  private getKamicha(seat: number): number {
    return (seat + 3) % 4;
  }

  /**
   * Execute solving
   * 
   * Important: Hero's input haipai is treated as "final hand" (hand at round end),
   * not starting hand. Solver will back-calculate starting hand.
   */
  solve(): RoundLog {
    const { roundLog, heroSeat } = this.input;

    // Deep copy roundLog
    const result: RoundLog = JSON.parse(JSON.stringify(roundLog));

    // Hero's input is treated as target final hand
    const heroBaseIdx = 4 + heroSeat * 3;
    const targetFinalHand = [...(result[heroBaseIdx] as TileId[])];

    // 0. Pre-lock necessary discards based on playerEvents
    this.applyPlannedCallDiscards(result);

    // 1. Collect tiles needed by each player
    // callMelds: caller's hand tiles (removed from deck, add directly to haipai)
    // callTarget: discarder's tiles (still in deck, need to remove)
    // riichiTile: riichi player's discard tile (still in deck, need to remove)
    const callMeldsBySeats: TileId[][] = [[], [], [], []];
    const callTargetsBySeats: TileId[][] = [[], [], [], []];
    const riichiTilesBySeats: TileId[][] = [[], [], [], []];

    for (const event of this.scheduledEvents) {
      // callMelds go to caller (removed from deck)
      if (event.callMelds) {
        callMeldsBySeats[event.seat].push(...event.callMelds);
      }
      // callTarget go to discarder (still in deck)
      if (event.callTarget !== undefined && event.turn !== -1) {
        let fromSeat: number;
        if (event.type === 'CHI') {
          fromSeat = this.getKamicha(event.seat);
        } else if (event.type === 'PON' || event.type === 'MINKAN') {
          fromSeat = this.findSeatByDiscard(result, event.seat, event.turn, event.callTarget);
          if (fromSeat === -1) {
            fromSeat = this.getKamicha(event.seat);
          }
        } else {
          continue;
        }
        // Only non-Hero needs processing
        if (fromSeat !== heroSeat) {
          callTargetsBySeats[fromSeat].push(event.callTarget);
        }
      }
      // Riichi discard tile (still in deck)
      if (event.type === 'RIICHI' && event.discardTile !== undefined) {
        if (event.seat !== heroSeat) {
          riichiTilesBySeats[event.seat].push(event.discardTile);
        }
      }
    }

    // 2. Fill opponent hands
    for (let seat = 0; seat < 4; seat++) {
      if (seat === heroSeat) continue;
      const baseIdx = 4 + seat * 3;
      const haipai = result[baseIdx] as TileId[];

      // First add callMelds (removed from deck, add directly)
      for (const tile of callMeldsBySeats[seat]) {
        haipai.push(tile);
      }

      // Then add callTarget (need to remove from deck)
      for (const tile of callTargetsBySeats[seat]) {
        haipai.push(tile);
        this.deck = removeTilesFromDeck(this.deck, [tile]);
      }

      // Add riichi discard tile (need to remove from deck)
      for (const tile of riichiTilesBySeats[seat]) {
        haipai.push(tile);
        this.deck = removeTilesFromDeck(this.deck, [tile]);
      }

      // Fill to 13 tiles randomly
      while (haipai.length < 13) {
        haipai.push(this.drawFromDeck());
      }
    }

    // 2.5 Handle Hero's hand: back-calculate starting hand from final hand
    // targetFinalHand is user-specified final hand (14 tiles, including last draw)
    // Need: pre-generate draws -> calculate starting hand (13 tiles)
    {
      const heroDraws = result[heroBaseIdx + 1] as TenhouJsonDraw[];
      const heroDiscards = result[heroBaseIdx + 2] as TenhouJsonDiscard[];
      
      // Estimate required turn count
      let estimatedTurns = Math.max(heroDraws.length, heroDiscards.length);
      const maxEventTurn = this.scheduledEvents
        .filter(e => e.turn !== -1)
        .reduce((max, e) => Math.max(max, e.turn), -1);
      if (maxEventTurn >= 0) {
        estimatedTurns = Math.max(estimatedTurns, maxEventTurn + 1);
      }
      if (estimatedTurns < 3) estimatedTurns = 6; // Default minimum 6 turns
      
      // 14-tile final = 13-tile starting + 1 last draw
      // Starting hand = first 13, 14th = last turn draw
      const heroStartingHaipai = targetFinalHand.slice(0, 13);
      const heroLastDraw = targetFinalHand.length >= 14 ? targetFinalHand[13] : null;
      
      // Remove starting hand tiles from deck (will be assigned to hero as haipai)
      this.deck = removeTilesFromDeck(this.deck, heroStartingHaipai);
      // Also remove last draw from deck (will be drawn on last turn)
      if (heroLastDraw !== null) {
        this.deck = removeTilesFromDeck(this.deck, [heroLastDraw]);
      }
      
      // Pre-generate Hero's draws (except last turn)
      const preGeneratedDraws: TileId[] = [];
      for (let t = 0; t < estimatedTurns; t++) {
        if (t === estimatedTurns - 1 && heroLastDraw !== null) {
          // Use 14th tile for last turn
          preGeneratedDraws.push(heroLastDraw);
        } else if (t < heroDraws.length && heroDraws[t] !== null) {
          // Known draw
          if (typeof heroDraws[t] === 'number') {
            preGeneratedDraws.push(heroDraws[t] as TileId);
          }
          // Call strings don't count as normal draws
        } else {
          // Random draw
          preGeneratedDraws.push(this.drawFromDeck());
        }
      }
      
      // Update Hero's starting hand in roundLog (13 tiles)
      (result[heroBaseIdx] as TileId[]).length = 0;
      (result[heroBaseIdx] as TileId[]).push(...heroStartingHaipai);
      
      // Save pre-generated draws and target final hand (for later use)
      // Note: heroTargetFinalHand stores 13 (starting), used for discard selection
      this.heroPreGeneratedDraws = preGeneratedDraws;
      this.heroTargetFinalHand = heroStartingHaipai; // 13 starting = tiles to keep
      this.heroLastTurn = estimatedTurns - 1; // Record last turn, no discard on this turn
    }

    // 2. First scan: find all known riichi
    for (let seat = 0; seat < 4; seat++) {
      const baseIdx = 4 + seat * 3;
      const discards = result[baseIdx + 2] as TenhouJsonDiscard[];
      for (let turn = 0; turn < discards.length; turn++) {
        if (isRiichiDiscard(discards[turn])) {
          this.recordRiichi(seat, turn, discards);
        }
      }
    }

    // 3. Calculate turns: use max discard array length as base
    let maxTurns = 0;
    for (let seat = 0; seat < 4; seat++) {
      const baseIdx = 4 + seat * 3;
      const discards = result[baseIdx + 2] as TenhouJsonDiscard[];
      maxTurns = Math.max(maxTurns, discards.length);
    }
    const maxExplicitTurn = this.scheduledEvents
      .filter((event) => event.turn !== -1)
      .reduce((max, event) => Math.max(max, event.turn), -1);
    if (maxExplicitTurn >= 0) {
      maxTurns = Math.max(maxTurns, maxExplicitTurn + 1);
    }
    // Calls default to trigger near end (within last 4 turns)
    this.lateEventStartTurn = Math.max(0, maxTurns - 4);

    // 4. Maintain each player's current hand
    const hands: TileId[][] = [];
    for (let seat = 0; seat < 4; seat++) {
      const baseIdx = 4 + seat * 3;
      hands[seat] = [...(result[baseIdx] as TileId[])];
    }

    // 5. Record each player's last discard (for call timing)
    const lastDiscardBySeat: Map<number, { tile: TileId; turn: number }> = new Map();
    let lastDiscard: { seat: number; tile: TileId } | null = null;

    // 6. Process by turn
    for (let turn = 0; turn < maxTurns; turn++) {
      for (let seat = 0; seat < 4; seat++) {
        const baseIdx = 4 + seat * 3;
        const draws = result[baseIdx + 1] as TenhouJsonDraw[];
        const discards = result[baseIdx + 2] as TenhouJsonDiscard[];
        const pendingTargets =
          turn >= this.lateEventStartTurn ? this.getPendingCallTargetsForSeat(seat) : [];

        // Ensure array is long enough
        while (draws.length <= turn) draws.push(null);
        while (discards.length <= turn) discards.push(null);

        let currentDraw = draws[turn];
        let currentDiscard = discards[turn];

        // === Check if playerEvent needs triggering ===
        const event = this.findEventForTurn(seat, turn, lastDiscard);

        if (event && !event.processed) {
          // Process event
          switch (event.type) {
            case 'CHI': {
              if (event.callTarget !== undefined && event.callMelds) {
                // Chi always from kamicha, no source encoding needed
                const callStr = buildChiString(event.callTarget, event.callMelds);
                draws[turn] = callStr;
                currentDraw = callStr;

                // Remove chi tiles from hand
                this.ensureTilesInHand(seat, event.callMelds, hands);
              }
              event.processed = true;
              break;
            }
            case 'PON': {
              if (event.callTarget !== undefined) {
                // Find who discarded: prefer actual lastDiscard that triggered call
                let fromSeat = -1;
                if (lastDiscard && toNormal(lastDiscard.tile) === toNormal(event.callTarget)) {
                  fromSeat = lastDiscard.seat;
                }
                if (fromSeat === -1) fromSeat = this.getKamicha(seat);

                // Find pon tiles from hand
                const meldTiles: TileId[] = event.callMelds ?? [];
                if (meldTiles.length < 2) {
                  const normalTarget = toNormal(event.callTarget);
                  for (const t of hands[seat]) {
                    if (toNormal(t) === normalTarget && meldTiles.length < 2) {
                      meldTiles.push(t);
                    }
                  }
                }

                const callStr = buildPonString(event.callTarget, meldTiles, seat, fromSeat);
                draws[turn] = callStr;
                currentDraw = callStr;

                // Remove from hand
                this.ensureTilesInHand(seat, meldTiles, hands);

                // Record pon (for later kakan)
                if (!this.ponRegistry.has(seat)) {
                  this.ponRegistry.set(seat, []);
                }
                this.ponRegistry.get(seat)!.push({
                  tiles: [event.callTarget, ...meldTiles],
                  fromSeat,
                });
              }
              event.processed = true;
              break;
            }
            case 'MINKAN': {
              if (event.callTarget !== undefined) {
                // Find who discarded: prefer actual lastDiscard that triggered call
                let fromSeat = -1;
                if (lastDiscard && toNormal(lastDiscard.tile) === toNormal(event.callTarget)) {
                  fromSeat = lastDiscard.seat;
                }
                if (fromSeat === -1) fromSeat = this.getKamicha(seat);

                const meldTiles: TileId[] = event.callMelds ?? [];
                if (meldTiles.length < 3) {
                  const normalTarget = toNormal(event.callTarget);
                  for (const t of hands[seat]) {
                    if (toNormal(t) === normalTarget && meldTiles.length < 3) {
                      meldTiles.push(t);
                    }
                  }
                }

                const callStr = buildMinkanString(event.callTarget, meldTiles, seat, fromSeat);
                draws[turn] = callStr;
                currentDraw = callStr;

                this.ensureTilesInHand(seat, meldTiles, hands);

                // Kan discard = 0
                discards[turn] = 0;
                currentDiscard = 0;
              }
              event.processed = true;
              break;
            }
            case 'ANKAN': {
              const meldTiles: TileId[] = event.callMelds ?? [];
              if (meldTiles.length === 4) {
                const callStr = buildAnkanString(meldTiles);
                draws[turn] = callStr;
                currentDraw = callStr;

                this.removeMultipleFromHand(hands[seat], meldTiles);

                discards[turn] = 0;
                currentDiscard = 0;
              }
              event.processed = true;
              break;
            }
            case 'KAKAN': {
              if (event.callTarget !== undefined) {
                // Find corresponding pon
                const pons = this.ponRegistry.get(seat) ?? [];
                const normalTarget = toNormal(event.callTarget);
                const ponInfo = pons.find(
                  (p) => toNormal(p.tiles[0]) === normalTarget
                );

                if (ponInfo) {
                  const callStr = buildKakanString(
                    event.callTarget,
                    ponInfo.tiles,
                    seat,
                    ponInfo.fromSeat
                  );
                  draws[turn] = callStr;
                  currentDraw = callStr;

                  this.removeFromHand(hands[seat], event.callTarget);

                  discards[turn] = 0;
                  currentDiscard = 0;
                }
              }
              event.processed = true;
              break;
            }
            case 'RIICHI': {
              // Riichi handled during discard, don't mark processed here
              break;
            }
          }
        }

        // === Process draw ===
        let drawnTile: TileId | null = null;

        if (currentDraw === null) {
          // Hero uses pre-generated draws
          if (seat === heroSeat && turn < this.heroPreGeneratedDraws.length) {
            drawnTile = this.heroPreGeneratedDraws[turn];
          } else {
            drawnTile = this.drawFromDeck();
          }
          draws[turn] = drawnTile;
        } else if (typeof currentDraw === 'number') {
          drawnTile = currentDraw;
        } else if (isCallString(currentDraw)) {
          drawnTile = null;
        }

        if (drawnTile !== null) {
          hands[seat].push(drawnTile);
        }

        // === Process discard ===
        // Hero's last turn: draw only (keep 14 tiles)
        if (seat === heroSeat && turn === this.heroLastTurn) {
          // Last turn no discard, truncate discards array
          // So hero's discards has one less element than draws, indicating no discard yet
          if (discards.length > turn) {
            discards.length = turn;
          }
          continue;
        }
        
        if (currentDiscard === null) {
          // Check for riichi event
          const riichiEvent = this.scheduledEvents.find(
            (e) =>
              e.seat === seat &&
              e.type === 'RIICHI' &&
              !e.processed &&
              (e.turn === -1 || e.turn === turn)
          );

          if (riichiEvent) {
            // Riichi
            // If riichi tile not specified, select random
            const discardTile = riichiEvent.discardTile ?? this.selectDiscard(hands[seat], seat);
            const isTsumogiri = drawnTile !== null && toNormal(drawnTile) === toNormal(discardTile);
            discards[turn] = isTsumogiri ? 'r60' : `r${formatTile(discardTile)}`;

            this.forceConsumeTileFromHand(seat, discardTile, hands);
            this.updateGenbutsu(discardTile, turn);
            lastDiscardBySeat.set(seat, { tile: discardTile, turn });
            lastDiscard = { seat, tile: discardTile };

            if (!this.riichiInfo.has(seat)) {
              this.recordRiichi(seat, turn, discards);
            }
            riichiEvent.processed = true;
          } else if (turn > 0 && isKanString(draws[turn - 1])) {
            // Discard after rinshan draw
            const discardTile = this.selectDiscard(hands[seat], seat);
            discards[turn] = discardTile;
            this.removeFromHand(hands[seat], discardTile);
            this.updateGenbutsu(discardTile, turn);
            lastDiscardBySeat.set(seat, { tile: discardTile, turn });
            lastDiscard = { seat, tile: discardTile };
          } else if (isKanString(currentDraw)) {
            discards[turn] = 0;
          } else {
            let discardTile: TileId | null = null;
            if (pendingTargets.length > 0) {
              for (const target of pendingTargets) {
                const matchIdx = hands[seat].findIndex(
                  (t) => toNormal(t) === toNormal(target)
                );
                if (matchIdx > -1) {
                  discardTile = hands[seat][matchIdx]!;
                  break;
                }
              }
            }
            if (discardTile === null) {
              discardTile = this.selectDiscard(hands[seat], seat);
            }
            discards[turn] = discardTile;
            this.removeFromHand(hands[seat], discardTile);
            this.updateGenbutsu(discardTile, turn);
            lastDiscardBySeat.set(seat, { tile: discardTile, turn });
            lastDiscard = { seat, tile: discardTile };
          }
        } else if (currentDiscard === 0) {
          // Kan placeholder
        } else {
          let discardTile: TileId | null = null;

          if (typeof currentDiscard === 'number') {
            if (currentDiscard === 60) {
              discardTile = drawnTile;
            } else {
              discardTile = currentDiscard;
            }
          } else if (typeof currentDiscard === 'string' && currentDiscard.startsWith('r')) {
            const tileStr = currentDiscard.slice(1);
            const tileNum = parseInt(tileStr, 10);
            if (tileNum === 60) {
              discardTile = drawnTile;
            } else {
              discardTile = tileNum;
            }
            if (!this.riichiInfo.has(seat)) {
              this.recordRiichi(seat, turn, discards);
            }
          }

          if (discardTile !== null) {
            this.forceConsumeTileFromHand(seat, discardTile, hands);
            this.updateGenbutsu(discardTile, turn);
            lastDiscardBySeat.set(seat, { tile: discardTile, turn });
            lastDiscard = { seat, tile: discardTile };
          }
        }
      }
    }

    return result;
  }
}

// ==========================================
// Convenience Function
// ==========================================

/**
 * Convenience function: complete input Tenhou Log
 */
export function solve(input: GeneratorInput): RoundLog {
  const solver = new NaiveSolver(input);
  return solver.solve();
}
