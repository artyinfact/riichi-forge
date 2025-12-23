// src/core/generator/LogGenerator.ts

import type {
  GeneratorInput,
  RoundLog,
  TenhouLogJson,
  TenhouRule,
  TenhouJsonDraw,
  TenhouJsonDiscard,
  TileId,
} from '../../types';
import { NaiveSolver } from '../solver/NaiveSolver';

// ==========================================
// Types
// ==========================================

export interface GeneratorOptions {
  /** Room name for title */
  roomName?: string;
  /** Timestamp (defaults to current time) */
  timestamp?: string;
  /** Player names [East, South, West, North] */
  playerNames?: [string, string, string, string];
}

// ==========================================
// Completeness Check
// ==========================================

/**
 * 检查单个玩家的数据是否完整（无需补全）
 * 
 * 注意：这是"完整性检查"，不是"合法性验证"
 * - 完整性检查：是否有 null 需要补全？
 * - 合法性验证：数据格式是否正确？（见 validator.ts）
 */
function isPlayerDataComplete(
  haipai: TileId[],
  draws: TenhouJsonDraw[],
  discards: TenhouJsonDiscard[]
): boolean {
  // 手牌必须有 13 张（空数组表示需要补全）
  if (haipai.length !== 13) {
    return false;
  }

  // 检查 draws 中是否有 null（null 表示需要补全）
  if (draws.some((d) => d === null)) {
    return false;
  }

  // 检查 discards 中是否有 null（null 表示需要补全）
  if (discards.some((d) => d === null)) {
    return false;
  }

  return true;
}

/**
 * 检查 RoundLog 是否完整（没有需要补全的 null 值）
 * 
 * 这只检查"是否需要调用 NaiveSolver"，不验证数据合法性。
 * 如需验证合法性，请使用 validator.ts 中的 validateRoundLog()
 */
export function isRoundLogComplete(roundLog: RoundLog): boolean {
  for (let seat = 0; seat < 4; seat++) {
    const baseIdx = 4 + seat * 3;
    const haipai = roundLog[baseIdx] as TileId[];
    const draws = roundLog[baseIdx + 1] as TenhouJsonDraw[];
    const discards = roundLog[baseIdx + 2] as TenhouJsonDiscard[];

    if (!isPlayerDataComplete(haipai, draws, discards)) {
      return false;
    }
  }

  return true;
}

/**
 * 检查 GeneratorInput 是否完整
 */
export function isInputComplete(input: GeneratorInput): boolean {
  return isRoundLogComplete(input.roundLog);
}

// ==========================================
// Generator
// ==========================================

/**
 * 生成默认的 timestamp (GMT格式)
 */
function generateTimestamp(): string {
  const now = new Date();
  // 格式: "2024/01/15 12:34 GMT"
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  const minute = String(now.getUTCMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hour}:${minute} GMT`;
}

/**
 * 生成默认的规则显示名称
 */
function generateRuleDisplay(rule: TenhouRule): string {
  const aka = rule.aka ?? rule.aka51 ?? 1;
  // 简化: 有赤就是 "赤"
  return aka > 0 ? '般東喰赤' : '般東喰';
}

/**
 * LogGenerator - 生成完整的 Tenhou Log JSON
 */
export class LogGenerator {
  private input: GeneratorInput;
  private options: GeneratorOptions;

  constructor(input: GeneratorInput, options: GeneratorOptions = {}) {
    this.input = input;
    this.options = options;
  }

  /**
   * 生成完整的 TenhouLogJson
   */
  generate(): TenhouLogJson {
    let roundLog: RoundLog;

    // 检查是否需要补全
    if (isInputComplete(this.input)) {
      // 牌谱完整，直接使用
      roundLog = this.input.roundLog;
    } else {
      // 牌谱不完整，使用 NaiveSolver 补全
      const solver = new NaiveSolver(this.input);
      roundLog = solver.solve();
    }

    // 构建 TenhouLogJson
    const {
      roomName = '牌谱屋',
      timestamp = generateTimestamp(),
      playerNames = ['東家', '南家', '西家', '北家'],
    } = this.options;

    // 规则配置
    const rule: TenhouRule = {
      ...this.input.rule,
      disp: this.input.rule.disp ?? generateRuleDisplay(this.input.rule),
    };

    return {
      title: [roomName, timestamp],
      name: playerNames,
      rule,
      log: [roundLog],
    };
  }
}

// ==========================================
// Convenience Functions
// ==========================================

/**
 * 便捷函数：从 GeneratorInput 生成 TenhouLogJson
 */
export function generate(
  input: GeneratorInput,
  options: GeneratorOptions = {}
): TenhouLogJson {
  const generator = new LogGenerator(input, options);
  return generator.generate();
}

/**
 * 便捷函数：生成并返回 JSON 字符串
 */
export function generateJson(
  input: GeneratorInput,
  options: GeneratorOptions = {},
  pretty: boolean = false
): string {
  const log = generate(input, options);
  return pretty ? JSON.stringify(log, null, 2) : JSON.stringify(log);
}

/**
 * 便捷函数：仅补全 RoundLog（不生成完整 JSON）
 */
export function completeRoundLog(input: GeneratorInput): RoundLog {
  if (isInputComplete(input)) {
    return input.roundLog;
  }
  const solver = new NaiveSolver(input);
  return solver.solve();
}
