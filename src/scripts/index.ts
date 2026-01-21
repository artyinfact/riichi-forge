/**
 * scripts/index.ts - Script entry point
 *
 * Exports all available script functionality for external use
 */

export { generate, generateJson, completeRoundLog } from '../core/generator/LogGenerator';
export type { GeneratorOptions } from '../core/generator/LogGenerator';

export { NaiveSolver, solve } from '../core/solver/NaiveSolver';

export {
  validateGeneratorInput,
  validateRoundLog,
  isValidGeneratorInput,
  isValidRoundLog,
  formatValidationResult,
} from '../utils/validator';

export type {
  GeneratorInput,
  TenhouLogJson,
  RoundLog,
  PlayerEvent,
  TenhouRule,
  TileId,
} from '../types';

/**
 * Convenience function: Generate complete Tenhou Log JSON string from incomplete input
 */
export function completeAndStringify(
  input: import('../types').GeneratorInput,
  pretty = false
): string {
  const { generate } = require('../core/generator/LogGenerator');
  const result = generate(input);
  return pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);
}

/**
 * Convenience function: Generate Tenhou player URL
 */
export function toTenhouUrl(log: import('../types').TenhouLogJson): string {
  const json = JSON.stringify(log);
  return `https://tenhou.net/6/#json=${encodeURIComponent(json)}`;
}
