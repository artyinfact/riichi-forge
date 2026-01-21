/**
 * scripts/index.ts - 脚本入口点
 *
 * 导出所有可用的脚本功能，供外部使用
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
 * 便捷函数：从残缺输入生成完整的 Tenhou Log JSON 字符串
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
 * 便捷函数：生成 Tenhou 播放器 URL
 */
export function toTenhouUrl(log: import('../types').TenhouLogJson): string {
  const json = JSON.stringify(log);
  return `https://tenhou.net/6/#json=${encodeURIComponent(json)}`;
}

