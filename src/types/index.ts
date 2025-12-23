// src/types/index.ts

// ==========================================
// 1. Logic Primitives (Tile Data Types)
// ==========================================

/**
 * Logical Tile ID (used for internal algorithm calculations)
 * Range: 11-47 (normal tiles), 51-53 (red dora)
 * Does NOT include 60 or strings
 */
export type TileId = number;

/**
 * Action type enumeration
 */
export type ActionType = 'DRAW' | 'CHI' | 'PON' | 'MINKAN' | 'ANKAN' | 'KAKAN' | 'RIICHI';


// ==========================================
// 2. Internal Solver Types
// ==========================================

/**
 * Call details (for recording chi/pon/kan information)
 * 
 * Call types:
 * - CHI: Call a tile from kamicha to form a sequence (e.g., call 14, meld [13, 15])
 * - PON: Call a tile from any player to form a triplet (e.g., call 18, meld [18, 18])
 * - MINKAN: Open kan - call a tile from any player (e.g., call 38, meld [38, 38, 38])
 * - ANKAN: Closed kan - declare with 4 tiles from hand (no calledTile, meld [15, 15, 15, 15])
 * - KAKAN: Added kan - add 4th tile to existing pon (calledTile is the added tile)
 */
export interface CallDetails {
  type: 'CHI' | 'PON' | 'MINKAN' | 'ANKAN' | 'KAKAN';
  calledTile?: TileId;   // The tile being called (undefined for ANKAN)
  meldedTiles: TileId[]; // Tiles from hand: 2 for CHI/PON, 3 for MINKAN, 4 for ANKAN, 1 for KAKAN
  fromSeat?: 0 | 1 | 2 | 3; // Source seat (undefined for ANKAN, used for pon/kan position encoding)
}

/**
 * Complete action record for each turn (intermediate state)
 * The reverse solver generates this list
 * 
 * ============================================================
 * IMPORTANT: Kan (杠) Turn Structure in Tenhou Log
 * ============================================================
 * 
 * In Tenhou Log format, a Kan operation occupies TWO consecutive "turns":
 * 
 * Turn A (Kan Declaration):
 *   - actionType: MINKAN / ANKAN / KAKAN
 *   - drawTile: the kan tile (for MINKAN/KAKAN) or drawn tile (for ANKAN)
 *   - callInfo: kan details
 *   - discardTile: 0 (placeholder, NOT a real discard!)
 *   - In JSON: draws[n] = kan_string, discards[n] = 0
 * 
 * Turn B (Rinshan Draw):
 *   - actionType: DRAW (this is actually the rinshan/replacement tile)
 *   - drawTile: the rinshan tile from dead wall
 *   - discardTile: the actual tile discarded after kan
 *   - In JSON: draws[n+1] = rinshan_tile, discards[n+1] = actual_discard
 * 
 * Example flow for Ankan 5m:
 *   Turn 7: { actionType: 'ANKAN', drawTile: 15, callInfo: {...}, discardTile: 0 }
 *   Turn 8: { actionType: 'DRAW', drawTile: 23, discardTile: 17 }  // rinshan 3p, discard 7m
 * 
 * This two-turn structure is REQUIRED for correct Tenhou JSON output.
 * The Generator must handle this split when converting TurnAction[] to JSON.
 * ============================================================
 */
export interface TurnAction {
  turnNumber: number;      // Turn number (巡目)
  actionType: ActionType;  // Main action type for this turn
  
  // === Incoming tile ===
  // If DRAW/RIICHI: the tile drawn from wall
  // If CHI/PON/MINKAN/KAKAN: the tile being called from another player
  // If ANKAN: the tile drawn that triggers the ankan (or any of the 4 tiles)
  drawTile: TileId; 
  
  // === Call section (valid for CHI/PON/MINKAN/ANKAN/KAKAN) ===
  callInfo?: CallDetails; 

  // === Discard section ===
  // For normal turns: the tile discarded
  // For KAN turns (Turn A): MUST be 0 (placeholder for rinshan)
  // For rinshan turns (Turn B after kan): the actual discarded tile
  discardTile?: TileId;    // 0 for kan placeholder, actual tile otherwise
  isTsumogiri?: boolean;   // Whether it's tsumogiri (摸切)
  
  // === Riichi section ===
  isRiichiDeclaration?: boolean; // Whether riichi was declared this turn
}

/**
 * Solver return result
 */
export interface SolvedPath {
  startHand: TileId[];   // Starting hand (haipai)
  turns: TurnAction[];   // Global action sequence
}


// ==========================================
// 3. Player Event (for scripting calls/riichi)
// ==========================================

/**
 * Player event configuration
 * Used to "script" any player's call/riichi behavior
 */
export interface PlayerEvent {
  turn?: number;
  type: 'CHI' | 'PON' | 'MINKAN' | 'ANKAN' | 'KAKAN' | 'RIICHI';
  // For chi/pon/minkan
  callTarget?: TileId;    // Which tile was called (undefined for ANKAN)
  callMelds?: TileId[];   // Which tiles from hand were used
  // For riichi
  discardTile?: TileId;   // The riichi declaration tile
}


// ==========================================
// 4. Tenhou Log JSON Structure (Input & Output)
// ==========================================

/**
 * Tenhou Log "draw/incoming tile" slot
 * - Normal draw: number (e.g., 11, 25, 47)
 * - Chi/Pon/Kan: string with position-encoded source player
 * - Unknown (for input): null
 * 
 * ============================================================
 * Call String Format Reference:
 * ============================================================
 * 
 * Chi (吃) - always from kamicha, "c" at index 0:
 *   "c" + called_tile + hand_tile1 + hand_tile2
 *   Example: "c141351" = chi 4m, using 3m + red5m from hand
 * 
 * Pon (碰) - "p" position indicates source:
 *   Index 0: from kamicha  → "p181818"
 *   Index 2: from toimen   → "18p1818"
 *   Index 4: from shimocha → "1818p18"
 * 
 * Minkan (明槓) - "m" position indicates source:
 *   Index 0: from kamicha  → "m38383838"
 *   Index 2: from toimen   → "38m383838"
 *   Index 6: from shimocha → "383838m38"
 * 
 * Ankan (暗槓) - "a" always at index 6:
 *   "151515a15" or "151515a51" (if red 5 involved)
 * 
 * Kakan (加槓) - "k" position matches original pon:
 *   Original "p181818" → Kakan "k18181818"
 *   Original "18p1818" → Kakan "18k181818"
 *   Original "1818p18" → Kakan "1818k1818"
 * 
 * ============================================================
 */
export type TenhouJsonDraw = number | string | null;

/**
 * Tenhou Log "discard" slot
 * - Normal discard: number (e.g., 11, 25, 47)
 * - Tsumogiri: 60 (discard the tile just drawn, 摸切)
 * - Riichi declaration: string (e.g., "r15" for hand discard, "r60" for tsumogiri riichi)
 * - Kan placeholder: 0 (CRITICAL: must appear after kan declaration, before rinshan draw)
 * - Unknown (for input): null
 * 
 * ============================================================
 * Kan Discard Sequence Example:
 * ============================================================
 * 
 * For a player who does Ankan on turn 7, then discards 7m after rinshan:
 *   draws:    [..., "151515a15", 23, ...]   // index 7: ankan, index 8: rinshan 3p
 *   discards: [..., 0,           17, ...]   // index 7: placeholder, index 8: actual 7m
 * 
 * The 0 placeholder is MANDATORY - it maintains array alignment between draws/discards.
 * Without it, the Tenhou viewer will misalign all subsequent turns.
 * ============================================================
 */
export type TenhouJsonDiscard = number | string | null;

/**
 * Player data block [haipai, draws, discards]
 */
export type PlayerLogBlock = [
  TileId[],             // Haipai (13 tiles, pure numbers)
  TenhouJsonDraw[],     // Draws (mixed: numbers and call strings)
  TenhouJsonDiscard[]   // Discards (mixed: numbers, 60, and riichi strings)
];

/**
 * Result type string
 */
export type ResultType = 
  | '和了'      // Win (agari)
  | '流局'      // Exhaustive draw (ryuukyoku)
  | '全員聴牌'  // All players tenpai
  | '全員不聴'  // All players not tenpai
  | '流し満貫'  // Nagashi mangan
  | '九種九牌'  // Nine different terminals/honors (kyuushu kyuuhai)
  | '三家和了'  // Three player ron (sanchahou)
  | '四風連打'  // Four wind discards (suufonrenda)
  | '四家立直'  // Four riichi (suuchariichi)
  | '四槓散了'; // Four kan abort (suukaikan)

/**
 * Score changes array
 * - 4 elements: [east_delta, south_delta, west_delta, north_delta]
 * - 8 elements: with chip counts [p0, p1, p2, p3, c0, c1, c2, c3]
 */
export type ScoreChanges = number[];

/**
 * Win result info
 * [winner_seat, target_seat, winner_seat, point_string, ...yaku_strings]
 * - winner_seat: 0-3
 * - target_seat: same as winner for tsumo, different for ron
 * - point_string: e.g., "30符2飜2000点", "満貫8000点", "30符3飜2000点∀"
 * - yaku_strings: e.g., "立直(1飜)", "ドラ(2飜)", "赤ドラ(1飜)"
 */
export type WinInfo = [number, number, number, string, ...string[]];

/**
 * Result block - variable structure depending on result type
 * 
 * Win (和了):
 * - Tsumo: ["和了", ScoreChanges, WinInfo]
 * - Ron: ["和了", ScoreChanges, WinInfo]
 * - Double/Triple Ron: ["和了", ScoreChanges, WinInfo, ScoreChanges, WinInfo, ...]
 * 
 * Draw with score changes:
 * - Exhaustive draw: ["流局", ScoreChanges]
 * - Nagashi mangan: ["流し満貫", ScoreChanges]
 * 
 * Draw without score changes:
 * - All tenpai: ["全員聴牌"]
 * - All not tenpai: ["全員不聴"]
 * 
 * Abortive draws (no score changes):
 * - ["九種九牌"], ["三家和了"], ["四風連打"], ["四家立直"], ["四槓散了"]
 */
export type ResultBlock = 
  | ['和了', ...(ScoreChanges | WinInfo)[]]
  | ['流局', ScoreChanges]
  | ['流し満貫', ScoreChanges]
  | ['全員聴牌']
  | ['全員不聴']
  | ['九種九牌']
  | ['三家和了']
  | ['四風連打']
  | ['四家立直'] 
  | ['四槓散了'];

/**
 * Complete round log structure
 * 
 * Structure:
 * [0]: [round, honba, riichi_sticks] - Round info
 * [1]: [east_pts, south_pts, west_pts, north_pts] - Starting points
 * [2]: [dora_indicators] - Dora indicator tiles
 * [3]: [ura_dora_indicators] - Ura dora indicators (empty if no riichi win)
 * [4-6]: East player [haipai, draws, discards]
 * [7-9]: South player [haipai, draws, discards]
 * [10-12]: West player [haipai, draws, discards]
 * [13-15]: North player [haipai, draws, discards]
 * [16]: Result block
 */
export type RoundLog = [
  [number, number, number],  // Round info: [round, honba, riichi_sticks]
  number[],                  // Starting points: [east, south, west, north]
  number[],                  // Dora indicators
  number[],                  // Ura dora indicators
  // Player 0 (East)
  TileId[], TenhouJsonDraw[], TenhouJsonDiscard[],
  // Player 1 (South)
  TileId[], TenhouJsonDraw[], TenhouJsonDiscard[],
  // Player 2 (West)
  TileId[], TenhouJsonDraw[], TenhouJsonDiscard[],
  // Player 3 (North)
  TileId[], TenhouJsonDraw[], TenhouJsonDiscard[],
  // Result
  ResultBlock
];

/**
 * Generator input structure
 * 
 * Uses RoundLog + PlayerEvent[] as input, sharing structure with output.
 * 
 * ============================================================
 * Input Conventions:
 * ============================================================
 * 
 * The `roundLog` field uses RoundLog structure with these conventions:
 * 
 * 1. haipai (手牌):
 *    - Hero: complete 13 tiles
 *    - Opponents: empty array []
 * 
 * 2. draws (摸牌):
 *    - Known values: normal TileId or call string
 *    - Unknown: `null`
 *    - Array can be truncated (shorter = remaining unknown)
 * 
 * 3. discards (舍牌):
 *    - Known values: normal TileId, 60, riichi string, or 0
 *    - Unknown: `null`
 *    - Array can be truncated (shorter = remaining unknown)
 * 
 * Example partial input:
 *   draws:    [11, 23, null, null, ...]  // first 2 known, rest unknown
 *   discards: [12, 60, 15, null, ...]    // first 3 known, rest unknown
 *   
 * Or truncated:
 *   draws:    [11, 23]        // only first 2 known
 *   discards: [12, 60, 15]    // only first 3 known
 * 
 * ============================================================
 */
export interface GeneratorInput {
  /** RoundLog with null for unknown draws/discards */
  roundLog: RoundLog;
  
  /** Player events for all 4 seats [East, South, West, North] */
  playerEvents: [PlayerEvent[], PlayerEvent[], PlayerEvent[], PlayerEvent[]];
  
  /** Which seat is the hero (has complete haipai) */
  heroSeat: 0 | 1 | 2 | 3;
  
  /** Game rule config (mainly for aka/red dora count) */
  rule: TenhouRule;
}

/**
 * Tenhou game rule configuration
 * 
 * Red dora (赤ドラ) settings:
 * - If `aka` is defined: applies to all three suits (aka51 = aka52 = aka53 = aka)
 * - If individual `aka51/52/53` are defined: per-suit red dora count
 * - Value range: 0-4 (number of red 5s per suit)
 *   - 0: No red dora
 *   - 1: Standard (1 red 5 per suit) - most common
 *   - 2-4: Multiple red dora (rare variants)
 * 
 * When generating JSON output:
 * - If all three counts are equal, use shorthand `aka` to save space
 * - Otherwise, use individual `aka51`, `aka52`, `aka53`
 */
export interface TenhouRule {
  disp?: string;     // Display name (e.g., "般南喰赤", "特東喰赤")
  aka?: number;      // Shorthand: red dora count for all suits (0-4)
  aka51?: number;    // Red 5m (萬子) count (0-4)
  aka52?: number;    // Red 5p (筒子) count (0-4)
  aka53?: number;    // Red 5s (索子) count (0-4)
}

/**
 * Complete Tenhou Log JSON structure
 */
export interface TenhouLogJson {
  title: string[];    // [room_name, timestamp_gmt]
  name: string[];     // [east, south, west, north] player names in seat order
  rule: TenhouRule;   // Game rule configuration
  log: RoundLog[];    // Array of round logs
}
