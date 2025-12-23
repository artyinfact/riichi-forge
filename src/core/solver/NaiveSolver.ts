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
 * NaiveSolver - 补全输入的 Tenhou Log 中的未知部分
 *
 * 舍牌优先级：
 * 1. 现物（如果有人立直：立直家的舍牌 + 立直后所有人的舍牌）
 * 2. 字牌 (41-47)
 * 3. 19 (x1, x9)
 * 4. 28 (x2, x8)
 * 5. 37 (x3, x7)
 * 6. 456 (x4, x5, x6)
 *
 * 同优先级随机选择
 */

// ==========================================
// Priority Constants
// ==========================================

const PRIORITY_GENBUTSU = 0; // 现物 - 最高优先级
const PRIORITY_HONOR = 1; // 字牌
const PRIORITY_TERMINAL = 2; // 19
const PRIORITY_28 = 3; // 28
const PRIORITY_37 = 4; // 37
const PRIORITY_456 = 5; // 456

// ==========================================
// Types
// ==========================================

interface ScheduledEvent extends PlayerEvent {
  seat: number;
  turn: number; // 确定后的回合数
  processed: boolean;
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * 获取牌的舍牌优先级（不考虑现物）
 */
function getBasePriority(tile: TileId): number {
  const normal = toNormal(tile);

  // 字牌 41-47
  if (normal >= 41 && normal <= 47) {
    return PRIORITY_HONOR;
  }

  // 数牌
  const num = normal % 10;
  if (num === 1 || num === 9) return PRIORITY_TERMINAL;
  if (num === 2 || num === 8) return PRIORITY_28;
  if (num === 3 || num === 7) return PRIORITY_37;
  return PRIORITY_456; // 4, 5, 6
}

/**
 * 从 discard 中提取实际的 TileId
 */
function extractTileFromDiscard(discard: TenhouJsonDiscard): TileId | null {
  if (discard === null || discard === 0) return null;

  if (typeof discard === 'number') {
    return discard === 60 ? null : discard;
  }

  // 立直字符串 "r15" -> 15, "r60" -> null
  if (typeof discard === 'string' && discard.startsWith('r')) {
    const tileStr = discard.slice(1);
    const tileNum = parseInt(tileStr, 10);
    return tileNum === 60 ? null : tileNum;
  }

  return null;
}

/**
 * 检查 discard 是否为立直宣言
 */
function isRiichiDiscard(discard: TenhouJsonDiscard): boolean {
  return typeof discard === 'string' && discard.startsWith('r');
}

/**
 * 检查是否为副露字符串
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
 * 检查是否为杠（明杠、暗杠、加杠）
 */
function isKanString(draw: TenhouJsonDraw): boolean {
  if (typeof draw !== 'string') return false;
  return draw.includes('m') || draw.includes('a') || draw.includes('k');
}

/**
 * 从副露字符串中提取相关的牌
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
 * 格式化牌号为两位字符串
 */
function formatTile(tile: TileId): string {
  return tile.toString().padStart(2, '0');
}

/**
 * 生成吃的副露字符串
 * Chi: "c" + called_tile + hand_tile1 + hand_tile2
 */
function buildChiString(
  calledTile: TileId,
  meldTiles: TileId[]
): string {
  return `c${formatTile(calledTile)}${formatTile(meldTiles[0])}${formatTile(meldTiles[1])}`;
}

/**
 * 生成碰的副露字符串
 * Pon: "p" position indicates source
 *   Index 0: from kamicha  → "p181818"
 *   Index 2: from toimen   → "18p1818"
 *   Index 4: from shimocha → "1818p18"
 */
function buildPonString(
  calledTile: TileId,
  meldTiles: TileId[],
  callerSeat: number,
  fromSeat: number
): string {
  const relPos = (fromSeat - callerSeat + 4) % 4; // 1=kamicha, 2=toimen, 3=shimocha
  const t1 = formatTile(meldTiles[0]);
  const t2 = formatTile(meldTiles[1]);
  const tc = formatTile(calledTile);

  if (relPos === 1) {
    // kamicha
    return `p${tc}${t1}${t2}`;
  } else if (relPos === 2) {
    // toimen
    return `${tc}p${t1}${t2}`;
  } else {
    // shimocha (relPos === 3)
    return `${t1}${t2}p${tc}`;
  }
}

/**
 * 生成明杠的副露字符串
 * Minkan: "m" position indicates source
 *   Index 0: from kamicha  → "m38383838"
 *   Index 2: from toimen   → "38m383838"
 *   Index 6: from shimocha → "383838m38"
 */
function buildMinkanString(
  calledTile: TileId,
  meldTiles: TileId[],
  callerSeat: number,
  fromSeat: number
): string {
  const relPos = (fromSeat - callerSeat + 4) % 4;
  const tc = formatTile(calledTile);
  const t1 = formatTile(meldTiles[0]);
  const t2 = formatTile(meldTiles[1]);
  const t3 = formatTile(meldTiles[2]);

  if (relPos === 1) {
    return `m${tc}${t1}${t2}${t3}`;
  } else if (relPos === 2) {
    return `${tc}m${t1}${t2}${t3}`;
  } else {
    return `${t1}${t2}${t3}m${tc}`;
  }
}

/**
 * 生成暗杠的副露字符串
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
 * 生成加杠的副露字符串
 * Kakan: "k" position matches original pon
 */
function buildKakanString(
  addedTile: TileId,
  originalPonTiles: TileId[],
  callerSeat: number,
  originalFromSeat: number
): string {
  const relPos = (originalFromSeat - callerSeat + 4) % 4;
  const tc = formatTile(addedTile);
  const t1 = formatTile(originalPonTiles[0]);
  const t2 = formatTile(originalPonTiles[1]);
  const t3 = formatTile(originalPonTiles[2]);

  if (relPos === 1) {
    return `k${tc}${t1}${t2}${t3}`;
  } else if (relPos === 2) {
    return `${tc}k${t1}${t2}${t3}`;
  } else {
    return `${t1}${t2}k${tc}${t3}`;
  }
}

/**
 * 获取 aka 数量配置
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
 * 生成带有自定义赤牌数量的牌山
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

  constructor(input: GeneratorInput) {
    this.input = input;
    this.genbutsu = new Set();
    this.riichiInfo = new Map();
    this.scheduledEvents = [];
    this.ponRegistry = new Map();

    // 初始化牌山
    this.deck = this.initializeDeck();

    // 处理 playerEvents
    this.processPlayerEvents();
  }

  /**
   * 初始化牌山，移除已知的牌
   */
  private initializeDeck(): TileId[] {
    const { rule, roundLog, playerEvents } = this.input;
    const akaCount = getAkaCount(rule);

    let deck = generateDeckWithAka(akaCount);
    const knownTiles: TileId[] = [];

    // Dora 指示牌
    knownTiles.push(...(roundLog[2] as number[]));
    knownTiles.push(...(roundLog[3] as number[]));

    // 四家的手牌和已知的摸牌/舍牌
    for (let seat = 0; seat < 4; seat++) {
      const baseIdx = 4 + seat * 3;
      const haipai = roundLog[baseIdx] as TileId[];
      const draws = roundLog[baseIdx + 1] as TenhouJsonDraw[];
      const discards = roundLog[baseIdx + 2] as TenhouJsonDiscard[];

      knownTiles.push(...haipai);

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

    // 从 playerEvents 中也移除涉及的牌
    for (let seat = 0; seat < 4; seat++) {
      const events = playerEvents[seat];
      for (const event of events) {
        if (event.callTarget !== undefined) {
          knownTiles.push(event.callTarget);
        }
        if (event.callMelds) {
          knownTiles.push(...event.callMelds);
        }
      }
    }

    deck = removeTilesFromDeck(deck, knownTiles);
    return shuffle(deck);
  }

  /**
   * 处理 playerEvents，确定每个事件的回合
   */
  private processPlayerEvents(): void {
    const { playerEvents } = this.input;

    for (let seat = 0; seat < 4; seat++) {
      const events = playerEvents[seat];

      for (const event of events) {
        const scheduledEvent: ScheduledEvent = {
          ...event,
          seat,
          turn: event.turn ?? -1, // -1 表示需要推算
          processed: false,
        };
        this.scheduledEvents.push(scheduledEvent);
      }
    }

    // 对有明确 turn 的事件排序
    this.scheduledEvents.sort((a, b) => {
      if (a.turn === -1 && b.turn === -1) return 0;
      if (a.turn === -1) return 1;
      if (b.turn === -1) return -1;
      return a.turn - b.turn;
    });
  }

  /**
   * 查找需要在指定回合触发的事件
   */
  private findEventForTurn(
    seat: number,
    turn: number,
    lastDiscardBySeat: Map<number, { tile: TileId; turn: number }>
  ): ScheduledEvent | null {
    for (const event of this.scheduledEvents) {
      if (event.processed) continue;
      if (event.seat !== seat) continue;

      // 如果有明确的 turn，检查是否匹配
      if (event.turn !== -1 && event.turn !== turn) continue;

      // 对于需要推算 turn 的事件，检查条件是否满足
      if (event.turn === -1) {
        switch (event.type) {
          case 'CHI': {
            // 吃需要上家刚打出 callTarget
            const kamicha = (seat + 3) % 4;
            const lastDiscard = lastDiscardBySeat.get(kamicha);
            if (
              lastDiscard &&
              event.callTarget !== undefined &&
              toNormal(lastDiscard.tile) === toNormal(event.callTarget) &&
              lastDiscard.turn === turn - 1
            ) {
              event.turn = turn;
              return event;
            }
            break;
          }
          case 'PON':
          case 'MINKAN': {
            // 碰/明杠需要有人刚打出 callTarget
            for (const [fromSeat, lastDiscard] of lastDiscardBySeat) {
              if (fromSeat === seat) continue;
              if (
                event.callTarget !== undefined &&
                toNormal(lastDiscard.tile) === toNormal(event.callTarget) &&
                lastDiscard.turn === turn - 1
              ) {
                event.turn = turn;
                return event;
              }
            }
            break;
          }
          case 'ANKAN':
          case 'KAKAN':
          case 'RIICHI': {
            // 这些在自己的回合触发，简单地返回第一个未处理的
            event.turn = turn;
            return event;
          }
        }
      } else {
        // turn 已经匹配
        return event;
      }
    }
    return null;
  }

  /**
   * 从牌山中抽一张牌
   */
  private drawFromDeck(): TileId {
    if (this.deck.length === 0) {
      console.warn('[NaiveSolver] Deck is empty, returning placeholder tile');
      return 41;
    }
    return this.deck.pop()!;
  }

  /**
   * 记录立直
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
   * 更新现物集合
   */
  private updateGenbutsu(tile: TileId, currentTurn: number): void {
    for (const [, info] of this.riichiInfo) {
      if (currentTurn >= info.turn) {
        this.genbutsu.add(toNormal(tile));
      }
    }
  }

  /**
   * 根据优先级选择舍牌
   */
  private selectDiscard(hand: TileId[]): TileId {
    if (hand.length === 0) {
      throw new Error('[NaiveSolver] Hand is empty, cannot select discard');
    }

    const groups: Map<number, TileId[]> = new Map();

    for (const tile of hand) {
      const normalTile = toNormal(tile);
      let priority: number;

      if (this.genbutsu.has(normalTile)) {
        priority = PRIORITY_GENBUTSU;
      } else {
        priority = getBasePriority(tile);
      }

      if (!groups.has(priority)) {
        groups.set(priority, []);
      }
      groups.get(priority)!.push(tile);
    }

    const minPriority = Math.min(...groups.keys());
    const candidates = groups.get(minPriority)!;
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
  }

  /**
   * 从手牌中移除一张牌
   */
  private removeFromHand(hand: TileId[], tile: TileId): boolean {
    const idx = hand.indexOf(tile);
    if (idx > -1) {
      hand.splice(idx, 1);
      return true;
    }
    // 尝试匹配 normalized 值
    const normalIdx = hand.findIndex((t) => toNormal(t) === toNormal(tile));
    if (normalIdx > -1) {
      hand.splice(normalIdx, 1);
      return true;
    }
    return false;
  }

  /**
   * 从手牌中移除多张牌
   */
  private removeMultipleFromHand(hand: TileId[], tiles: TileId[]): void {
    for (const tile of tiles) {
      this.removeFromHand(hand, tile);
    }
  }

  /**
   * 获取上家座位号
   */
  private getKamicha(seat: number): number {
    return (seat + 3) % 4;
  }

  /**
   * 执行求解
   */
  solve(): RoundLog {
    const { roundLog, heroSeat } = this.input;

    // 深拷贝 roundLog
    const result: RoundLog = JSON.parse(JSON.stringify(roundLog));

    // 1. 补全对手手牌
    for (let seat = 0; seat < 4; seat++) {
      if (seat === heroSeat) continue;
      const baseIdx = 4 + seat * 3;
      const haipai = result[baseIdx] as TileId[];
      while (haipai.length < 13) {
        haipai.push(this.drawFromDeck());
      }
    }

    // 2. 第一遍扫描：找出所有已知的立直
    for (let seat = 0; seat < 4; seat++) {
      const baseIdx = 4 + seat * 3;
      const discards = result[baseIdx + 2] as TenhouJsonDiscard[];
      for (let turn = 0; turn < discards.length; turn++) {
        if (isRiichiDiscard(discards[turn])) {
          this.recordRiichi(seat, turn, discards);
        }
      }
    }

    // 3. 找出最大巡数
    let maxTurns = 0;
    for (let seat = 0; seat < 4; seat++) {
      const baseIdx = 4 + seat * 3;
      const draws = result[baseIdx + 1] as TenhouJsonDraw[];
      const discards = result[baseIdx + 2] as TenhouJsonDiscard[];
      maxTurns = Math.max(maxTurns, draws.length, discards.length);
    }
    if (maxTurns === 0) {
      maxTurns = 18;
    }

    // 4. 维护每个玩家的当前手牌
    const hands: TileId[][] = [];
    for (let seat = 0; seat < 4; seat++) {
      const baseIdx = 4 + seat * 3;
      hands[seat] = [...(result[baseIdx] as TileId[])];
    }

    // 5. 记录每家最后的舍牌（用于判断副露时机）
    const lastDiscardBySeat: Map<number, { tile: TileId; turn: number }> = new Map();

    // 6. 按巡处理
    for (let turn = 0; turn < maxTurns; turn++) {
      for (let seat = 0; seat < 4; seat++) {
        const baseIdx = 4 + seat * 3;
        const draws = result[baseIdx + 1] as TenhouJsonDraw[];
        const discards = result[baseIdx + 2] as TenhouJsonDiscard[];

        // 确保数组足够长
        while (draws.length <= turn) draws.push(null);
        while (discards.length <= turn) discards.push(null);

        let currentDraw = draws[turn];
        let currentDiscard = discards[turn];

        // === 检查是否有 playerEvent 需要触发 ===
        const event = this.findEventForTurn(seat, turn, lastDiscardBySeat);

        if (event && !event.processed) {
          // 处理事件
          switch (event.type) {
            case 'CHI': {
              if (event.callTarget !== undefined && event.callMelds) {
                // 吃必定来自上家，不需要编码来源
                const callStr = buildChiString(event.callTarget, event.callMelds);
                draws[turn] = callStr;
                currentDraw = callStr;

                // 从手牌中移除用于吃的牌
                this.removeMultipleFromHand(hands[seat], event.callMelds);
              }
              event.processed = true;
              break;
            }
            case 'PON': {
              if (event.callTarget !== undefined) {
                // 找出是谁打的牌
                let fromSeat = -1;
                for (const [s, d] of lastDiscardBySeat) {
                  if (s !== seat && toNormal(d.tile) === toNormal(event.callTarget)) {
                    fromSeat = s;
                    break;
                  }
                }
                if (fromSeat === -1) fromSeat = this.getKamicha(seat);

                // 从手牌中找出用于碰的牌
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

                // 从手牌中移除
                this.removeMultipleFromHand(hands[seat], meldTiles);

                // 记录碰（用于后续加杠）
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
                let fromSeat = -1;
                for (const [s, d] of lastDiscardBySeat) {
                  if (s !== seat && toNormal(d.tile) === toNormal(event.callTarget)) {
                    fromSeat = s;
                    break;
                  }
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

                this.removeMultipleFromHand(hands[seat], meldTiles);

                // 杠的舍牌为 0
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
                // 找到对应的碰
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
              // 立直会在舍牌时处理
              event.processed = true;
              break;
            }
          }
        }

        // === 处理摸牌 ===
        let drawnTile: TileId | null = null;

        if (currentDraw === null) {
          drawnTile = this.drawFromDeck();
          draws[turn] = drawnTile;
        } else if (typeof currentDraw === 'number') {
          drawnTile = currentDraw;
        } else if (isCallString(currentDraw)) {
          drawnTile = null;
        }

        if (drawnTile !== null) {
          hands[seat].push(drawnTile);
        }

        // === 处理舍牌 ===
        if (currentDiscard === null) {
          // 检查是否有立直事件
          const riichiEvent = this.scheduledEvents.find(
            (e) =>
              e.seat === seat &&
              e.type === 'RIICHI' &&
              !e.processed &&
              (e.turn === -1 || e.turn === turn)
          );

          if (riichiEvent && riichiEvent.discardTile !== undefined) {
            // 立直
            const discardTile = riichiEvent.discardTile;
            const isTsumogiri = drawnTile !== null && toNormal(drawnTile) === toNormal(discardTile);
            discards[turn] = isTsumogiri ? 'r60' : `r${formatTile(discardTile)}`;

            this.removeFromHand(hands[seat], discardTile);
            this.updateGenbutsu(discardTile, turn);
            lastDiscardBySeat.set(seat, { tile: discardTile, turn });

            if (!this.riichiInfo.has(seat)) {
              this.recordRiichi(seat, turn, discards);
            }
            riichiEvent.processed = true;
          } else if (turn > 0 && isKanString(draws[turn - 1])) {
            // 岭上开花后的舍牌
            const discardTile = this.selectDiscard(hands[seat]);
            discards[turn] = discardTile;
            this.removeFromHand(hands[seat], discardTile);
            this.updateGenbutsu(discardTile, turn);
            lastDiscardBySeat.set(seat, { tile: discardTile, turn });
          } else if (isKanString(currentDraw)) {
            discards[turn] = 0;
          } else {
            const discardTile = this.selectDiscard(hands[seat]);
            discards[turn] = discardTile;
            this.removeFromHand(hands[seat], discardTile);
            this.updateGenbutsu(discardTile, turn);
            lastDiscardBySeat.set(seat, { tile: discardTile, turn });
          }
        } else if (currentDiscard === 0) {
          // 杠占位符
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
            this.removeFromHand(hands[seat], discardTile);
            this.updateGenbutsu(discardTile, turn);
            lastDiscardBySeat.set(seat, { tile: discardTile, turn });
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
 * 便捷函数：补全输入的 Tenhou Log
 */
export function solve(input: GeneratorInput): RoundLog {
  const solver = new NaiveSolver(input);
  return solver.solve();
}
