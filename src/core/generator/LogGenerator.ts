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
 * Check if a single player's data is complete (no completion needed)
 * 
 * Note: This is a "completeness check", not a "validity validation"
 * - Completeness check: Are there any null values that need completion?
 * - Validity validation: Is the data format correct? (see validator.ts)
 */
function isPlayerDataComplete(
  haipai: TileId[],
  draws: TenhouJsonDraw[],
  discards: TenhouJsonDiscard[]
): boolean {
  // Hand must have 13 tiles (empty array means needs completion)
  if (haipai.length !== 13) {
    return false;
  }

  // Check if draws has null (null means needs completion)
  if (draws.some((d) => d === null)) {
    return false;
  }

  // Check if discards has null (null means needs completion)
  if (discards.some((d) => d === null)) {
    return false;
  }

  return true;
}

/**
 * Check if RoundLog is complete (no null values that need completion)
 * 
 * This only checks "whether NaiveSolver needs to be called", not data validity.
 * For validity validation, use validateRoundLog() in validator.ts
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
 * Check if GeneratorInput is complete
 */
export function isInputComplete(input: GeneratorInput): boolean {
  return isRoundLogComplete(input.roundLog);
}

// ==========================================
// Generator
// ==========================================

/**
 * Generate default timestamp (GMT format)
 */
function generateTimestamp(): string {
  const now = new Date();
  // Format: "2024/01/15 12:34 GMT"
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  const minute = String(now.getUTCMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hour}:${minute} GMT`;
}

/**
 * Generate default rule display name
 */
function generateRuleDisplay(rule: TenhouRule): string {
  const aka = rule.aka ?? rule.aka51 ?? 1;
  // Simplified: if has red dora, include "赤" in display
  return aka > 0 ? '般東喰赤' : '般東喰';
}

/**
 * LogGenerator - Generate complete Tenhou Log JSON
 */
export class LogGenerator {
  private input: GeneratorInput;
  private options: GeneratorOptions;

  constructor(input: GeneratorInput, options: GeneratorOptions = {}) {
    this.input = input;
    this.options = options;
  }

  /**
   * Generate complete TenhouLogJson
   */
  generate(): TenhouLogJson {
    let roundLog: RoundLog;

    // Check if completion is needed
    if (isInputComplete(this.input)) {
      // Log is complete, use directly
      roundLog = this.input.roundLog;
    } else {
      // Log is incomplete, use NaiveSolver to complete
      const solver = new NaiveSolver(this.input);
      roundLog = solver.solve();
    }

    // Build TenhouLogJson
    const {
      roomName = 'Paipu House',
      timestamp = generateTimestamp(),
      playerNames = ['East', 'South', 'West', 'North'],
    } = this.options;

    // Rule configuration
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
 * Convenience function: Generate TenhouLogJson from GeneratorInput
 */
export function generate(
  input: GeneratorInput,
  options: GeneratorOptions = {}
): TenhouLogJson {
  const generator = new LogGenerator(input, options);
  return generator.generate();
}

/**
 * Convenience function: Generate and return JSON string
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
 * Convenience function: Only complete RoundLog (don't generate full JSON)
 */
export function completeRoundLog(input: GeneratorInput): RoundLog {
  if (isInputComplete(input)) {
    return input.roundLog;
  }
  const solver = new NaiveSolver(input);
  return solver.solve();
}
