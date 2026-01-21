// src/utils/validator.ts

import type {
  TileId,
  RoundLog,
  TenhouJsonDraw,
  TenhouJsonDiscard,
  TenhouRule,
  GeneratorInput,
} from '../types';
import { toNormal } from './tile';

// ==========================================
// Types
// ==========================================

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ==========================================
// Tile Validation
// ==========================================

/**
 * 检查是否为有效的 TileId
 * 有效范围: 11-19 (萬), 21-29 (筒), 31-39 (索), 41-47 (字), 51-53 (赤)
 */
export function isValidTileId(tile: unknown): tile is TileId {
  if (typeof tile !== 'number') return false;
  
  // 数牌
  if (tile >= 11 && tile <= 19) return true;
  if (tile >= 21 && tile <= 29) return true;
  if (tile >= 31 && tile <= 39) return true;
  // 字牌
  if (tile >= 41 && tile <= 47) return true;
  // 赤牌
  if (tile >= 51 && tile <= 53) return true;
  
  return false;
}

/**
 * 验证牌数组（手牌、舍牌等）
 */
export function validateTileArray(
  tiles: unknown[],
  fieldName: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    if (tile === null) continue; // null 表示未知，跳过
    if (typeof tile === 'string') continue; // 副露/立直字符串，单独验证
    
    if (!isValidTileId(tile)) {
      errors.push({
        field: `${fieldName}[${i}]`,
        message: `Invalid tile ID`,
        value: tile,
      });
    }
  }
  
  return errors;
}

/**
 * 统计牌的使用数量，检查是否超过4张
 */
export function validateTileCount(
  allTiles: TileId[],
  rule: TenhouRule
): ValidationError[] {
  const errors: ValidationError[] = [];
  const count: Map<number, number> = new Map();
  
  // 获取赤牌配置
  const aka51 = rule.aka ?? rule.aka51 ?? 1;
  const aka52 = rule.aka ?? rule.aka52 ?? 1;
  const aka53 = rule.aka ?? rule.aka53 ?? 1;
  
  for (const tile of allTiles) {
    const normal = toNormal(tile);
    count.set(normal, (count.get(normal) || 0) + 1);
    
    // 赤牌单独计数
    if (tile === 51 || tile === 52 || tile === 53) {
      const key = tile + 1000; // 用 1051, 1052, 1053 区分赤牌
      count.set(key, (count.get(key) || 0) + 1);
    }
  }
  
  // 检查每种牌是否超过4张
  for (const [tile, cnt] of count) {
    if (tile > 1000) {
      // 赤牌检查
      const redTile = tile - 1000;
      const maxRed = redTile === 51 ? aka51 : redTile === 52 ? aka52 : aka53;
      if (cnt > maxRed) {
        errors.push({
          field: 'tiles',
          message: `Red tile ${redTile} appears ${cnt} times, but rule allows only ${maxRed}`,
          value: { tile: redTile, count: cnt, max: maxRed },
        });
      }
    } else if (cnt > 4) {
      errors.push({
        field: 'tiles',
        message: `Tile ${tile} appears ${cnt} times (max 4)`,
        value: { tile, count: cnt },
      });
    }
  }
  
  return errors;
}

// ==========================================
// Call String Validation
// ==========================================

/**
 * 验证副露字符串格式
 */
export function validateCallString(
  callStr: string,
  fieldName: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // 检查类型标记
  const hasC = callStr.includes('c');
  const hasP = callStr.includes('p');
  const hasM = callStr.includes('m');
  const hasA = callStr.includes('a');
  const hasK = callStr.includes('k');
  
  const typeCount = [hasC, hasP, hasM, hasA, hasK].filter(Boolean).length;
  
  if (typeCount !== 1) {
    errors.push({
      field: fieldName,
      message: `Call string should have exactly one type marker (c/p/m/a/k), found ${typeCount}`,
      value: callStr,
    });
    return errors;
  }
  
  // 提取牌号
  const cleaned = callStr.replace(/[cpamk]/g, '');
  if (cleaned.length % 2 !== 0) {
    errors.push({
      field: fieldName,
      message: `Invalid call string format: tile numbers should be 2 digits each`,
      value: callStr,
    });
    return errors;
  }
  
  const tiles: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    const tileStr = cleaned.slice(i, i + 2);
    const tile = parseInt(tileStr, 10);
    if (!isValidTileId(tile)) {
      errors.push({
        field: fieldName,
        message: `Invalid tile in call string: ${tileStr}`,
        value: callStr,
      });
    }
    tiles.push(tile);
  }
  
  // 验证副露类型的牌数
  if (hasC && tiles.length !== 3) {
    errors.push({
      field: fieldName,
      message: `Chi should have 3 tiles, found ${tiles.length}`,
      value: callStr,
    });
  }
  if (hasP && tiles.length !== 3) {
    errors.push({
      field: fieldName,
      message: `Pon should have 3 tiles, found ${tiles.length}`,
      value: callStr,
    });
  }
  if ((hasM || hasA || hasK) && tiles.length !== 4) {
    errors.push({
      field: fieldName,
      message: `Kan should have 4 tiles, found ${tiles.length}`,
      value: callStr,
    });
  }
  
  // 验证吃是顺子
  if (hasC && tiles.length === 3) {
    const sorted = tiles.map(toNormal).sort((a, b) => a - b);
    const isSequence =
      sorted[1] === sorted[0] + 1 && sorted[2] === sorted[1] + 1;
    const sameSuit =
      Math.floor(sorted[0] / 10) === Math.floor(sorted[1] / 10) &&
      Math.floor(sorted[1] / 10) === Math.floor(sorted[2] / 10);
    
    if (!isSequence || !sameSuit) {
      errors.push({
        field: fieldName,
        message: `Chi tiles are not a valid sequence`,
        value: { callStr, tiles: sorted },
      });
    }
  }
  
  // 验证碰/杠是同种牌
  if ((hasP || hasM || hasA || hasK) && tiles.length >= 3) {
    const normalTiles = tiles.map(toNormal);
    const allSame = normalTiles.every((t) => t === normalTiles[0]);
    if (!allSame) {
      errors.push({
        field: fieldName,
        message: `Pon/Kan tiles should all be the same`,
        value: { callStr, tiles: normalTiles },
      });
    }
  }
  
  return errors;
}

/**
 * 验证立直字符串格式
 */
export function validateRiichiString(
  riichiStr: string,
  fieldName: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!riichiStr.startsWith('r')) {
    errors.push({
      field: fieldName,
      message: `Riichi string should start with 'r'`,
      value: riichiStr,
    });
    return errors;
  }
  
  const tileStr = riichiStr.slice(1);
  const tile = parseInt(tileStr, 10);
  
  if (tile !== 60 && !isValidTileId(tile)) {
    errors.push({
      field: fieldName,
      message: `Invalid tile in riichi string: ${tileStr}`,
      value: riichiStr,
    });
  }
  
  return errors;
}

// ==========================================
// RoundLog Validation
// ==========================================

/**
 * 验证 RoundLog 结构
 */
export function validateRoundLog(
  roundLog: RoundLog,
  rule: TenhouRule
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  // 1. 验证基本结构
  if (!Array.isArray(roundLog) || roundLog.length < 17) {
    errors.push({
      field: 'roundLog',
      message: `RoundLog should have at least 17 elements`,
      value: roundLog.length,
    });
    return { valid: false, errors, warnings };
  }
  
  // 2. 验证 round info
  const [roundInfo, startingPoints, doraIndicators, uraDoraIndicators] = roundLog;
  
  if (!Array.isArray(roundInfo) || roundInfo.length !== 3) {
    errors.push({
      field: 'roundInfo',
      message: `Round info should be [round, honba, riichi_sticks]`,
      value: roundInfo,
    });
  }
  
  if (!Array.isArray(startingPoints) || startingPoints.length !== 4) {
    errors.push({
      field: 'startingPoints',
      message: `Starting points should be array of 4 numbers`,
      value: startingPoints,
    });
  }
  
  // 3. 验证 dora
  errors.push(...validateTileArray(doraIndicators, 'doraIndicators'));
  errors.push(...validateTileArray(uraDoraIndicators, 'uraDoraIndicators'));
  
  // 4. 收集所有牌（用于计数验证）
  const allTiles: TileId[] = [];
  allTiles.push(...(doraIndicators.filter((t) => typeof t === 'number') as TileId[]));
  allTiles.push(...(uraDoraIndicators.filter((t) => typeof t === 'number') as TileId[]));
  
  // 5. 验证四家数据
  for (let seat = 0; seat < 4; seat++) {
    const baseIdx = 4 + seat * 3;
    const haipai = roundLog[baseIdx] as TileId[];
    const draws = roundLog[baseIdx + 1] as TenhouJsonDraw[];
    const discards = roundLog[baseIdx + 2] as TenhouJsonDiscard[];
    
    const seatName = ['East', 'South', 'West', 'North'][seat];
    
    // 验证手牌
    if (haipai.length > 0 && haipai.length !== 13) {
      warnings.push({
        field: `${seatName}.haipai`,
        message: `Haipai should have 13 tiles, found ${haipai.length}`,
        value: haipai.length,
      });
    }
    errors.push(...validateTileArray(haipai, `${seatName}.haipai`));
    allTiles.push(...haipai);
    
    // 验证摸牌
    for (let i = 0; i < draws.length; i++) {
      const draw = draws[i];
      if (draw === null) continue;
      
      if (typeof draw === 'number') {
        if (!isValidTileId(draw)) {
          errors.push({
            field: `${seatName}.draws[${i}]`,
            message: `Invalid draw tile`,
            value: draw,
          });
        } else {
          allTiles.push(draw);
        }
      } else if (typeof draw === 'string') {
        errors.push(...validateCallString(draw, `${seatName}.draws[${i}]`));
        // 从副露字符串中提取牌
        const cleaned = draw.replace(/[cpamk]/g, '');
        for (let j = 0; j < cleaned.length; j += 2) {
          const tile = parseInt(cleaned.slice(j, j + 2), 10);
          if (isValidTileId(tile)) {
            allTiles.push(tile);
          }
        }
      }
    }
    
    // 验证舍牌
    for (let i = 0; i < discards.length; i++) {
      const discard = discards[i];
      if (discard === null) continue;
      if (discard === 0) continue; // 杠占位符
      
      if (typeof discard === 'number') {
        if (discard !== 60 && !isValidTileId(discard)) {
          errors.push({
            field: `${seatName}.discards[${i}]`,
            message: `Invalid discard tile`,
            value: discard,
          });
        } else if (discard !== 60) {
          allTiles.push(discard);
        }
      } else if (typeof discard === 'string') {
        errors.push(...validateRiichiString(discard, `${seatName}.discards[${i}]`));
        // 从立直字符串中提取牌
        const tile = parseInt(discard.slice(1), 10);
        if (tile !== 60 && isValidTileId(tile)) {
          allTiles.push(tile);
        }
      }
    }
    
    // 验证摸牌/舍牌数组长度一致性
    const drawCount = draws.filter((d) => d !== null).length;
    const discardCount = discards.filter((d) => d !== null && d !== 0).length;
    
    // 允许一定的差异（因为和牌/流局时可能不打牌）
    if (Math.abs(drawCount - discardCount) > 1) {
      warnings.push({
        field: `${seatName}`,
        message: `Draw count (${drawCount}) and discard count (${discardCount}) differ significantly`,
        value: { draws: drawCount, discards: discardCount },
      });
    }
  }
  
  // 6. 验证牌数量
  errors.push(...validateTileCount(allTiles, rule));
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ==========================================
// GeneratorInput Validation
// ==========================================

/**
 * 验证 GeneratorInput
 */
export function validateGeneratorInput(input: GeneratorInput): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  // 1. 验证 heroSeat
  if (input.heroSeat < 0 || input.heroSeat > 3) {
    errors.push({
      field: 'heroSeat',
      message: `heroSeat should be 0-3`,
      value: input.heroSeat,
    });
  }
  
  // 2. 验证 hero 的手牌存在
  const heroBaseIdx = 4 + input.heroSeat * 3;
  const heroHaipai = input.roundLog[heroBaseIdx] as TileId[];
  
  if (!heroHaipai || heroHaipai.length !== 13) {
    errors.push({
      field: `hero.haipai`,
      message: `Hero should have exactly 13 tiles in haipai`,
      value: heroHaipai?.length,
    });
  }
  
  // 3. 验证 playerEvents
  if (!Array.isArray(input.playerEvents) || input.playerEvents.length !== 4) {
    errors.push({
      field: 'playerEvents',
      message: `playerEvents should be array of 4 event arrays`,
      value: input.playerEvents?.length,
    });
  } else {
    for (let seat = 0; seat < 4; seat++) {
      const events = input.playerEvents[seat];
      const seatName = ['East', 'South', 'West', 'North'][seat];
      
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        
        // 验证事件类型
        const validTypes = ['CHI', 'PON', 'MINKAN', 'ANKAN', 'KAKAN', 'RIICHI'];
        if (!validTypes.includes(event.type)) {
          errors.push({
            field: `${seatName}.events[${i}].type`,
            message: `Invalid event type`,
            value: event.type,
          });
        }
        
        // 验证吃/碰/杠必须有 callTarget（暗杠除外）
        if (['CHI', 'PON', 'MINKAN', 'KAKAN'].includes(event.type)) {
          if (event.callTarget === undefined) {
            errors.push({
              field: `${seatName}.events[${i}].callTarget`,
              message: `${event.type} requires callTarget`,
              value: event,
            });
          }
        }
        
        // 验证吃必须有 callMelds
        if (event.type === 'CHI' && !event.callMelds) {
          errors.push({
            field: `${seatName}.events[${i}].callMelds`,
            message: `CHI requires callMelds`,
            value: event,
          });
        }
        
        // 验证暗杠必须有 callMelds（4张）
        if (event.type === 'ANKAN') {
          if (!event.callMelds || event.callMelds.length !== 4) {
            errors.push({
              field: `${seatName}.events[${i}].callMelds`,
              message: `ANKAN requires callMelds with 4 tiles`,
              value: event,
            });
          }
        }
        
        // 验证立直必须有 discardTile
        if (event.type === 'RIICHI' && event.discardTile === undefined) {
          errors.push({
            field: `${seatName}.events[${i}].discardTile`,
            message: `RIICHI requires discardTile`,
            value: event,
          });
        }
        // 验证立直必须指定 turn
        if (event.type === 'RIICHI' && event.turn === undefined) {
          errors.push({
            field: `${seatName}.events[${i}].turn`,
            message: `RIICHI requires explicit turn`,
            value: event,
          });
        }
      }
    }
  }
  
  // 4. 验证 roundLog
  const roundLogResult = validateRoundLog(input.roundLog, input.rule);
  errors.push(...roundLogResult.errors);
  warnings.push(...roundLogResult.warnings);
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ==========================================
// Convenience Functions
// ==========================================

/**
 * 快速验证 RoundLog
 */
export function isValidRoundLog(roundLog: RoundLog, rule: TenhouRule): boolean {
  return validateRoundLog(roundLog, rule).valid;
}

/**
 * 快速验证 GeneratorInput
 */
export function isValidGeneratorInput(input: GeneratorInput): boolean {
  return validateGeneratorInput(input).valid;
}

/**
 * 格式化验证结果为可读字符串
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];
  
  lines.push(`Valid: ${result.valid}`);
  
  if (result.errors.length > 0) {
    lines.push(`\nErrors (${result.errors.length}):`);
    for (const err of result.errors) {
      lines.push(`  - [${err.field}] ${err.message}`);
      if (err.value !== undefined) {
        lines.push(`    Value: ${JSON.stringify(err.value)}`);
      }
    }
  }
  
  if (result.warnings.length > 0) {
    lines.push(`\nWarnings (${result.warnings.length}):`);
    for (const warn of result.warnings) {
      lines.push(`  - [${warn.field}] ${warn.message}`);
      if (warn.value !== undefined) {
        lines.push(`    Value: ${JSON.stringify(warn.value)}`);
      }
    }
  }
  
  return lines.join('\n');
}
